const {
  log,
  sendErr,
  installStdIOHandlers,
  installExceptionHandlers,
} = require('./lambda/util');

process.once(
  'message',
  async ({ serverlessDirectory, handlerMethod, payload }) => {
    try {
      log.info('Running Ruby lambda function', handlerMethod);

      const { spawn } = require('child_process');
      const args = ['invoke', 'local', '-f', handlerMethod];

      const sls = spawn('sls', args, {
        env: process.env,
        shell: '/bin/bash',
        cwd: serverlessDirectory,
      });

      installStdIOHandlers('ruby', sls, payload);
    } catch (err) {
      log('Could not invoke serverless', err);
      sendErr(err);
    }
  },
);

installExceptionHandlers();
