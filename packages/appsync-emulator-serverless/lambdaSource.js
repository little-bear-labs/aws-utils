const path = require('path');
const { fork } = require('child_process');
const e2p = require('event-to-promise');

const Runner = path.join(__dirname, 'lambdaRunner');

const lambdaSource = async (
  { serverlessConfig: { functions }, serverlessDirectory },
  fn,
  { payload },
) => {
  const fnConfig = functions[fn];
  if (!fnConfig) {
    throw new Error(`Cannot find function config for function : ${fn}`);
  }

  const [handlerPath, handlerMethod] = fnConfig.handler.split('.');
  const fullPath = path.join(serverlessDirectory, handlerPath);

  const child = fork(Runner, [], {
    stdio: [0, 1, 2, 'ipc'],
  });
  child.send({
    module: fullPath,
    handlerPath,
    handlerMethod,
    payload,
  });

  const response = await e2p(child, 'message');

  switch (response.type) {
    case 'error':
      throw response.error;
    case 'success':
      return response.output;
    default:
      console.error('unknown response type', response);
      throw new Error('Unknown response type');
  }
};

module.exports = lambdaSource;
