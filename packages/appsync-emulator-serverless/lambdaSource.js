const path = require('path');
const { fork } = require('child_process');
const e2p = require('event-to-promise');
const log = require('logdown')('appsync-emulator:lambdaSource');

const Runner = path.join(__dirname, 'lambdaRunner');
const PythonRunner = path.join(__dirname, 'lambdaRunnerPython');
const RubyRunner = path.join(__dirname, 'lambdaRunnerRuby');
const GoRunner = path.join(__dirname, 'lambdaRunnerGo');
const lambdaSource = async (
  {
    dynamodbEndpoint,
    dynamodbTables,
    serverlessConfig: { functions = {}, custom = {}, provider = {} },
    serverlessDirectory,
  },
  fn,
  { payload },
) => {
  const fnConfig = functions[fn];
  if (!fnConfig) {
    throw new Error(`Cannot find function config for function : ${fn}`);
  }

  // Default to empty string, path.join will resolve this automatically
  let buildPrefix = '';

  // Check if the modulePrefix configuration is set
  if (custom['appsync-emulator'] && custom['appsync-emulator'].buildPrefix) {
    ({ buildPrefix } = custom['appsync-emulator']);
  }

  const [handlerPath, handlerMethod] = fnConfig.handler.split('.');
  const fullPath = path.join(serverlessDirectory, buildPrefix, handlerPath);
  const dynamodbTableAliases = Object.entries(dynamodbTables).reduce(
    (sum, [alias, tableName]) => ({
      ...sum,
      [`DYNAMODB_TABLE_${alias}`]: tableName,
    }),
    {},
  );
  let child = null;

  if (fnConfig.runtime && !fnConfig.runtime.includes('node')) {
    let extHandlerMethod = '';
    let runner = null;
    if (fnConfig.runtime.indexOf('python') >= 0) {
      extHandlerMethod = fn;
      runner = PythonRunner;
    } else if (fnConfig.runtime.indexOf('ruby') >= 0) {
      extHandlerMethod = fn;
      runner = RubyRunner;
    } else if (fnConfig.runtime.indexOf('go') >= 0) {
      extHandlerMethod = fnConfig.handler.split('/').pop();
      runner = GoRunner;
    }

    child = fork(runner, [], {
      env: {
        ...process.env,
        ...dynamodbTableAliases,
        DYNAMODB_ENDPOINT: dynamodbEndpoint,
        ...provider.environment,
        ...fnConfig.environment,
      },
      stdio: [0, 1, 2, 'ipc'],
    });

    child.send({
      serverlessDirectory,
      handlerMethod: extHandlerMethod,
      payload,
    });
  } else {
    const childOptions = {
      env: {
        ...process.env,
        ...dynamodbTableAliases,
        DYNAMODB_ENDPOINT: dynamodbEndpoint,
        ...provider.environment,
        ...fnConfig.environment,
      },
      stdio: [0, 1, 2, 'ipc'],
    };
    if (process.env.SLS_DEBUG) childOptions.execArgv = ['--inspect-brk'];
    child = fork(Runner, [], childOptions);

    child.send({
      module: fullPath,
      handlerPath,
      handlerMethod,
      payload,
    });
  }

  const response = await e2p(child, 'message');

  switch (response.type) {
    case 'error':
      throw response.error;
    case 'success':
      return response.output;
    default:
      log.error('unknown response type', response);
      throw new Error('Unknown response type');
  }
};

module.exports = lambdaSource;
