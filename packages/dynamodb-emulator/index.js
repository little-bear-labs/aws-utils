const path = require('path');
const portfinder = require('portfinder');
const { spawn } = require('child_process');
const e2p = require('event-to-promise');
const fs = require('fs');
const portPid = require('port-pid');
const log = require('logdown')('dynamodb-emulator');

// random port I chose in the ephemeral range.
const basePort = 62224;

const defaultOptions = {
  inMemory: true,
  sharedDb: false,
  dbPath: null,
  startTimeout: 10 * 1000,
  debug: false,
};

const emulatorPath = path.join(__dirname, 'emulator');
const retryInterval = 20;
const maxRetries = 5;

class Emulator {
  constructor(proc, opts) {
    this.proc = proc;
    this.opts = opts;
  }

  get pid() {
    return this.proc.pid;
  }

  get port() {
    return this.opts.port;
  }

  get url() {
    return `http://localhost:${this.port}/`;
  }

  terminate() {
    // already exited
    if (this.proc.exitCode != null) {
      return this.proc.exitCode;
    }
    this.proc.kill();
    return e2p(this.proc, 'exit');
  }
}

const wait = ms => {
  let timeoutHandle;
  const promise = new Promise(accept => {
    timeoutHandle = setTimeout(accept, ms);
  });

  return {
    promise,
    cancel: () => {
      clearTimeout(timeoutHandle);
    },
  };
};

async function which(bin) {
  return new Promise((accept, reject) => {
    require('which')(bin, (err, value) => {
      if (err) return reject(err);
      return accept(value);
    });
  });
}

function buildArgs(options) {
  const args = [
    '-Djava.library.path=./DynamoDBLocal_lib',
    '-jar',
    'DynamoDBLocal.jar',
    '-port',
    options.port,
  ];
  if (options.dbPath) {
    args.push('-dbPath');
    args.push(options.dbPath);
  }

  // dbPath overrides in memory
  if (options.inMemory && !options.dbPath) {
    args.push('-inMemory');
  }
  if (options.sharedDb) {
    args.push('-sharedDb');
  }
  return args;
}

async function launch(givenOptions = {}, retry = 0, startTime = Date.now()) {
  log.info('launching', { retry, givenOptions });
  // launch will retry but ensure it will not retry indefinitely.
  if (retry >= maxRetries) {
    throw new Error('max retries hit for starting dynamodb emulator');
  }

  if (givenOptions.inMemory && givenOptions.dbPath) {
    throw new Error('inMemory and dbPath are mutually exclusive options');
  }
  let { port } = givenOptions;
  if (!port) {
    port = await portfinder.getPortPromise({ port: basePort });
    log.info('found open port', { port });
  }
  const opts = { ...defaultOptions, ...givenOptions, port };

  if (opts.dbPath) {
    if (fs.existsSync(opts.dbPath)) {
      const stat = fs.statSync(opts.dbPath);
      if (!stat.isDirectory()) {
        throw new Error(`dbPath must be a directory (${opts.dbPath})`);
      }
    } else {
      log.info('Creating directory', { dbPath: opts.dbPath });
      fs.mkdirSync(opts.dbPath);
    }
  }

  const java = await which('java');
  const args = buildArgs(opts);
  const proc = spawn(java, args, {
    cwd: emulatorPath,
  });

  if (opts.debug) {
    proc.stdout.pipe(process.stdout);
    proc.stderr.pipe(process.stderr);
  }

  const verifyPortIsOpen = async () => {
    const portOnPID = await portPid(port);
    return portOnPID.all.indexOf(proc.pid) !== -1;
  };

  const waitForPort = (timeout = opts.startTimeout) =>
    new Promise((accept, reject) => {
      let checkTimeout;
      const waiter = wait(timeout);
      waiter.promise.then(() => {
        clearTimeout(checkTimeout);
        proc.kill();
        reject(new Error('timed out waiting for port'));
      });

      const invoke = async () => {
        const success = await verifyPortIsOpen();
        if (!success) {
          setTimeout(invoke, 50);
          return;
        }
        waiter.cancel();
        accept();
      };

      invoke();
    });

  // define this now so we can use it later to remove a listener.
  let prematureExit;
  // This is a fairly complex set of logic to retry starting
  // the emulator if it fails to start. We need this logic due
  // to possible race conditions between when we find an open
  // port and bind to it. This situation is particularly common
  // in jest where each test file is running in it's own process
  // each competing for the open port.
  try {
    const waiter = wait(opts.startTimeout);
    await Promise.race([
      waitForPort(),
      // waiter.promise.then(startingTimeout),
      new Promise((accept, reject) => {
        prematureExit = () => {
          log.error('Emulator has prematurely exited... need to retry');
          const err = new Error('premature exit');
          err.code = 'premature';
          proc.removeListener('exit', prematureExit);
          reject(err);
        };
        proc.on('exit', prematureExit);
      }),
    ]);
    // eventually the process will exit... ensure our logic only
    // will run on _premature_ exits.
    proc.removeListener('exit', prematureExit);
    waiter.cancel();

    log.info('Successfully launched emulator on', {
      port,
      time: Date.now() - startTime,
    });
  } catch (err) {
    // retry starting the emulator after a small "back off" time
    // if we have a premature exit or the port is bound in a different process.
    if (err.code === 'premature' || err.code === 'port_taken') {
      if (givenOptions.port) {
        throw new Error(`${givenOptions.port} is bound and unavailable`);
      }
      log.info('Queue retry in', retryInterval);
      return wait(retryInterval).promise.then(() =>
        launch(givenOptions, retry + 1, startTime),
      );
    }
    throw err;
  }

  return new Emulator(proc, opts);
}

function getClient(emu, options = {}) {
  const { DynamoDB } = require('aws-sdk');
  return new DynamoDB({
    endpoint: emu.url,
    region: 'us-fake-1',
    accessKeyId: 'fake',
    secretAccessKey: 'fake',
    ...options,
  });
}

module.exports = {
  launch,
  getClient,
};
