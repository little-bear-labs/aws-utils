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
  async ({ serverlessDirectory, handlerPath, handlerMethod, payload}) => {
    try {
        log.info('load', module);
   
        var spawn = require('child_process').spawn          
        var args = ["invoke", "local", "-f", handlerMethod]

        var sls = spawn("sls", 
            args, 
            {
                env: process.env,
                stdio: ['pipe', null, 'pipe'],
                shell: '/bin/bash',
                cwd: serverlessDirectory
            });

        sls.stdin.write(JSON.stringify(payload) + "\n");
        sls.stdin.end();
        
        let results = ''
        sls.stdout.on('data', function(data) {
            results = data.toString('utf8');
            results = results.replace('\n', '')
        })

        sls.on('close', function(code) {
            sendOutput(JSON.parse(results));
        });
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
