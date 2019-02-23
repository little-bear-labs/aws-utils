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
        } else if (runtime.includes('python') || runtime.includes('ruby')) {
          // Syntax/language errors also hit here. Exit code should maybe not be 0
          // from sls when there is an exception, but it is. The error output is not sent via
          // STDERR, so it doesn't otherwise get picked up. JSON parse will fail here,
          // then the error ends up in the catch block.
          sendOutput(JSON.parse(results));
        }
      } catch (err) {
        // Serverless exited cleanly, but the output was not JSON, so parsing
        // failed.
        if (errorResult !== '') {
          log.error('Lambda invocation returned an error', errorResult);
          sendErr(errorResult);
        } else {
          log.error('Lambda invocation returned an error', results);
          sendErr(results);
        }
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
      log.error('Could not parse JSON from lambda invocation', errorResult);
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
