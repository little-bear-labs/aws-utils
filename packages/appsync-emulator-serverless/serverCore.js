const http = require('http');
const express = require('express');
const jwtDecode = require('jwt-decode');
const e2p = require('event-to-promise');
const mosca = require('mosca');
const uuid = require('uuid');
const {
  parse,
  validate,
  execute,
  subscribe,
  specifiedRules,
} = require('graphql');
const log = require('logdown')('appsync-emulator:serverCore');
const consola = require('consola');
const { inspect } = require('util');

const TopicExpires = 1000 * 60 * 100;
const ConnectTimeout = 1000 * 60 * 2;

class SubscriptionServer {
  constructor({ schema, mqttServer, mqttURL, pubsub, subscriptions }) {
    Object.assign(this, { schema, mqttServer, mqttURL, pubsub, subscriptions });
    this.mqttServer = mqttServer;
    this.registrations = new Map();
    this.iteratorTimeout = new Map();

    mqttServer.on('clientConnected', (...args) =>
      this.onClientConnect(...args),
    );
    mqttServer.on('clientDisconnected', (...args) =>
      this.onClientDisconnect(...args),
    );
  }

  async onClientConnect(client) {
    const { id: clientId } = client;
    log.info('clientConnect', { clientId });
    consola.info(`client connected to subscription server (${clientId})`);
    const reg = this.registrations.get(clientId);
    if (!reg) {
      console.error('No registration for clientId', clientId);
      return;
    }
    const { asyncIterator, topicId } = reg;

    while (true) {
      const { value: payload, done } = await asyncIterator.next();
      if (done) break;
      if (
        payload == null ||
        (typeof payload === 'object' && payload.data == null)
      ) {
        log.info('subscribe payload is null skipping publish', payload);
        // eslint-disable-next-line
        continue;
      }

      log.info('publish', { payload, clientId, topicId });
      consola.info(
        'publish',
        inspect({ payload, clientId, topicId }, { depth: null }),
      );
      this.mqttServer.publish({
        topic: topicId,
        payload: JSON.stringify(payload),
        qos: 0,
        retain: false,
      });
    }
  }

  onClientDisconnect(client) {
    const { id: clientId } = client;
    log.info('clientDisconnect', { clientId });
    consola.info(`client disconnected to subscription server (${clientId})`);
    const reg = this.registrations.get(clientId);
    if (!reg) {
      console.warn('Disconnecting client with unknown id', clientId);
      return;
    }
    this.registrations.delete(clientId);
    reg.asyncIterator.return();
  }

  async register({ documentAST, variables, jwt }) {
    const clientId = uuid();
    const topicId = uuid();
    log.info('register', { clientId, topicId });

    const context = { jwt };
    const asyncIterator = await subscribe({
      schema: this.schema,
      document: documentAST,
      variableValues: variables,
      contextValue: { jwt },
    });

    if (asyncIterator.errors) {
      return {
        errors: context.appsyncErrors || asyncIterator.errors,
        data: asyncIterator.data || null,
      };
    }

    this.registrations.set(clientId, {
      documentAST,
      variables,
      topicId,
      asyncIterator,
    });

    // if client does not connect within this amount of time then end iterator.
    this.iteratorTimeout.set(
      clientId,
      setTimeout(() => {
        asyncIterator.return();
      }, ConnectTimeout),
    );

    consola.info(
      'subscription handshake sent',
      inspect({
        clientId,
        url: this.mqttURL,
        topic: topicId,
      }),
    );

    return {
      extensions: {
        subscription: {
          mqttConnections: [
            {
              url: this.mqttURL,
              topics: [topicId],
              client: clientId,
            },
          ],
          newSubscriptions: {
            [topicId]: {
              topic: topicId,
              expireTime: Date.now() + TopicExpires,
            },
          },
        },
      },
      data: null,
      errors: null,
    };
  }
}

const executeGQL = async ({ schema, documentAST, jwt, variables }) => {
  const context = { jwt };
  const output = await execute(
    schema,
    documentAST,
    null, // root value
    context,
    variables,
  );

  // nasty hack to emulator appsync errors which are more robust than what
  // the graphql-js lib can do.
  if (context.appsyncErrors) {
    const errorOutput = {
      data: output.data,
      errors: context.appsyncErrors,
    };
    return errorOutput;
  }

  return output;
};

const createGQLHandler = ({ schema, subServer }) => async (req, res) => {
  const {
    headers: { authorization = null },
  } = req;
  if (!authorization) {
    throw new Error('Must pass authorization header');
  }
  const jwt = jwtDecode(authorization);
  const { variables, query } = req.body;
  consola.start('graphql', query);
  log.info('request', { variables, query });
  const documentAST = parse(query);
  const validationErrors = validate(schema, documentAST, specifiedRules);
  if (validationErrors.length) {
    return res.send({
      errors: validationErrors,
    });
  }
  const {
    definitions: [{ operation: queryType }],
  } = documentAST;

  switch (queryType) {
    case 'query':
    case 'mutation':
      return res.send(
        await executeGQL({ schema, documentAST, jwt, variables }),
      );
    case 'subscription':
      return res.send(
        await subServer.register({
          jwt,
          documentAST,
          variables,
        }),
      );
    default:
      throw new Error(`unknown operation type: ${queryType}`);
  }
};

const createServer = async ({ port = 0, pubsub, schema, subscriptions }) => {
  // mqtt over ws server.
  const mqttHTTP = http.createServer();
  const mqttServer = new mosca.Server({
    port: 0,
    backend: { type: 'memory' },
  });
  mqttServer.attachHttpServer(mqttHTTP);
  mqttServer.on('clientConnected', client => {
    log.info('client has connected', client.id);
  });
  mqttHTTP.listen(0);
  await e2p(mqttServer, 'ready');
  // Trailing slash is very important. The mqtt client will not connect without it.
  const mqttURL = `ws://localhost:${mqttHTTP.address().port}/`;
  const subServer = new SubscriptionServer({
    schema,
    mqttServer,
    mqttURL,
    pubsub,
    subscriptions,
  });

  // graphql server.
  const app = express();
  app.use(express.json());
  app.use(require('cors')());
  const handler = createGQLHandler({ schema, subServer });

  app.post('/graphql', async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('Error handling request:', err);
      res.send(500);
    }
  });
  const server = app.listen(port);
  server.once('listening', () => {
    log.info('server bound', server.address());
  });

  await e2p(server, 'listening');
  const { port: boundPort } = server.address();

  server.once('close', () => {
    mqttServer.close();
  });

  return {
    url: `http://localhost:${boundPort}/graphql`,
    mqttURL,
    mqttServer,
    server,
    schema,
  };
};

module.exports = createServer;
