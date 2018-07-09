const {
  create: createTestServer,
  connect: connectTestServer,
} = require('../tester');
const gql = require('graphql-tag');

const { AWSAppSyncClient } = require('aws-appsync');
// eslint-disable-next-line
global.fetch = require('node-fetch');

describe('appasync-emulator-serverless/tester', () => {
  let serverSetup;
  beforeEach(async () => {
    jest.setTimeout(60 * 1000);
    serverSetup = await createTestServer({
      serverless: `${__dirname}/example/serverless.yml`,
    });
  });

  afterEach(async () => serverSetup.close());

  it('client interactions', async () => {
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
  });
});
