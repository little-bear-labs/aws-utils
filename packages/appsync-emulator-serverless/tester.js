const assert = require('assert');
const { createSchema } = require('./schemaTest');
const createServerCore = require('./serverCore');
const testJWT = require('./testJWT');

const create = async ({ serverless, schemaPath, port = 0 } = {}) => {
  const {
    pubusb,
    subscriptions,
    schema,
    close: schemaClose,
  } = await createSchema({
    serverless,
    schemaPath,
  });
  const { url, mqttServer, mqttURL, server } = await createServerCore({
    port,
    pubusb,
    schema,
    subscriptions,
  });

  const close = () => {
    mqttServer.close();
    server.close();
    return schemaClose();
  };

  return {
    close,
    url,
    mqttServer,
    mqttURL,
    schema,
    server,
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
      jwtToken: () => testJWT.string,
    },
    ...configs,
  });
};

module.exports = { create, connect };
