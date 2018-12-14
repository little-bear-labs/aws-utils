const {
  log,
  sendErr,
  sendOutput,
  installExceptionHandlers,
} = require('./lambda/util');

process.once(
  'message',
  async ({ serverlessDirectory, handlerMethod, payload }) => {
    try {
      log.info('load', handlerMethod);

      const { spawn } = require('child_process');
      const args = ['invoke', 'local', '-f', handlerMethod];

      const sls = spawn('sls', args, {
        env: process.env,
        stdio: ['pipe', null, 'pipe'],
        shell: '/bin/bash',
        cwd: serverlessDirectory,
      });

      sls.stdin.write(`${JSON.stringify(payload)}\n`);
      sls.stdin.end();

      let results = '';
      let allResults = '';
      sls.stdout.on('data', data => {
        results = data.toString();
        allResults += results;
        // when calling python lambda, the last output of the function will be
        // the final output which is printed to the stdout
        results = results.replace('\n', '');
      });

      sls.on('close', code => {
        if (allResults.indexOf('Traceback') >= 0) {
          sendErr(allResults);
        } else if (code === 0) {
          sendOutput(JSON.parse(results));
        } else {
          sendErr(allResults);
        }
      });

      sls.stderr.on('data', data => {
        sendErr(data.toString());
      });
    } catch (err) {
      sendErr(err);
    }
  },
);

installExceptionHandlers();
