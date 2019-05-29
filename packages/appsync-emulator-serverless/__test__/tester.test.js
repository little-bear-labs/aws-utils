const { inspect } = require('util');
const {
  create: createTestServer,
  connect: connectTestServer,
} = require('../tester');
const gql = require('graphql-tag');

const { AWSAppSyncClient } = require('aws-appsync');
// eslint-disable-next-line
global.fetch = require('node-fetch');

function getPromiseForNextSubscriptionEvent(sub) {
  return new Promise(accept => sub.subscribe(accept));
}

function isPromisePending(promise) {
  return inspect(promise).includes('<pending>');
}

function mutate(client) {
  return client.mutate({
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
}

// These specs execute slowly on Mac, so need a larger timeout.
describe('appsync-emulator-serverless/tester', () => {
  let serverSetup;
  beforeEach(async () => {
    jest.setTimeout(10 * 1000);
  });

  afterEach(async () => serverSetup.close());

  it('client interactions', async () => {
    serverSetup = await createTestServer({
      serverless: `${__dirname}/example/serverless.yml`,
    });

    const client = connectTestServer(serverSetup, AWSAppSyncClient);

    const sub = await client.subscribe({
      query: gql`
        subscription sub {
          subscribeToPutQuoteRequest {
            id
            commodity
            amount
            stash
          }
        }
      `,
    });
    const waiting = new Promise(accept => sub.subscribe(accept));
    await client.mutate({
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

    const event = await waiting;
    expect(event).toMatchObject({
      data: {
        subscribeToPutQuoteRequest: {
          amount: 100.5,
          commodity: 'foo',
          stash: 'horst',
        },
      },
    });
  });

  it(
    'supports localstack',
    async () => {
      serverSetup = await createTestServer({
        serverless: `${__dirname}/example/serverless.yml`,
        dynamodbConfig: {
          endpoint: 'http://localhost:61023',
          accessKeyId: 'fake',
          secretAccessKey: 'fake',
          region: 'fake',
        },
      });

      const client = connectTestServer(serverSetup, AWSAppSyncClient);

      const sub = await client.subscribe({
        query: gql`
          subscription sub {
            subscribeToPutQuoteRequest {
              id
              commodity
              amount
            }
          }
        `,
      });
      const waiting = new Promise(accept => sub.subscribe(accept));
      await client.mutate({
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

      const event = await waiting;
      expect(event).toMatchObject({
        data: {
          subscribeToPutQuoteRequest: {
            amount: 100.5,
            commodity: 'foo',
          },
        },
      });
    },
    40000,
  );

  it('subscription with no arguments', async () => {
    serverSetup = await createTestServer({
      serverless: `${__dirname}/example/serverless.yml`,
    });
    const client = connectTestServer(serverSetup, AWSAppSyncClient);

    const subscriptionWithNoArguments = await client.subscribe({
      query: gql`
        subscription test {
          subscribeToPutQuoteRequest {
            id
            commodity
            amount
          }
        }
      `,
    });

    const subscriptionPayloadPromise = getPromiseForNextSubscriptionEvent(
      subscriptionWithNoArguments,
    );

    await mutate(client);

    expect(await subscriptionPayloadPromise).toMatchObject({
      data: {
        subscribeToPutQuoteRequest: {
          commodity: 'foo',
          amount: 100.5,
        },
      },
    });
  });

  it('subscription without provided optional argument', async () => {
    serverSetup = await createTestServer({
      serverless: `${__dirname}/example/serverless.yml`,
    });
    const client = connectTestServer(serverSetup, AWSAppSyncClient);

    const subscriptionWithoutProvidedOptionalArgument = await client.subscribe({
      query: gql`
        subscription subscribeWithOptionalArgument($commodity: String) {
          subscribeWithOptionalArgument(commodity: $commodity) {
            id
            commodity
            amount
          }
        }
      `,
    });

    const subscriptionPayloadPromise = getPromiseForNextSubscriptionEvent(
      subscriptionWithoutProvidedOptionalArgument,
    );

    await mutate(client);

    expect(await subscriptionPayloadPromise).toMatchObject({
      data: {
        subscribeWithOptionalArgument: {
          commodity: 'foo',
          amount: 100.5,
        },
      },
    });
  });

  it('subscription with provided optional argument', async () => {
    serverSetup = await createTestServer({
      serverless: `${__dirname}/example/serverless.yml`,
    });
    const client = connectTestServer(serverSetup, AWSAppSyncClient);
    const clientTwo = connectTestServer(serverSetup, AWSAppSyncClient);
    const query = gql`
      subscription subscribeWithOptionalArgument($commodity: String) {
        subscribeWithOptionalArgument(commodity: $commodity) {
          id
          commodity
          amount
        }
      }
    `;

    const subscriptionWhichShouldBePublished = await clientTwo.subscribe({
      query,
      variables: {
        commodity: 'foo',
      },
    });
    const subscriptionWhichShouldNotBePublished = await client.subscribe({
      query,
      variables: {
        commodity: 'bar',
      },
    });

    const subscriptionPayloadPromise = getPromiseForNextSubscriptionEvent(
      subscriptionWhichShouldNotBePublished,
    );
    const subscriptionPayloadPromiseTwo = getPromiseForNextSubscriptionEvent(
      subscriptionWhichShouldBePublished,
    );

    await mutate(client);

    expect(await subscriptionPayloadPromiseTwo).toMatchObject({
      data: {
        subscribeWithOptionalArgument: {
          commodity: 'foo',
          amount: 100.5,
        },
      },
    });

    expect(isPromisePending(subscriptionPayloadPromise)).toEqual(true);
  });

  it('subscription with provided required argument', async () => {
    serverSetup = await createTestServer({
      serverless: `${__dirname}/example/serverless.yml`,
    });
    const client = connectTestServer(serverSetup, AWSAppSyncClient);
    const clientTwo = connectTestServer(serverSetup, AWSAppSyncClient);
    const query = gql`
      subscription subscribeWithRequiredArgument($commodity: String!) {
        subscribeWithRequiredArgument(commodity: $commodity) {
          id
          commodity
          amount
        }
      }
    `;

    const subscriptionWhichShouldBePublished = await client.subscribe({
      query,
      variables: {
        commodity: 'foo',
      },
    });
    const subscriptionWhichShouldNotBePublished = await clientTwo.subscribe({
      query,
      variables: {
        commodity: 'bar',
      },
    });

    const subscriptionPayloadPromise = getPromiseForNextSubscriptionEvent(
      subscriptionWhichShouldBePublished,
    );
    const subscriptionPayloadPromiseTwo = getPromiseForNextSubscriptionEvent(
      subscriptionWhichShouldNotBePublished,
    );

    await mutate(client);

    expect(await subscriptionPayloadPromise).toMatchObject({
      data: {
        subscribeWithRequiredArgument: {
          commodity: 'foo',
          amount: 100.5,
        },
      },
    });

    expect(isPromisePending(subscriptionPayloadPromiseTwo)).toEqual(true);
  });

  it('subscription with both argument types provided', async () => {
    serverSetup = await createTestServer({
      serverless: `${__dirname}/example/serverless.yml`,
    });
    const client = connectTestServer(serverSetup, AWSAppSyncClient);
    const clientTwo = connectTestServer(serverSetup, AWSAppSyncClient);
    const query = gql`
      subscription subscribeWithBothArgumentTypes(
        $commodity: String!
        $amount: Float
      ) {
        subscribeWithBothArgumentTypes(commodity: $commodity, amount: $amount) {
          id
          commodity
          amount
        }
      }
    `;

    const subscriptionWhichShouldGetPublished = await client.subscribe({
      query,
      variables: {
        commodity: 'foo',
        amount: 100.5,
      },
    });
    const subscriptionWhichShouldNotGetPublished = await clientTwo.subscribe({
      query,
      variables: {
        commodity: 'foo',
        amount: 100,
      },
    });
    const subscriptionPayloadPromise = getPromiseForNextSubscriptionEvent(
      subscriptionWhichShouldGetPublished,
    );
    const subscriptionPayloadPromiseTwo = getPromiseForNextSubscriptionEvent(
      subscriptionWhichShouldNotGetPublished,
    );

    await mutate(client);

    expect(await subscriptionPayloadPromise).toMatchObject({
      data: {
        subscribeWithBothArgumentTypes: {
          commodity: 'foo',
          amount: 100.5,
        },
      },
    });

    expect(isPromisePending(subscriptionPayloadPromiseTwo)).toEqual(true);
  });
});
