const { deriveDynamoDBClient } = require('../dynamodbUtil');

describe('dynamoUtil', () => {
  beforeAll(async () => {
    jest.setTimeout(40 * 1000);
  });

  it('supports no dynamo', async () => {
    const client = await deriveDynamoDBClient({ DynamoDB: false });
    expect(client).toBeNull();
  });

  it('supports third party instance', async () => {
    const client = await deriveDynamoDBClient({
      DynamoDB: {
        endpoint: 'http://localhost:61023',
        accessKeyId: 'fake',
        secretAccessKey: 'fake',
        region: 'fake',
      },
    });
    expect(client).toBeTruthy();
  });

  it('supports local emulation', async () => {
    const client = await deriveDynamoDBClient({
      DynamoDB: {
        emulator: true,
      },
    });
    expect(client).toBeTruthy();
  });
});
