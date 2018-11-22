const log = require('logdown')('appsync-emulator:lambdaRunner');

const isPromise = obj => (
  !!obj &&
  (typeof obj === 'object' || typeof obj === 'function') &&
  typeof obj.then === 'function'
);

const sendOutput = output => {
  process.send({ type: 'success', output }, process.exit);
};
const sendErr = err => {
  process.send({ type: 'error', error: err }, process.exit);
};

const run = ({ lambda, context, payload }, callback) => {
  const output = lambda(payload, context, callback);
  return isPromise(output) ? output : undefined;
};

process.once(
  'message',
  async ({ module, handlerPath, handlerMethod, payload }) => {
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
      const lambdaResult = run(
        { lambda, context, payload },
        (err, lambdaResult) => {
          err ? sendErr(err) : sendOutput(lambdaResult);
        },
      );
      if (lambdaResult instanceof Promise) {
        sendOutput(await lambdaResult);
      }
    } catch (err) {
      sendErr(err);
    }
  },
);

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
