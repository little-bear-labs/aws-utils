const assert = require('assert');
const { createSchema } = require('./schemaTest');
const createServerCore = require('./serverCore');
const testJWT = require('./testJWT');
const dynamoEmulator = require('@conduitvc/dynamodb-emulator/client');

const create = async ({
  serverless,
  schemaPath,
  port = 0,
  dynamodbConfig = null,
} = {}) => {
  let dynamodb;
  let emulator;

  // when dynamodbConfig is passed to this method
  // instead of spinning up a dynamodb emulator using java
  // we connect to an existing instance provided in dynamodbConfig
  if (dynamodbConfig) {
    const { DynamoDB } = require('aws-sdk');
    dynamodb = new DynamoDB(dynamodbConfig);
  } else {
    // For performance we leverage a single emulator instance per process.
    // To keep things unqiue between runs we use table names which are specific
    // to each invocation of 'create'
    emulator = await dynamoEmulator.launch();
    dynamodb = dynamoEmulator.getClient(emulator);
  }

  const {
    pubusb,
    subscriptions,
    schema,
    close: schemaClose,
    tables,
  } = await createSchema({
    serverless,
    schemaPath,
    dynamodb,
  });
  const { url, mqttServer, mqttURL, server } = await createServerCore({
    port,
    pubusb,
    schema,
    subscriptions,
  });

  const close = async () => {
    server.close();
    // schema deletes tables so we must close the emulator after.
    await schemaClose();
  };

  const terminate = () => emulator && emulator.terminate();

  return {
    close,
    terminate,
    url,
    mqttServer,
    mqttURL,
    schema,
    server,
    dynamoEndpoint: dynamodb.endpoint.href,
    tables,
  };
};

const connect = (
  serverConfig,
  AWSAppSyncClient,
  AUTH_TYPE = 'AMAZON_COGNITO_USER_POOLS',
  configs = {},
) => {
  assert(serverConfig.url, 'must have serverConfig with url');
  assert(AWSAppSyncClient, 'must pass AWSAppSyncClient');

  return new AWSAppSyncClient({
    url: serverConfig.url,
    region: 'us-fake-1',
    disableOffline: true,
    auth: {
      type: AUTH_TYPE,
      jwtToken: testJWT.generateTestJWT(),
    },
    ...configs,
  });
};

module.exports = { create, connect };
