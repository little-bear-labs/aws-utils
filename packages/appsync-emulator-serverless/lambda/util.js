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
  const error =
    err instanceof Error
      ? {
          stackTrace: parseErrorStack(err),
          errorType: err.constructor.name,
          errorMessage: err.message,
        }
      : err;
  process.send({ type: 'error', error }, process.exit);
};

function installExceptionHandlers() {
  process.on('uncaughtException', err => {
    log.error('uncaughtException in lambda', err);
    process.exit(1);
  });

  process.on('unhandledRejection', err => {
    log.error('unhandledRejection in lambda', err);
    process.exit(1);
  });
}

function installStdIOHandlers(runtime, proc, payload) {
  let results = '';
  let allResults = '';
  let errorResult = '';

  proc.stdin.write(`${JSON.stringify(payload)}\n`);
  proc.stdin.end();

  proc.stdout.on('data', data => {
    results = data.toString();
    allResults += results;
    results = results.replace('\n', '');
  });

  proc.on('close', code => {
    if (allResults === '') {
      sendErr(errorResult);
    } else if (allResults.indexOf('Traceback') >= 0) {
      sendErr(allResults);
    } else if (code === 0) {
      try {
        if (runtime.includes('go')) {
          sendOutput(JSON.parse(allResults));
        } else if (runtime.includes('python')) {
          sendOutput(JSON.parse(results));
        }
      } catch (err) {
        sendErr(errorResult);
      }
    } else {
      sendErr(allResults);
    }
  });

  proc.stderr.on('data', data => {
    errorResult = data.toString();
    try {
      const parsedData = JSON.parse(data.toString());
      sendErr(parsedData);
    } catch (err) {
      //
    }
  });
}

module.exports = {
  log,
  sendOutput,
  sendErr,
  installStdIOHandlers,
  installExceptionHandlers,
};
