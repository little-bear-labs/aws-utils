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
