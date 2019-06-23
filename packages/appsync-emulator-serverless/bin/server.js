#! /usr/bin/env node

// XXX: Hack to enable logging for the cli but not tests.
process.env.APPSYNC_EMULATOR_LOG = 1;

const fs = require('fs');
const path = require('path');
const pkgUp = require('pkg-up');
const { ArgumentParser } = require('argparse');
const createServer = require('../server');
const defaultConfig = require('../config');
const dynamo = require('../dynamoUtil');

const main = async () => {
  const parser = new ArgumentParser({
    version: require('../package.json').version,
    addHelp: true,
    description: 'AWS AppSync Emulator',
  });

  parser.addArgument(['--path'], {
    help:
      'Directory path in which serverless.yml, general config file is configured',
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

  parser.addArgument(['--config'], {
    help:
      'Name of optional configuration file which resides in the same directory as serverless.yml (default is appSyncConfig)',
    type: 'string',
  });
  // argparse converts any argument with a dash to underscores
  // eslint-disable-next-line
  const { ws_port: wsPort } = parser.parseArgs();
  // eslint-disable-next-line
  let {
    port,
    path: serverlessPath,
    config: configFileName,
  } = parser.parseArgs();
  port = port || 0;
  serverlessPath = serverlessPath || process.cwd();
  configFileName = configFileName || 'appSyncConfig';

  const pkgPath = pkgUp.sync(serverlessPath);
  const customConfigFilePath = path.join(serverlessPath, configFileName);
  const hasCustomConfig = await new Promise(resolve => {
    try {
      fs.accessSync(customConfigFilePath);
      resolve(true);
    } catch (e) {
      resolve(false);
    }
  });

  const config = Object.assign(
    {},
    defaultConfig,
    // eslint-disable-next-line import/no-dynamic-require
    hasCustomConfig ? require(customConfigFilePath) : {},
  );
  const dynamodb = await dynamo.deriveDynamoClient(config, pkgPath);

  const serverless = path.join(path.dirname(pkgPath), 'serverless.yml');
  const server = await createServer({ wsPort, serverless, port, dynamodb });
  // eslint-disable-next-line no-console
  console.log('started at url:', server.url);
};

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
