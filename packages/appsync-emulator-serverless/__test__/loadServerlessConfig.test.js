const { loadServerlessConfig } = require('../loadServerlessConfig');

describe('loadServerlessConfig', () => {
  it('should parse templates and variables', async () => {
    const dir = `${__dirname}/configExample/`;
    const output = await loadServerlessConfig(dir);

    const {
      config: { provider, custom, resources },
      directory,
    } = output;
    expect(directory).toBe(dir);
    expect({ provider, custom, resources }).toMatchObject({
      provider: {
        stage: 'dev',
        region: 'us-east-2',
        name: 'aws',
        runtime: 'nodejs8.10',
      },
      custom: {
        service: 'file-service',
        assetPutRequestsTable: 'file-service-AssetPutRequests-dev',
        assetsTable: 'file-service-Assets-dev',
        appSync: {
          mappingTemplates: [
            {
              dataSource: 'QuoteRequest',
              type: 'Query',
              field: 'error',
              request: 'error-request.txt',
              response: 'result-response.txt',
            },
            {
              dataSource: 'QuoteRequest',
              type: 'Query',
              field: 'QuoteRequestById',
              request: 'byId-request.txt',
              response: 'result-response.txt',
            },
            {
              dataSource: 'QuoteRequest',
              type: 'Mutation',
              field: 'putQuoteRequest',
              request: 'put-request.txt',
              response: 'result-response.txt',
            },
            {
              dataSource: 'QuoteRequest',
              type: 'Mutation',
              field: 'batchPutQuotes',
              request: 'batchput-request.txt',
              response: 'batchput-response.txt',
            },
          ],
          dataSources: [
            {
              type: 'AMAZON_DYNAMODB',
              name: 'QuoteRequest',
              description: 'QuoteRequest description',
              config: {
                tableName: 'QuoteRequest-emulator',
                serviceRoleArn: 'ARN',
              },
            },
            {
              type: 'AMAZON_DYNAMODB',
              name: 'Response',
              description: 'QuoteResponse description',
              config: {
                tableName: 'QuoteResponse-emulator',
                serviceRoleArn: 'ARN',
              },
            },
            {
              type: 'NONE',
              name: 'SubscriberPassthrough',
              description: 'Non-datasource datasource',
              config: {
                serviceRoleArn: 'ARN',
              },
            },
            {
              type: 'AWS_LAMBDA',
              name: 'TestLambda',
              description: 'Lambda DataSource',
              config: {
                lambdaFunctionArn: 'ARN',
                serviceRoleArn: 'ARN',
                functionName: 'graphql',
              },
            },
          ],
        },
      },
      resources: {
        Resources: {
          AssetsTable: {
            Type: 'AWS::DynamoDB::Table',
            Properties: {
              KeySchema: [
                {
                  AttributeName: 'id',
                  KeyType: 'HASH',
                },
              ],
              AttributeDefinitions: [
                {
                  AttributeName: 'id',
                  AttributeType: 'S',
                },
              ],
              ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1,
              },
              TableName: 'file-service-Assets-dev',
            },
          },
          AssetPutRequestsTable: {
            Type: 'AWS::DynamoDB::Table',
            Properties: {
              KeySchema: [
                {
                  AttributeName: 'id',
                  KeyType: 'HASH',
                },
              ],
              AttributeDefinitions: [
                {
                  AttributeName: 'id',
                  AttributeType: 'S',
                },
              ],
              ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1,
              },
              TableName: 'file-service-AssetPutRequests-dev',
            },
          },
          UserScopesTable: {
            Type: 'AWS::DynamoDB::Table',
            Properties: {
              KeySchema: [
                {
                  AttributeName: 'id',
                  KeyType: 'HASH',
                },
              ],
              AttributeDefinitions: [
                {
                  AttributeName: 'id',
                  AttributeType: 'S',
                },
              ],
              ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1,
              },
              TableName: 'UserScopes',
            },
          },
        },
      },
    });
  });
});
