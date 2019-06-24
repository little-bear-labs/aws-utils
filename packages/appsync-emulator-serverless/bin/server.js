#! /usr/bin/env node

// XXX: Hack to enable logging for the cli but not tests.
process.env.APPSYNC_EMULATOR_LOG = 1;

const fs = require('fs');
const path = require('path');
const pkgUp = require('pkg-up');
const { ArgumentParser } = require('argparse');
const { deriveDynamoDBClient } = require('../dynamodbUtil');
const defaultConfig = require('../config');
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

  parser.addArgument(['--config'], {
    help:
      'Name of optional configuration file which resides in the same directory as serverless.yml (default is appSyncConfig)',
    type: 'string',
  });

  // argparse converts any argument with a dash to underscores
  // eslint-disable-next-line
  const { config: configFileName, ws_port: wsPort } = parser.parseArgs();
  // eslint-disable-next-line
  let {
    dynamodb_port: dynamodbPort,
    port,
    path: serverlessPath,
  } = parser.parseArgs();
  port = port || 0;
  serverlessPath = serverlessPath || process.cwd();
  dynamodbPort = dynamodbPort || null;

  // start the dynamodb emulator
  const pkgPath = pkgUp.sync(serverlessPath);
  const customConfigFilePath = path.join(
    serverlessPath,
    configFileName || 'appSyncConfig',
  );
  const hasCustomConfig = await new Promise(resolve => {
    try {
      fs.accessSync(`${customConfigFilePath}.js`);
      resolve(true);
    } catch (e) {
      resolve(false);
    }
  });
  const config = hasCustomConfig
    ? // eslint-disable-next-line import/no-dynamic-require
      require(customConfigFilePath)
    : defaultConfig;
  const dynamodb = await deriveDynamoDBClient(config, pkgPath, dynamodbPort);

  const serverless = path.join(path.dirname(pkgPath), 'serverless.yml');
  createServer({ wsPort, serverless, port, dynamodb });
};

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
