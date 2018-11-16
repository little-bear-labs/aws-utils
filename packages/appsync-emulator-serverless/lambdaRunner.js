const log = require('logdown')('appsync-emulator:lambdaRunner');

const sendErr = err => {
  process.send({ type: 'error', error: err }, () => {
    process.exit();
  });
};

const onResponse = (err, output) => {
  if (err) {
    sendErr(err);
    return;
  }
  process.send({ type: 'success', output }, process.exit);
};

process.once('message', ({ module, handlerPath, handlerMethod, payload }) => {
  try {
    log.info('load', module);
    // eslint-disable-next-line
    const handlerModule = require(module);
    if (!handlerModule[handlerMethod]) {
      sendErr(
        new Error(
          `Module : ${handlerPath} does not have export: ${handlerMethod}`,
        ),
      );
    }

    log.info('invoke', handlerMethod);
    const context = {};

    Promise.resolve(handlerModule[handlerMethod](payload, context, onResponse))
      .then(output =>
        process.send(
          {
            type: 'success',
            output,
          },
          process.exit,
        ),
      )
      .catch(err => {
        if (err) sendErr(err);
      });
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
