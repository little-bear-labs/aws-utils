const fetch = require('node-fetch');
const e2p = require('event-to-promise');
const gql = require('graphql-tag');
const createMQTTClient = require('./mqttClient');
const createServer = require('../server');
const { default: ApolloClient } = require('apollo-boost');
const dynamodbEmulator = require('@conduitvc/dynamodb-emulator/client');

global.fetch = fetch;

describe('subscriptionServer', () => {
  // eslint-disable-next-line
  const serverless = __dirname + '/example/serverless.yml';
  let emulator;
  let dynamodb;

  beforeAll(async () => {
    jest.setTimeout(10 * 1000);
    emulator = await dynamodbEmulator.launch();
    dynamodb = dynamodbEmulator.getClient(emulator);
  });

  afterAll(async () => {
    await emulator.terminate();
  });

  const createClient = url =>
    new ApolloClient({
      uri: url,
      request: operation => {
        operation.setContext({
          headers: {
            // install our test credentials.
            authorization: require('../testJWT').string,
          },
        });
      },
    });

  const createAPIClient = url =>
    new ApolloClient({
      uri: url,
      request: operation => {
        operation.setContext({
          headers: {
            // install our test credentials.
            'x-api-key': '1234567890',
          },
        });
      },
    });

  const mutate = client =>
    client.mutate({
      mutation: gql`
        mutation test($input: QuoteRequestInput!) {
          putQuoteRequest(input: $input) {
            id
            commodity
            amount
          }
        }
      `,
      variables: {
        input: {
          commodity: 'foo',
          amount: 100.5,
        },
      },
    });

  const anotherMutate = (client, id) =>
    client.mutate({
      mutation: gql`
        mutation test($id: ID!, $input: QuoteResponseInput!) {
          putQuoteResponse(id: $id, input: $input) {
            id
            offer
            expires
          }
        }
      `,
      variables: {
        id,
        input: {
          offer: 5,
          expires: 10,
        },
      },
    });

  const request = async (url, payload) => {
    const req = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: require('../testJWT').string,
      },
      body: JSON.stringify(payload, null, 2),
    });
    return req.json();
  };

  let server;
  let url;
  beforeEach(async () => {
    const { url: _url, server: _server } = await createServer({
      serverless,
      dynamodb,
    });
    server = _server;
    url = _url;
  });

  afterEach(done => {
    server.close(() => done());
  });

  it('appSync errors', async () => {
    const client = createClient(url);
    const output = await client.query({
      errorPolicy: 'all',
      query: gql`
        query {
          error
        }
      `,
    });

    expect(output).toMatchObject({
      errors: [
        {
          message: 'No request',
        },
      ],
    });
  });

  it('mutations', async () => {
    const client = createClient(url);
    const output = await mutate(client);

    expect(output).toMatchObject({
      data: {
        putQuoteRequest: {
          commodity: 'foo',
          amount: 100.5,
          __typename: 'QuoteRequest',
        },
      },
    });
  });

  it('subscriptions', async () => {
    const subscribePayload = {
      operationName: 'test',
      query: `
      subscription quoteRequest {
        subscribeToPutQuoteRequest {
          id
          commodity
          amount
        }
      }
      `,
      variables: {},
    };

    const secondSubscribePayload = {
      operationName: 'test2',
      query: `
      subscription quoteRequest {
        subscribeToPutQuoteResponse {
          id
          offer
          expires
        }
      }
      `,
      variables: {},
    };

    const client = createClient(url);
    await request(url, subscribePayload);
    const secondSubscribe = await request(url, secondSubscribePayload);

    const {
      extensions: {
        subscription: {
          mqttConnections: [connectionParams],
        },
      },
    } = secondSubscribe;

    const mqttClient = await createMQTTClient(
      connectionParams.url,
      connectionParams.client,
    );
    await Promise.all(
      connectionParams.topics.map(topic => mqttClient.subscribe(topic)),
    );
    const msgPromise = e2p(mqttClient, 'message');
    const mutateOutput = await mutate(client);

    const { payloadString: msg } = await msgPromise;
    const msgContent = JSON.parse(msg);
    expect(msgContent).toHaveProperty('data');
    expect(msgContent).toMatchObject({
      data: {
        subscribeToPutQuoteRequest: {
          commodity: 'foo',
          amount: 100.5,
        },
      },
    });

    const secondMsgPromise = e2p(mqttClient, 'message');
    await anotherMutate(client, mutateOutput.data.putQuoteRequest.id);
    const { payloadString: secondMsg } = await secondMsgPromise;
    const secondMsgContent = JSON.parse(secondMsg);
    expect(secondMsgContent).toHaveProperty('data');
    expect(secondMsgContent).toMatchObject({
      data: {
        subscribeToPutQuoteResponse: {
          offer: '5',
          expires: 10,
        },
      },
    });
  });

  it('query user details', async () => {
    const client = createClient(url);
    const output = await client.query({
      query: gql`
        query {
          cognitoInfo {
            sub
            issuer
            username
            sourceIp
            defaultAuthStrategy
          }
        }
      `,
    });

    expect(output).toMatchObject({
      data: {
        cognitoInfo: {
          sub: '2357be7c-39e0-461e-8d8f-9a7a003c294d',
          issuer:
            'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_27WcML9k8',
          username: 'd9aeaadc-e677-4c65-9d69-a4d6f3a7df86',
          sourceIp: ['0.0.0.0'],
          defaultAuthStrategy: 'ALLOW',
          __typename: 'CognitoInfo',
        },
      },
    });
  });

  it('test api key authentication', async () => {
    const client = createAPIClient(url);
    const output = await mutate(client);

    expect(output).toMatchObject({
      data: {
        putQuoteRequest: {
          commodity: 'foo',
          amount: 100.5,
          __typename: 'QuoteRequest',
        },
      },
    });
  });
});
