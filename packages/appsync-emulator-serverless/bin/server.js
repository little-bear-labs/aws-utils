#! /usr/bin/env node

const fs = require('fs');
const path = require('path');
const pkgUp = require('pkg-up');
const { ArgumentParser } = require('argparse');
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

  const pkgPath = pkgUp.sync(serverlessPath);
  const serverless = path.join(path.dirname(pkgPath), 'serverless.yml');
  const server = await createServer({ serverless, port });
  console.log('started at url:', server.url);
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
