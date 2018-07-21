const {
  DynamoDB: { Converter },
} = require('aws-sdk');

const nullIfEmpty = obj => (Object.keys(obj).length === 0 ? null : obj);

const unmarshall = (raw, isRaw = true) => {
  const content = isRaw ? Converter.unmarshall(raw) : raw;

  // because of the funky set type used in the aws-sdk we need to further unwrap
  // to find if there is a set that needs to be unpacked into an array.
  if (content && typeof content === 'object' && content.wrapperName === 'Set') {
    return content.values;
  }

  if (content && typeof content === 'object') {
    return Object.entries(content).reduce(
      (sum, [key, value]) => ({
        ...sum,
        [key]: unmarshall(value, false),
      }),
      {},
    );
  }

  if (Array.isArray(content)) {
    return content.map(value => unmarshall(value, false));
  }

  return content;
};

const getItem = async (db, table, { key, consistentRead = false }) => {
  const result = await db
    .getItem({
      TableName: table,
      Key: key,
      ConsistentRead: consistentRead,
    })
    .promise();

  if (!result.Item) return null;
  return unmarshall(result.Item);
};

const putItem = async (
  db,
  table,
  {
    key,
    attributeValues,
    condition: {
      // we only provide limited support for condition update expressions.
      expression,
      expressionNames,
      expressionValues,
    } = {},
  },
) => {
  await db
    .putItem({
      TableName: table,
      Item: {
        ...attributeValues,
        ...key,
      },
      ConditionExpression: expression,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
    })
    .promise();

  // put does not return us anything useful so we need to fetch the object.

  return getItem(db, table, { key, consistentRead: true });
};

const updateItem = async (
  db,
  table,
  { key, update = {}, condition = {} } = {},
) => {
  const params = {
    TableName: table,
    Key: key,
    UpdateExpression: update.expression,
    ConditionExpression: condition.expression,
    ExpressionAttributeNames: nullIfEmpty({
      ...(condition.expressionNames || {}),
      ...update.expressionNames,
    }),
    ExpressionAttributeValues: nullIfEmpty({
      ...(condition.expressionValues || {}),
      ...update.expressionValues,
    }),
    ReturnValues: 'ALL_NEW',
  };

  const { Attributes: updated } = await db.updateItem(params).promise();
  return unmarshall(updated);
};
const deleteItem = async (
  db,
  table,
  {
    key,
    condition: {
      // we only provide limited support for condition update expressions.
      expression,
      expressionNames,
      expressionValues,
    } = {},
  },
) => {
  await db
    .deleteItem({
      TableName: table,
      Key: key,
      ConditionExpression: expression,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
    })
    .promise();
};

const query = async (
  db,
  table,
  {
    query: keyCondition = {},
    filter = {},
    index,
    nextToken,
    limit,
    scanIndexForward = true,
    consistentRead = false,
    select,
  },
) => {
  const params = {
    TableName: table,
    KeyConditionExpression: keyCondition.expression,
    FilterExpression: filter.expression,
    ExpressionAttributeNames: {
      ...(filter.expressionNames || {}),
      ...(keyCondition.expressionNames || {}),
    },
    ExpressionAttributeValues: {
      ...(filter.expressionValues || {}),
      ...(keyCondition.expressionValues || {}),
    },
    // XXX: need to validate that this works ...
    ExclusiveStartKey: nextToken,
    IndexName: index,
    Limit: limit,
    ConsistentRead: consistentRead,
    ScanIndexForward: scanIndexForward,
    Select: select || 'ALL_ATTRIBUTES',
  };
  const {
    Items: items,
    ScannedCount: scannedCount,
    NextToken: resultNextToken = null,
  } = await db.query(params).promise();

  return {
    items: items.map(item => unmarshall(item)),
    scannedCount,
    nextToken: resultNextToken,
  };
};

const scan = async (
  db,
  table,
  {
    filter,
    index,
    limit,
    consistentRead = false,
    nextToken,
    select,
    totalSegments,
    segment,
  },
) => {
  const params = {
    TableName: table,
    // XXX: need to validate that this works ...
    ExclusiveStartKey: nextToken,
    IndexName: index,
    Limit: limit,
    ConsistentRead: consistentRead,
    Select: select || 'ALL_ATTRIBUTES',
    Segment: segment,
    TotalSegments: totalSegments,
  };
  if (filter) {
    Object.assign(params, {
      FilterExpression: filter.expression,
      ExpressionAttributeNames: {
        ...(filter.expressionNames || undefined),
      },
      ExpressionAttributeValues: {
        ...(filter.expressionValues || undefined),
      },
    });
  }
  const {
    Items: items,
    ScannedCount: scannedCount,
    NextToken: resultNextToken = null,
  } = await db.scan(params).promise();

  return {
    items: items.map(item => unmarshall(item)),
    scannedCount,
    nextToken: resultNextToken,
  };
};

// invert values and keys
const getReverseHash = obj =>
  Object.entries(obj).reduce(
    (sum, [key, value]) => ({
      ...sum,
      [value]: key,
    }),
    {},
  );

const batchGetItem = async (db, dynamodbTables, { tables }) => {
  const RequestItems = Object.entries(tables).reduce(
    (sum, [tableName, { keys: Keys, consistentRead: ConsistentRead }]) => ({
      ...sum,
      [dynamodbTables[tableName]]: {
        Keys,
        ConsistentRead,
      },
    }),
    {},
  );

  const params = { RequestItems };
  const {
    Responses: byTable,
    UnprocessedKeys: unprocessedKeys,
  } = await db.batchGetItem(params).promise();

  const reverseTableAlias = getReverseHash(dynamodbTables);
  const data = Object.entries(byTable).reduce(
    (sum, [table, results]) => ({
      ...sum,
      [reverseTableAlias[table]]: results.map(item => unmarshall(item)),
    }),
    {
      unprocessedKeys,
    },
  );

  return {
    data,
  };
};

const getKeyInformation = async (db, table) => {
  const {
    Table: { KeySchema: keys },
  } = await db.describeTable({ TableName: table }).promise();
  return keys;
};

const getItemsFromBatch = async (db, dynamodbTables, batch) => {
  const tables = Object.keys(batch);

  const resultByTable = await Promise.all(
    tables.map(async table => {
      const realTable = dynamodbTables[table];
      const keys = await getKeyInformation(db, realTable);
      const items = batch[table];
      const records = await Promise.all(
        await items.map(async item => {
          const key = keys.reduce(
            (sum, { AttributeName: attr }) => ({
              [attr]: item[attr],
            }),
            {},
          );

          const { Item } = await db
            .getItem({
              TableName: realTable,
              Key: key,
            })
            .promise();

          if (Object.keys(Item).length === 0) {
            return null;
          }

          return unmarshall(Item);
        }),
      );
      return { table, records };
    }),
  );

  return resultByTable.reduce(
    (sum, { table, records }) => ({
      ...sum,
      [table]: records,
    }),
    {},
  );
};

const batchPutItem = async (db, dynamodbTables, { tables }) => {
  const RequestItems = Object.entries(tables).reduce(
    (sum, [tableName, operations]) => ({
      ...sum,
      [dynamodbTables[tableName]]: operations.map(op => ({
        PutRequest: {
          Item: op,
        },
      })),
    }),
    {},
  );

  const params = { RequestItems };
  const { UnprocessedItems: unprocessedItems } = await db
    .batchWriteItem(params)
    .promise();

  // since the emulator does not support returning the used keys from batchWrite
  // we must manually determine which keys to get and return them.
  const data = await getItemsFromBatch(db, dynamodbTables, tables);
  data.unprocessedItems = unprocessedItems;

  return {
    data,
  };
};

const batchDeleteItem = async (db, dynamodbTables, { tables }) => {
  const RequestItems = Object.entries(tables).reduce(
    (sum, [tableName, operations]) => ({
      ...sum,
      [dynamodbTables[tableName]]: operations.map(op => ({
        DeleteRequest: {
          Key: op,
        },
      })),
    }),
    {},
  );

  // before we delete the information from the db capture it for the result.
  const data = await getItemsFromBatch(db, dynamodbTables, tables);

  const params = { RequestItems };
  const { UnprocessedItems: unprocessedItems } = await db
    .batchWriteItem(params)
    .promise();

  data.unprocessedItems = unprocessedItems;

  return {
    data,
  };
};

const resolve = async (dynamodb, defaultAlias, dynamodbTables, payload) => {
  const table = dynamodbTables[defaultAlias];
  switch (payload.operation) {
    case 'GetItem':
      return getItem(dynamodb, table, payload);
    case 'PutItem':
      return putItem(dynamodb, table, payload);
    case 'UpdateItem':
      return updateItem(dynamodb, table, payload);
    case 'DeleteItem':
      return deleteItem(dynamodb, table, payload);
    case 'Query':
      return query(dynamodb, table, payload);
    case 'Scan':
      return scan(dynamodb, table, payload);
    case 'BatchGetItem':
      return batchGetItem(dynamodb, dynamodbTables, payload);
    case 'BatchPutItem':
      return batchPutItem(dynamodb, dynamodbTables, payload);
    case 'BatchDeleteItem':
      return batchDeleteItem(dynamodb, dynamodbTables, payload);
    default:
      throw new Error(`Unknown operation name: ${payload.operation}`);
  }
};

module.exports = resolve;
