const { create, connect } = require('./tester');
const { AWSAppSyncClient } = require('aws-appsync');

function jest() {
  const state = {};

  beforeEach(async () => {
    state.server = await create();
    state.client = connect(state.server, AWSAppSyncClient);
  });

  afterEach(async () => state.server.close());
  afterAll(async () => state.server.terminate());

  return state;
}

module.exports = jest;
