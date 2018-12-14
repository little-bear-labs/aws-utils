const { log, sendErr, sendOutput, installExceptionHandlers } = require('./lambda/util');

process.once(
  'message',
  async ({ serverlessDirectory, handlerPath, handlerMethod, payload}) => {
    try {
        log.info('load', module);
   
        let spawn = require('child_process').spawn;
        let args = ["invoke", "local", "-f", handlerMethod];

        let sls = spawn("sls",
            args, 
            {
                env: process.env,
                stdio: ['pipe', null, 'pipe'],
                shell: '/bin/bash',
                cwd: serverlessDirectory
            });

        sls.stdin.write(JSON.stringify(payload) + "\n");
        sls.stdin.end();
        
        let results = '';
        sls.stdout.on('data', function(data) {
            results = data.toString();
            results = results.replace('\n', '');
        });

        sls.on('close', function(code) {
            sendOutput(JSON.parse(results));
        });
    } catch (err) {
      sendErr(err);
    }
  },
);

installExceptionHandlers();