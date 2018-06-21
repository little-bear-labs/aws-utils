#! /usr/bin/env node

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

  let { port, path: serverlessPath } = parser.parseArgs();
  port = port || 0;
  serverlessPath = serverlessPath || process.cwd();

  // start the dynamodb emulator
  const pkgPath = pkgUp.sync(serverlessPath);
  const emulator = await dynamoEmulator.launch({
    dbPath: path.join(path.dirname(pkgPath), '.dynamodb'),
  });
  process.on('SIGINT', () => {
    // _ensure_ we do not leave java processes lying around.
    emulator.terminate().then(() => {
      process.exit(0);
    });
  });
  const dynamodb = dynamoEmulator.getClient(emulator);

  const serverless = path.join(path.dirname(pkgPath), 'serverless.yml');
  const server = await createServer({ serverless, port, dynamodb });
  console.log('started at url:', server.url);
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
