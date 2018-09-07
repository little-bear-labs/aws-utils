const { loadServerlessConfig } = require('./loadServerlessConfig');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid/v4');
const { createSchema: createSchemaCore } = require('./schema');
const { PubSub } = require('graphql-subscriptions');
const { wrapSchema } = require('./schemaWrapper');

const setupDocumentDB = async (serverlessConfig, appSyncConfig, dynamodb) => {
  const {
    resources: { Resources: resources },
  } = serverlessConfig;
  const resourceTables = Object.values(resources)
    .filter(resource => resource.Type === 'AWS::DynamoDB::Table')
    .reduce(
      (sum, resource) => ({
        ...sum,
        [resource.Properties.TableName]: resource,
      }),
      {},
    );

  const { dataSources = [] } = appSyncConfig;
  const appSyncTables = dataSources.filter(
    source => source.type === 'AMAZON_DYNAMODB',
  );

  const list = await Promise.all(
    appSyncTables.map(async ({ config: { tableName } }) => {
      const testName = uuid();
      const resourceConfig = resourceTables[tableName];
      const tableConfig = {
        ...resourceConfig.Properties,
        TableName: testName,
      };
      await dynamodb.createTable(tableConfig).promise();
      return { testName, tableName };
    }),
  );

  return list.reduce(
    (sum, { testName, tableName }) => ({
      ...sum,
      [tableName]: testName,
    }),
    {},
  );
};

const createSchema = async ({
  serverless,
  schemaPath = null,
  dynamodb,
} = {}) => {
  const {
    config: serverlessConfig,
    directory: serverlessDirectory,
  } = await loadServerlessConfig(serverless);
  assert(serverlessConfig, 'must have config');
  assert(serverlessDirectory, 'must have serverless directory');

  // eslint-disable-next-line
  schemaPath = schemaPath || path.join(serverlessDirectory, 'schema.graphql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`schema file: ${schemaPath} must exist`);
  }

  const graphqlSchema = wrapSchema(fs.readFileSync(schemaPath, 'utf8'));
  const { custom: { appSync: appSyncConfig } = {} } = serverlessConfig;

  const dynamodbTables = await setupDocumentDB(
    serverlessConfig,
    appSyncConfig,
    dynamodb,
  );

  const pubsub = new PubSub();
  const { schema, subscriptions } = await createSchemaCore({
    dynamodb,
    dynamodbTables,
    graphqlSchema,
    serverlessDirectory,
    serverlessConfig,
    pubsub,
  });

  const close = async () =>
    Promise.all(
      Object.values(dynamodbTables).map(async table =>
        dynamodb.deleteTable({ TableName: table }).promise(),
      ),
    );

  return {
    schema,
    dynamodb,
    pubsub,
    subscriptions,
    tables: dynamodbTables,
    close,
  };
};

module.exports = { createSchema };
