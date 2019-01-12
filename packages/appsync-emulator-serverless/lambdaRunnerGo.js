const path = require('path');
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
      log.info('load', handlerMethod);

      const { spawn } = require('child_process');
      const args = ['local', 'invoke'];

      const sam = spawn('sam', args, {
        env: process.env,
        shell: '/bin/bash',
        cwd: path.join(serverlessDirectory, handlerMethod),
      });
      installStdIOHandlers('go', sam, payload);
    } catch (err) {
      sendErr(err);
    }
  },
);

installExceptionHandlers();
