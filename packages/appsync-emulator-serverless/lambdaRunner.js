const log = require('logdown')('appsync-emulator:lambdaRunner');

const parseErrorStack = error =>
  error.stack
    .replace(/at /g, '')
    .split('\n    ')
    .slice(1);

const sendOutput = output => {
  process.send({ type: 'success', output }, process.exit);
};
const sendErr = err => {
  let error;
  if (err instanceof Error) {
    error = {
      stackTrace: parseErrorStack(err),
      errorType: err.constructor.name,
      errorMessage: err.message,
    };
  } else {
    error = err;
  }
  process.send({ type: 'error', error }, process.exit);
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
      const lambdaResult = lambda(payload, context, (err, callbackResult) => {
        if (err) {
          sendErr(err);
        } else {
          sendOutput(callbackResult);
        }
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
