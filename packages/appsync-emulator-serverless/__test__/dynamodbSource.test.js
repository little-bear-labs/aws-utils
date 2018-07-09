const { DynamoDB } = require('aws-sdk');
const uuid = require('uuid/v4');
const subject = require('../dynamodbSource');
const dynamodbEmulator = require('@conduitvc/dynamodb-emulator/client');

describe('dynamodbSource', () => {
  let tableName;
  let emulator;
  let docClient;
  let dynamodb;

  beforeAll(async () => {
    jest.setTimeout(40 * 1000);
    emulator = await dynamodbEmulator.launch();
    dynamodb = dynamodbEmulator.getClient(emulator);
    docClient = new DynamoDB.DocumentClient({ service: dynamodb });
  });

  afterAll(async () => {
    await emulator.terminate();
  });

  beforeEach(async () => {
    tableName = uuid();
    await dynamodb
      .createTable({
        TableName: tableName,
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
          ReadCapacityUnits: 10,
          WriteCapacityUnits: 10,
        },
      })
      .promise();
  });

  afterEach(async () => {
    await dynamodb.deleteTable({
      TableName: tableName,
    });
  });

  const runOp = op =>
    subject(
      dynamodb,
      'MyTable',
      {
        MyTable: tableName,
      },
      op,
    );

  describe('GetItem', () => {
    it('should return null when no objects can be found', async () => {
      const result = await runOp({
        version: '2017-02-28',
        operation: 'GetItem',
        key: {
          id: {
            S: 'foo',
          },
        },
        consistentRead: true,
      });

      expect(result).toBe(null);
    });

    it('should return item when inserted', async () => {
      await docClient
        .put({
          TableName: tableName,
          Item: {
            id: 'foo',
          },
        })
        .promise();
      const result = await runOp({
        version: '2017-02-28',
        operation: 'GetItem',
        key: {
          id: {
            S: 'foo',
          },
        },
        consistentRead: true,
      });

      expect(result).toEqual({ id: 'foo' });
    });
  });

  describe('PutItem', () => {
    it('no conditions', async () => {
      const result = await runOp({
        version: '2017-02-28',
        operation: 'PutItem',
        key: {
          id: {
            S: 'foo',
          },
        },
        attributeValues: {
          bar: {
            S: 'bar',
          },
        },
      });

      const { Item: output } = await docClient
        .get({
          TableName: tableName,
          Key: { id: 'foo' },
        })
        .promise();

      const expected = {
        id: 'foo',
        bar: 'bar',
      };
      expect(output).toEqual(expected);
      expect(result).toEqual(expected);
    });

    it('no conditions', async () => {
      // create the initial object
      await runOp({
        version: '2017-02-28',
        operation: 'PutItem',
        key: {
          id: {
            S: 'foo',
          },
        },
        attributeValues: {
          bar: {
            S: 'bar',
          },
        },
      });

      // use a condition which will fail
      try {
        await runOp({
          version: '2017-02-28',
          operation: 'PutItem',
          key: {
            id: {
              S: 'foo',
            },
          },
          attributeValues: {
            bar: {
              S: 'soupbar',
            },
          },
          condition: {
            expression: 'attribute_not_exists(bar)',
          },
        });
      } catch (err) {
        expect(err.code).toBe('ConditionalCheckFailedException');
        return;
      }
      throw new Error('expected exception');
    });
  });

  describe('UpdateItem', () => {
    it('no conditions', async () => {
      await docClient
        .put({
          TableName: tableName,
          Item: {
            id: 'foo',
          },
        })
        .promise();

      const opOutput = await runOp({
        version: '2017-02-28',
        operation: 'UpdateItem',
        key: {
          id: {
            S: 'foo',
          },
        },
        update: {
          expression: 'set #bar = :bar',
          expressionValues: { ':bar': { S: 'bar' } },
          expressionNames: { '#bar': 'bar' },
        },
      });

      const { Item: output } = await docClient
        .get({
          TableName: tableName,
          Key: { id: 'foo' },
        })
        .promise();

      const expected = {
        id: 'foo',
        bar: 'bar',
      };
      expect(opOutput).toEqual(expected);
      expect(output).toEqual(expected);
    });

    it('with conditions', async () => {
      await docClient
        .put({
          TableName: tableName,
          Item: {
            id: 'foo',
            bar: 'bar',
          },
        })
        .promise();

      // use a condition which will fail
      try {
        await runOp({
          version: '2017-02-28',
          operation: 'UpdateItem',
          key: {
            id: {
              S: 'foo',
            },
          },
          update: {
            expression: 'set #bar = :bar',
            expressionValues: { ':bar': { S: 'bar' } },
            expressionNames: { '#bar': 'bar' },
          },
          condition: {
            expression: '#bar <> :bar',
          },
        });
      } catch (err) {
        expect(err.code).toBe('ConditionalCheckFailedException');
        return;
      }
      throw new Error('expected exception');
    });
  });

  describe('DeleteItem', () => {
    it('should delete item', async () => {
      await docClient
        .put({
          TableName: tableName,
          Item: {
            id: 'foo',
            bar: 'bar',
          },
        })
        .promise();
      await runOp({
        version: '2017-02-28',
        operation: 'DeleteItem',
        key: {
          id: {
            S: 'foo',
          },
        },
        condition: {
          expression: '#bar = :bar',
          expressionValues: { ':bar': { S: 'bar' } },
          expressionNames: { '#bar': 'bar' },
        },
      });

      const { Item: output = null } = await docClient
        .get({
          TableName: tableName,
          Key: { id: 'foo' },
        })
        .promise();
      expect(output).toBe(null);
    });
  });

  describe('Query', () => {
    it('simple match', async () => {
      await docClient
        .put({
          TableName: tableName,
          Item: {
            id: 'foo',
            bar: 'bar',
          },
        })
        .promise();

      const result = await runOp({
        operation: 'Query',
        query: {
          expression: '#id = :id',
          expressionNames: { '#id': 'id' },
          expressionValues: { ':id': { S: 'foo' } },
        },
        filter: {
          expression: '#bar = :bar',
          expressionNames: { '#bar': 'bar' },
          expressionValues: { ':bar': { S: 'bar' } },
        },
      });

      expect(result).toMatchObject({
        scannedCount: 1,
        items: [
          {
            bar: 'bar',
            id: 'foo',
          },
        ],
      });
    });
  });

  describe('Scan', () => {
    it('simple match', async () => {
      await docClient
        .put({
          TableName: tableName,
          Item: {
            id: 'foo',
            bar: 'bar',
          },
        })
        .promise();

      const result = await runOp({
        operation: 'Scan',
        filter: {
          expression: '#bar = :bar',
          expressionNames: { '#bar': 'bar' },
          expressionValues: { ':bar': { S: 'bar' } },
        },
      });
      expect(result).toMatchObject({
        scannedCount: 1,
        items: [
          {
            bar: 'bar',
            id: 'foo',
          },
        ],
      });
    });
  });

  describe('Batch', () => {
    it('BatchGetItem', async () => {
      await docClient
        .put({
          TableName: tableName,
          Item: {
            id: 'foo',
            bar: 'bar',
          },
        })
        .promise();

      const result = await runOp({
        operation: 'BatchGetItem',
        tables: {
          MyTable: {
            keys: [{ id: { S: 'foo' } }],
            consistentRead: true,
          },
        },
      });

      expect(result).toMatchObject({
        data: {
          unprocessedKeys: {},
          MyTable: [
            {
              bar: 'bar',
              id: 'foo',
            },
          ],
        },
      });
    });

    it('BatchPutItem', async () => {
      const result = await runOp({
        operation: 'BatchPutItem',
        tables: {
          MyTable: [
            { id: { S: 'foo' }, value: { S: 'bar' } },
            { id: { S: 'foo2' }, value: { S: 'bar' } },
          ],
        },
      });

      expect(result).toMatchObject({
        data: {
          MyTable: [
            {
              value: 'bar',
              id: 'foo',
            },
            {
              value: 'bar',
              id: 'foo2',
            },
          ],
          unprocessedItems: {},
        },
      });
    });

    it('BatchDeleteItem', async () => {
      await docClient
        .put({
          TableName: tableName,
          Item: {
            id: 'foo',
          },
        })
        .promise();

      const result = await runOp({
        operation: 'BatchDeleteItem',
        tables: {
          MyTable: [{ id: { S: 'foo' } }],
        },
      });

      expect(result).toEqual({
        data: {
          MyTable: [
            {
              id: 'foo',
            },
          ],
          unprocessedItems: {},
        },
      });

      const afterDelete = await docClient
        .get({
          TableName: tableName,
          Key: { id: 'foo' },
        })
        .promise();
      expect(afterDelete).toEqual({});
    });
  });
});
