const log = require('logdown')('appsync-emulator:lambdaRunner');

const sendOutput = output => {
  process.send({ type: 'success', output }, process.exit);
};
const sendErr = err => {
  process.send({ type: 'error', error: err.message ? err.message : err }, process.exit);
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
      const lambdaResult = lambda(payload, context, (err, lambdaResult) => {
        err ? sendErr(err) : sendOutput(lambdaResult);
      });
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
