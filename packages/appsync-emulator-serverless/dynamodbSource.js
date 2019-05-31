const {
  DynamoDB: { Converter },
} = require('aws-sdk');
const isEqual = require('lodash.isequal'); // TODO: hoist

const nullIfEmpty = obj => (Object.keys(obj).length === 0 ? null : obj);

const unmarshall = (raw, isRaw = true) => {
  const content = isRaw ? Converter.unmarshall(raw) : raw;

  // Because of the funky set type used in the aws-sdk, we need to further unwrap
  // to find if there is a set that needs to be unpacked into an array.

  // Unwrap sets
  if (content && typeof content === 'object' && content.wrapperName === 'Set') {
    return content.values;
  }

  // Unwrap lists
  if (Array.isArray(content)) {
    return content.map(value => unmarshall(value, false));
  }

  // Unwrap maps
  if (content && typeof content === 'object') {
    return Object.entries(content).reduce(
      (sum, [key, value]) => ({
        ...sum,
        [key]: unmarshall(value, false),
      }),
      {},
    );
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
      conditionalCheckFailedHandler,
      equalsIgnore,
    } = {},
  },
) => {
  try {
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

    return await getItem(db, table, { key, consistentRead: true });
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      // not an error if PutItem would not have had any effect
      let oldValues = {};
      try {
        oldValues = await getItem(db, table, { key, consistentRead: true });
      } catch (ignore) {
        /* ignore */
      }

      const shouldBeValues = unmarshall({ ...attributeValues, ...key });
      const ignoreKeys = equalsIgnore || [];

      if (
        isEqual(
          Object.entries(oldValues).reduce((newObject, [k, v]) => {
            if (ignoreKeys.indexOf(k) === -1) return { ...newObject, [k]: v };
            return newObject;
          }, {}),
          Object.entries(shouldBeValues).reduce((newObject, [k, v]) => {
            if (ignoreKeys.indexOf(k) === -1) return { ...newObject, [k]: v };
            return newObject;
          }, {}),
        )
      )
        return Promise.resolve(oldValues);

      if (
        conditionalCheckFailedHandler &&
        conditionalCheckFailedHandler.strategy !== 'Reject'
      ) {
        // if there is a custom check-failed handler pass oldValues up to give the caller a chance to call conditionalCheckFailedHandler
        err.oldValues = oldValues;
      }
    }
    throw err;
  }
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
  const { Attributes: deleted } = await db
    .deleteItem({
      TableName: table,
      Key: key,
      ReturnValues: 'ALL_OLD',
      ConditionExpression: expression,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
    })
    .promise();

  return unmarshall(deleted);
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
    ExpressionAttributeNames: nullIfEmpty({
      ...(filter.expressionNames || {}),
      ...(keyCondition.expressionNames || {}),
    }),
    ExpressionAttributeValues: {
      ...(filter.expressionValues || {}),
      ...(keyCondition.expressionValues || {}),
    },
    // XXX: need to validate that this works ...
    ExclusiveStartKey: nextToken
      ? JSON.parse(Buffer.from(nextToken, 'base64').toString())
      : null,
    IndexName: index,
    Limit: limit,
    ConsistentRead: consistentRead,
    ScanIndexForward: scanIndexForward,
    Select: select || 'ALL_ATTRIBUTES',
  };
  const {
    Items: items,
    ScannedCount: scannedCount,
    LastEvaluatedKey: resultNextToken = null,
  } = await db.query(params).promise();

  return {
    items: items.map(item => unmarshall(item)),
    scannedCount,
    nextToken: resultNextToken
      ? Buffer.from(JSON.stringify(resultNextToken)).toString('base64')
      : null,
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
    ExclusiveStartKey: nextToken
      ? JSON.parse(Buffer.from(nextToken, 'base64').toString())
      : null,
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
      ExpressionAttributeNames: nullIfEmpty({
        ...(filter.expressionNames || undefined),
      }),
      ExpressionAttributeValues: {
        ...(filter.expressionValues || undefined),
      },
    });
  }
  const {
    Items: items,
    ScannedCount: scannedCount,
    LastEvaluatedKey: resultNextToken = null,
  } = await db.scan(params).promise();

  return {
    items: items.map(item => unmarshall(item)),
    scannedCount,
    nextToken: resultNextToken
      ? Buffer.from(JSON.stringify(resultNextToken)).toString('base64')
      : null,
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

const resolve = async (dynamodb, table, dynamodbTables, payload) => {
  switch (payload.operation) {
    case 'GetItem':
      return getItem(dynamodb, dynamodbTables[table], payload);
    case 'PutItem':
      return putItem(dynamodb, dynamodbTables[table], payload);
    case 'UpdateItem':
      return updateItem(dynamodb, dynamodbTables[table], payload);
    case 'DeleteItem':
      return deleteItem(dynamodb, dynamodbTables[table], payload);
    case 'Query':
      return query(dynamodb, dynamodbTables[table], payload);
    case 'Scan':
      return scan(dynamodb, dynamodbTables[table], payload);
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
