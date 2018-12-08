#! /usr/bin/env node

// XXX: Hack to enable logging for the cli but not tests.
process.env.APPSYNC_EMULATOR_LOG = 1;

const fs = require('fs');
const path = require('path');
const pkgUp = require('pkg-up');
const { ArgumentParser } = require('argparse');
const dynamoEmulator = require('@conduitvc/dynamodb-emulator');
const createServer = require('../server');

const main = async () => {
  const parser = new ArgumentParser({
    version: require('../package.json').version,
    addHelp: true,
    description: 'AWS AppSync Emulator',
  });

  parser.addArgument(['--path'], {
    help: 'Directory path in which serverless.yml is configured',
    type: serverlessPath => {
      // eslint-disable-next-line
      serverlessPath = path.resolve(serverlessPath);
      if (!fs.existsSync(serverlessPath)) {
        throw new Error(`${serverlessPath} does not exist`);
      }
      return serverlessPath;
    },
  });

  parser.addArgument(['-p', '--port'], {
    help: 'Port to bind the emulator to',
    type: 'int',
  });

  parser.addArgument(['-wsp', '--ws-port'], {
    help: 'Port to bind emulator subscriptions',
    type: 'int',
  });

  parser.addArgument(['--dynamodb-port'], {
    help: 'Port to bind the dynamodb to (default is any free port)',
    type: 'int',
  });
  // argparse converts any argument with a dash to underscores
  // eslint-disable-next-line
  let { ws_port: wsPort, port, path: serverlessPath, dynamodb_port: dynamodbPort } = parser.parseArgs();
  port = port || 0;
  serverlessPath = serverlessPath || process.cwd();
  dynamodbPort = dynamodbPort || null;

  // start the dynamodb emulator
  const pkgPath = pkgUp.sync(serverlessPath);
  const emulator = await dynamoEmulator.launch({
    dbPath: path.join(path.dirname(pkgPath), '.dynamodb'),
    port: dynamodbPort,
  });
  process.on('SIGINT', () => {
    // _ensure_ we do not leave java processes lying around.
    emulator.terminate().then(() => {
      process.exit(0);
    });
  });
  const dynamodb = dynamoEmulator.getClient(emulator);

  const serverless = path.join(path.dirname(pkgPath), 'serverless.yml');
  const server = await createServer({ wsPort, serverless, port, dynamodb });
  // eslint-disable-next-line no-console
  console.log('started at url:', server.url);
  if (dynamodbPort) {
    /* eslint-disable no-console */
    console.log(
      `dynamodb config:
    {
      endpoint: 'http://localhost:${dynamodbPort}',
      region: 'us-fake-1',
      accessKeyId: 'fake',
      secretAccessKey: 'fake',
    }`,
    );
  }
};

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
