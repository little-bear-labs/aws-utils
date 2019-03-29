const { loadServerlessConfig } = require('./loadServerlessConfig');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid/v4');
const { createSchema: createSchemaCore } = require('./schema');
const { PubSub } = require('graphql-subscriptions');
const { wrapSchema } = require('./schemaWrapper');
const { cloudFormationProcessor } = require('./cloudFormationProcessor');

const createDBNames = async (serverlessConfig, dynamodb) => {
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

  const list = await Promise.all(
    Object.values(resourceTables).map(async ({ Properties: props }) => {
      const testName = uuid();
      const tableConfig = {
        ...props,
        TableName: testName,
      };
      await dynamodb.createTable(tableConfig).promise();
      return { testName, tableName: props.TableName };
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
  const dynamodbTables = await createDBNames(
    // process serverless config through CF in case we're using some to craft table names.
    cloudFormationProcessor(serverlessConfig, { dynamodbTables: {} }),
    dynamodb,
  );
  // process serverless config again with our aliases.
  const cfConfig = cloudFormationProcessor(serverlessConfig, {
    dynamodbTables,
  });

  const pubsub = new PubSub();
  const { schema, subscriptions } = await createSchemaCore({
    dynamodb,
    dynamodbTables,
    graphqlSchema,
    serverlessDirectory,
    serverlessConfig: cfConfig,
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
