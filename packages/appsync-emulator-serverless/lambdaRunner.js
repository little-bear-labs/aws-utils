const { promisify } = require('util');
const log = require('logdown')('appsync-emulator:lambdaRunner');
const { create: createUtils } = require('./util');

const sendOutput = output => {
  process.send({ type: 'success', output }, process.exit);
}
const sendErr = err => {
  process.send({ type: 'error', error: err }, process.exit);
};

const run = async ({ lambda, context, payload }) => {
  if (!createUtils().isAsync(lambda)) {
    lambda = promisify(lambda);
  }
  const output = await lambda(payload, context);
  return output;
}

process.once('message', async ({ module, handlerPath, handlerMethod, payload }) => {
  try {
    log.info('load', module);
    // eslint-disable-next-line
    const handlerModule = require(module);
    if (!handlerModule[handlerMethod]) {
      throw new Error(
        `Module : ${handlerPath} does not have export: ${handlerMethod}`,
      );
    }

    log.info('invoke', handlerMethod);
    const lambda = handlerModule[handlerMethod];
    const context = {};
    const output = await run({ lambda, context, payload });
    sendOutput(output);
  } catch (err) {
    sendErr(err);
  }
});

process.on('uncaughtException', err => {
  log.error('uncaughtException in lambda', err);
  process.exit(1);
});
process.on('unhandledRejection', err => {
  log.error('unhandledRejection in lambda', err);
  process.exit(1);
});

module.exports = {
  run,
};
