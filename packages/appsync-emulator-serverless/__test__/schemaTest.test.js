const { createSchema } = require('../schemaTest');
const { graphql } = require('graphql');
const { subscribe } = require('graphql/subscription');
const gql = require('graphql-tag');
const { decoded: jwt } = require('../testJWT');
const nock = require('nock');
const dynamodbEmulator = require('@conduitvc/dynamodb-emulator/client');

const getScalarSource = (field, val) => `
  query {
      ${field}(${field}: "${val}")
  }
`;

const expectScalarResult = (result, field, val) =>
  expect(result).toMatchObject({ data: { [field]: val } });

describe('creates executable schema', () => {
  const serverless = `${__dirname}/example/serverless.yml`;
  const schemaPath = `${__dirname}/example/schema.graphql`;
  let contextValue;

  let emulator;
  let dynamodb;
  beforeAll(async () => {
    jest.setTimeout(40 * 1000);
    emulator = await dynamodbEmulator.launch();
    dynamodb = dynamodbEmulator.getClient(emulator);
  });

  afterAll(async () => {
    await emulator.terminate();
  });
  // eslint-disable-next-line
  let schema, close;
  beforeEach(async () => {
    const result = await createSchema({ serverless, schemaPath, dynamodb });
    // eslint-disable-next-line
    schema = result.schema;
    // eslint-disable-next-line
    close = result.close;
    contextValue = { jwt };
  });
  afterEach(async () => close());

  describe('support http', () => {
    beforeEach(async () => {
      const result = await createSchema({ serverless, schemaPath, dynamodb });
      // eslint-disable-next-line
      schema = result.schema;
      // eslint-disable-next-line
      close = result.close;
      contextValue = { jwt };

      nock('http://localhost:3000')
        .get('/api/users')
        .reply(200, {
          data: [{ name: 'Name1' }, { name: 'Name2' }],
        });

      nock('http://localhost:3000')
        .get('/api/posts/Name1')
        .reply(200, {
          data: [{ title: 'Post1' }],
        });

      nock('http://localhost:3000')
        .get('/api/posts/Name2')
        .reply(200, {
          data: [{ title: 'Post2' }],
        });
    });

    it('should allow querying http', async () => {
      const source = `
        query {
          httpUsers {
            name
          }
        }
      `;

      const result = await graphql({
        schema,
        contextValue,
        source,
      });

      expect(result).toMatchObject({
        data: {
          httpUsers: [
            {
              name: 'Name1',
            },
            {
              name: 'Name2',
            },
          ],
        },
      });
    });

    it('it should allow using context.source', async () => {
      const source = `
        query {
          httpUsers {
            name
            posts {
              title
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        contextValue,
        source,
      });

      expect(result).toMatchObject({
        data: {
          httpUsers: [
            {
              name: 'Name1',
              posts: [
                {
                  title: 'Post1',
                },
              ],
            },
            {
              name: 'Name2',
              posts: [
                {
                  title: 'Post2',
                },
              ],
            },
          ],
        },
      });
    });
  });

  it('put', async () => {
    const subscription = await subscribe({
      schema,
      document: gql`
        subscription test {
          subscribeToPutQuoteRequest {
            id
            commodity
            amount
          }
        }
      `,
      contextValue,
    });

    const insertResult = await graphql({
      schema,
      source: `
        mutation test($input: QuoteRequestInput!) {
          putQuoteRequest(input: $input) {
            id
            commodity
            amount
          }
        }
      `,
      variableValues: {
        input: {
          commodity: 'foo',
          amount: 100.5,
        },
      },
      contextValue,
    });

    expect(insertResult).toMatchObject({
      data: {
        putQuoteRequest: {
          commodity: 'foo',
          amount: 100.5,
        },
      },
    });

    const subscriptionItem = await subscription.next();
    expect(subscriptionItem).toMatchObject({
      value: {
        data: {
          subscribeToPutQuoteRequest: {
            commodity: 'foo',
            amount: 100.5,
          },
        },
      },
      done: false,
    });
  });

  it('should allow querying lambda', async () => {
    const result = await graphql({
      schema,
      contextValue,
      source: `
      query test {
        lambda {
          test
        }
      }
      `,
    });
    expect(result).toMatchObject({ data: { lambda: { test: 'yup' } } });
  });

  it('should have identity with jwt contextValue', async () => {
    const output = await graphql({
      schema,
      contextValue,
      source: `
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
    // we can assert the same thing as we always use the same user.
    expect(output).toMatchObject({
      data: {
        cognitoInfo: {
          sub: '2357be7c-39e0-461e-8d8f-9a7a003c294d',
          issuer:
            'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_27WcML9k8',
          username: 'd9aeaadc-e677-4c65-9d69-a4d6f3a7df86',
          sourceIp: ['0.0.0.0'],
          defaultAuthStrategy: 'ALLOW',
        },
      },
    });
  });

  describe('with an object', () => {
    let id;
    beforeEach(async () => {
      const {
        data: {
          putQuoteRequest: { id: _id },
        },
      } = await graphql({
        schema,
        source: `
          mutation test($input: QuoteRequestInput!) {
            putQuoteRequest(input: $input) {
              id
              commodity
              amount
            }
          }
        `,
        variableValues: {
          input: {
            commodity: 'foo',
            amount: 100.5,
          },
        },
        contextValue,
      });
      id = _id;
    });

    it('by id', async () => {
      const result = await graphql({
        schema,
        contextValue,
        source: `
        query test($id: ID!) {
          QuoteRequestById(id: $id) {
            commodity
            amount
          }
        }
        `,
        variableValues: { id },
      });
      expect(result).toMatchObject({
        data: { QuoteRequestById: { commodity: 'foo', amount: 100.5 } },
      });
    });

    it('scan', async () => {
      const result = await graphql({
        schema,
        contextValue,
        source: `
        query test($query: [AttributeFilter]) {
          QuoteRequest(query: $query) {
            commodity
            amount
          }
        }
        `,
        variableValues: {
          query: [
            {
              expression: '#commodity = :commodity ',
              expressionName: 'commodity',
              expressionStringValue: 'foo',
            },
          ],
        },
      });
      expect(result).toMatchObject({
        data: {
          QuoteRequest: [
            {
              commodity: 'foo',
              amount: 100.5,
            },
          ],
        },
      });
    });

    it('update', async () => {
      const result = await graphql({
        schema,
        contextValue,
        source: `
          mutation test($id: ID!, $input: QuoteRequestInput!) {
            updateQuoteRequest(id: $id, input: $input) {
              id
              commodity
              amount
            }
          }
        `,
        variableValues: {
          id,
          input: {
            commodity: 'nutbar',
            amount: 2.5,
          },
        },
      });
      expect(result).toMatchObject({
        data: {
          updateQuoteRequest: {
            id,
            commodity: 'nutbar',
            amount: 2.5,
          },
        },
      });
    });
  });

  describe('errors', () => {
    it('should return an error for bad dynamodb update', async () => {
      const source = `
        mutation {
          badBatchPutQuotes(
            request: { commodity:"foo", amount:1.00 },
            response:{ offer:"1009", expires:1 }
          ) {
            request { commodity, id }
            response { offer, id }
          }
        }
      `;

      const result = await graphql({
        schema,
        contextValue,
        source,
      });

      expect(result.errors).toHaveLength(1);
    });
  });

  it('should allow erroring out entirely', async () => {
    const source = `
      query {
        error
      }
    `;
    const result = await graphql({
      schema,
      contextValue,
      source,
    });

    expect(result.errors[0]).toMatchObject({
      message: 'No request',
    });

    expect(contextValue.appsyncErrors).toHaveLength(1);
    expect(contextValue.appsyncErrors[0]).toMatchObject({
      // explicitly set in the template.
      message: 'No request',
    });
  });

  it('json support', async () => {
    const source = `
      query {
        jsonTest
      }
    `;

    const result = await graphql({
      schema,
      contextValue,
      source,
    });

    expect(result).toMatchObject({ data: { jsonTest: { test: 'yup' } } });
  });

  it('AWSDate scalar', async () => {
    const field = 'dateTest';
    const val = new Date('05 October 2011').toISOString().split('T')[0];

    const source = getScalarSource(field, val);

    const result = await graphql({
      schema,
      contextValue,
      source,
    });

    expectScalarResult(result, field, val);
  });

  it('AWSTime scalar', async () => {
    const field = 'timeTest';
    const val = new Date('05 October 2011').toISOString().split('T')[1];

    const source = getScalarSource(field, val);

    const result = await graphql({
      schema,
      contextValue,
      source,
    });

    expectScalarResult(result, field, val);
  });

  it('AWSDateTime scalar', async () => {
    const field = 'dateTimeTest';
    const val = new Date('05 October 2011').toISOString();

    const source = getScalarSource(field, val);

    const result = await graphql({
      schema,
      contextValue,
      source,
    });

    expectScalarResult(result, field, val);
  });

  it('AWSEmail scalar', async () => {
    const field = 'emailTest';
    const val = 'foobar@example.com';

    const source = getScalarSource(field, val);

    const result = await graphql({
      schema,
      contextValue,
      source,
    });

    expectScalarResult(result, field, val);
  });

  it('AWSPhone scalar - US', async () => {
    const field = 'phoneTest';
    const val = '123-123-1234';

    const source = getScalarSource(field, val);

    const result = await graphql({
      schema,
      contextValue,
      source,
    });

    expectScalarResult(result, field, val);
  });

  it('AWSPhone scalar - International', async () => {
    const field = 'phoneTest';
    const val = '+44 8984 1234';

    const source = getScalarSource(field, val);

    const result = await graphql({
      schema,
      contextValue,
      source,
    });

    expectScalarResult(result, field, val);
  });

  it('AWSURL scalar', async () => {
    const field = 'urlTest';
    const val = 'http://google.com';

    const source = getScalarSource(field, val);

    const result = await graphql({
      schema,
      contextValue,
      source,
    });

    expectScalarResult(result, field, val);
  });
});
