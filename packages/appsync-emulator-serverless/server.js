const { findServerlessPath } = require('@conduitvc/aws-utils/findServerless');
const { loadServerlessConfig } = require('./loadServerlessConfig');
const { PubSub } = require('graphql-subscriptions');
const fs = require('fs');
const path = require('path');
const { createSchema: createSchemaCore } = require('./schema');
const createServerCore = require('./serverCore');
const log = require('logdown')('appsync-emulator:server');
const { wrapSchema } = require('./schemaWrapper');
const { cloudFormationProcessor } = require('./cloudFormationProcessor');

const ensureDynamodbTables = async (
  dynamodb,
  serverlessConfig,
  appSyncConfig,
) => {
  const { dataSources } = appSyncConfig;
  const { resources: { Resources: resources = {} } = {} } = serverlessConfig;

  await Promise.all(
    Object.values(resources)
      .filter(resource => resource.Type === 'AWS::DynamoDB::Table')
      .map(async resource => {
        const { Properties: params } = resource;
        try {
          log.info('creating table', params);
          await dynamodb.createTable(params).promise();
        } catch (err) {
          if (err.code !== 'ResourceInUseException') throw err;
        }
      }),
  );

  return dataSources.filter(source => source.type === 'AMAZON_DYNAMODB').reduce(
    (sum, source) => ({
      ...sum,
      [source.config.tableName]: source.config.tableName,
    }),
    {},
  );
};

const createSchema = async ({
  serverless,
  schemaPath = null,
  pubsub,
  dynamodb,
} = {}) => {
  let serverlessConfig = {};
  let serverlessDirectory;
  if (typeof serverless === 'object') {
    serverlessConfig = serverless.service;
    serverlessDirectory = serverless.config.servicePath;
  } else {
    serverlessDirectory =
      typeof serverless === 'string'
        ? path.dirname(serverless)
        : findServerlessPath();
    const config = await loadServerlessConfig(serverlessDirectory);
    serverlessConfig = config.config;
  }

  const cfConfig = cloudFormationProcessor(serverlessConfig, {
    // we do not use aliases for the dynamodb tables in server like we do in testing.
    dynamodbTables: {},
  });

  // eslint-disable-next-line
  schemaPath = schemaPath || path.join(serverlessDirectory, 'schema.graphql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`schema file: ${schemaPath} must exist`);
  }

  const graphqlSchema = wrapSchema(fs.readFileSync(schemaPath, 'utf8'));
  const { custom: { appSync: appSyncConfig } = {} } = cfConfig;
  const dynamodbTables = await ensureDynamodbTables(
    dynamodb,
    cfConfig,
    appSyncConfig,
  );

  return createSchemaCore({
    dynamodb,
    dynamodbTables,
    graphqlSchema,
    serverlessDirectory,
    serverlessConfig: cfConfig,
    pubsub,
  });
};

const createServer = async ({
  wsPort,
  port,
  dynamodb,
  ...createSchemaOpts
}) => {
  const pubsub = new PubSub();
  const { schema, subscriptions } = await createSchema({
    ...createSchemaOpts,
    dynamodb,
    pubsub,
  });

  return createServerCore({
    wsPort,
    port,
    pubsub,
    schema,
    subscriptions,
  });
};

module.exports = createServer;
