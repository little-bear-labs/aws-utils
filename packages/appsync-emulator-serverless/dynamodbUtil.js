const path = require('path');
const util = require('util');
const { DynamoDB } = require('aws-sdk');

async function deriveDynamoDBClient(
  { DynamoDB: config },
  emulatorPath = process.cwd(),
) {
  if (config === false) {
    // if false, we assume dynamo is not needed
    return null;
  } else if (!config.emulator) {
    // if emulator is false, we create a client based on the config object
    /* eslint-disable no-console */
    console.log('dynamodb config: ', util.inspect(config, false, 2, true));
    return new DynamoDB(config);
  }

  // start the dynamodb emulator
  const dynamoEmulator = require('@conduitvc/dynamodb-emulator');
  const dbPath = path.join(path.dirname(emulatorPath), '.dynamodb');
  const { port } = config;
  const emulator = await dynamoEmulator.launch({
    dbPath,
    port,
  });
  console.log(`dynamodb emulator port: ${port}, dbPath: ${dbPath}`);
  process.on('SIGINT', () => {
    // _ensure_ we do not leave java processes lying around.
    emulator.terminate().then(() => {
      process.exit(0);
    });
  });
  return dynamoEmulator.getClient(emulator);
}

module.exports = {
  deriveDynamoDBClient,
};
