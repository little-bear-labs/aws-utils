const http = require('http');
const express = require('express');
const jwtDecode = require('jwt-decode');
const e2p = require('event-to-promise');
const mosca = require('@conduitvc/mosca');
const uuid = require('uuid');
const {
  parse,
  validate,
  execute,
  subscribe,
  specifiedRules,
} = require('graphql');
const log = require('logdown')('appsync-emulator:serverCore');
const consola = require('./log');
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

    mqttServer.on('subscribed', (...args) => this.onClientSubscribed(...args));

    mqttServer.on('unsubscribed', (...args) =>
      this.onClientUnsubscribed(...args),
    );
  }

  // eslint-disable-next-line
  async onClientConnect(client) {
    const { id: clientId } = client;
    consola.info(`client connected to subscription server (${clientId})`);
    const timeout = this.iteratorTimeout.get(client.id);
    if (timeout) {
      clearTimeout(timeout);
    }
  }

  async onClientSubscribed(topic, client) {
    const { id: clientId } = client;
    consola.info(`client (${clientId}) subscribed to : ${topic}`);
    log.info(`client (${clientId}) subscribed to : ${topic}`);
    const regs = this.registrations.get(clientId);
    if (!regs) {
      log.error('No registration for clientId', clientId);
      return;
    }

    const reg = regs.find(({ topicId }) => topicId === topic);
    if (!reg) {
      log.error(`Not subscribed to topicId: ${topic} for clientId`, clientId);
      return;
    }

    if (!reg.isRegistered) {
      const asyncIterator = await this.subscribeToGraphQL(reg);

      if (asyncIterator.errors) {
        log.error('Error(s) subcribing via graphql', asyncIterator.errors);
        return;
      }

      Object.assign(reg, {
        asyncIterator,
        isRegistered: true,
      });
    }

    const { asyncIterator, topicId } = reg;
    log.info('clientConnect', { clientId, topicId });

    // eslint-disable-next-line no-constant-condition
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

  onClientUnsubscribed(topic, client) {
    const { id: clientId } = client;
    consola.info(`client (${clientId}) unsubscribed to : ${topic}`);
    log.info(`client (${clientId}) unsubscribed to : ${topic}`);
    const regs = this.registrations.get(clientId);
    if (!regs) {
      log.warn(
        `Unsubscribe topic: ${topic} from client with unknown id`,
        clientId,
      );
      return;
    }

    const reg = regs.find(({ topicId }) => topicId === topic);
    if (!reg) {
      log.warn(`Unsubscribe unregistered topic ${topic} from client`, clientId);
      return;
    }

    // turn off subscription, but keep registration so client
    // can resubscribe
    reg.asyncIterator.return();
    reg.isRegistered = false;
  }

  onClientDisconnect(client) {
    const { id: clientId } = client;
    log.info('clientDisconnect', { clientId });
    consola.info(`client disconnected to subscription server (${clientId})`);
    const reg = this.registrations.get(clientId);
    if (!reg) {
      log.warn('Disconnecting client with unknown id', clientId);
    }
  }

  async register({ documentAST, variables, jwt }) {
    const clientId = jwt.sub;
    const topicId = uuid();
    log.info('register', { clientId, topicId });

    const context = { jwt };
    const registration = {
      context,
      documentAST,
      variables,
      topicId,
    };
    const asyncIterator = await this.subscribeToGraphQL(registration);

    if (asyncIterator.errors) {
      return {
        errors: context.appsyncErrors || asyncIterator.errors,
        data: asyncIterator.data || null,
      };
    }

    Object.assign(registration, {
      asyncIterator,
      isRegistered: true,
    });

    const currentRegistrations = this.registrations.get(clientId) || [];
    currentRegistrations.push(registration);

    this.registrations.set(clientId, currentRegistrations);

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
              topics: currentRegistrations.map(reg => reg.topicId),
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

  subscribeToGraphQL(registration) {
    return subscribe({
      schema: this.schema,
      document: registration.documentAST,
      variableValues: registration.variables,
      contextValue: registration.context,
    });
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
  // const { headers: { authorization = null, }, } = req;
  const { headers } = req;
  log.info('req', { req });

  if (!headers.authorization && !headers['x-api-key']) {
    throw new Error('Must pass authorization header');
  }
  const jwt = headers.authorization ? jwtDecode(headers.authorization) : {};
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
      log.error('Error handling request:', err);
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
    // ensure that the mqtt server is fully closed.
    mqttServer.close(() => mqttHTTP.close());
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
