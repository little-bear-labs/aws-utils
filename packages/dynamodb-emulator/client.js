// client lock aquisition dance ....
const objHash = require('object-hash');
const path = require('path');
const http = require('http');
const fs = require('fs');
const qs = require('querystring');
const { flockSync } = require('fs-ext');
const { spawn } = require('child_process');
const log = require('logdown')('dynamodb-emulator:client');
const { getClient } = require('./index');

const waitTimeout = 10 * 1000;
const requestTimeout = waitTimeout;
const deamonPath = path.join(__dirname, 'deamon.js');
const pidPath = path.join(__dirname, '.pid');
const wait = ms =>
  new Promise(accept => {
    setTimeout(accept, ms);
  });
const fsExists = file =>
  new Promise(accept => {
    fs.exists(file, accept);
  });
const get = (unixSocket, urlpath, params = {}) =>
  new Promise((accept, reject) => {
    log.info();
    const req = http.request(
      {
        socketPath: unixSocket,
        timeout: requestTimeout,
        method: 'GET',
        path: `/${urlpath}?${qs.stringify(params)}`,
        headers: {
          'Content-Length': 0,
        },
      },
      res => {
        const buffers = [];
        res.once('error', reject);
        res.on('data', buffer => buffers.push(buffer));
        res.on('end', () => accept(JSON.parse(Buffer.concat(buffers))));
      },
    );
    req.once('timeout', () => reject(new Error('timed out making request')));
    req.end();
  });

async function buildEmulatorHandle(unixSocketFile, options) {
  const { url, port, pid, handle } = await get(
    unixSocketFile,
    'launch',
    options,
  );

  return {
    url,
    port,
    pid,
    terminate: async () => get(unixSocketFile, 'free', { handle }),
  };
}

async function requestEmulator(unixSocketFile, options) {
  const state = await get(unixSocketFile, 'handshake');

  switch (state.status) {
    case 'success':
      return buildEmulatorHandle(unixSocketFile, options);
    case 'version-mismatch':
      throw new Error('Deamon code has changed... restarting');
    default:
      log.error('Invalid state', state);
      throw new Error(`Unhandled state: ${state.status}`);
  }
}

async function startDeamon(hash, unixSocketFile, options) {
  // file does not exist so we will need to create one.
  const pidFile = path.join(pidPath, `${hash}.pid`);
  const fd = fs.openSync(pidFile, 'w');
  try {
    // ensure nobody else is writing to this file.
    flockSync(fd, 'sh');
  } catch (err) {
    console.error(err.stack, '<<< failed flock');
  }
  const proc = spawn(process.argv0, [deamonPath, hash], {
    detached: true,
    env: {
      ...process.env,
      NODE_DEBUG: process.env.NODE_DEBUG || '*dynamodb-emulator*',
    },
    stdio: [
      'ignore',
      fs.openSync(path.join(pidPath, `${hash}-stdout.log`), 'w'),
      fs.openSync(path.join(pidPath, `${hash}-stderr.log`), 'w'),
    ],
  });
  proc.unref();

  const start = Date.now();
  while (Date.now() - start < waitTimeout) {
    if (await fsExists(unixSocketFile)) {
      return requestEmulator(unixSocketFile, options);
    }
    // add some wait time so we are not trying too frequently.
    await wait(20);
  }
  throw new Error('failed to start client timed out...');
}

async function launch(options = {}) {
  const hash = objHash(options);
  const unixSocketFile = path.relative(process.cwd(), path.join(pidPath, hash));
  // path one the unix descriptor exists...
  if (fs.existsSync(unixSocketFile)) {
    return requestEmulator(unixSocketFile, options);
  }

  return startDeamon(hash, unixSocketFile, options);
}

module.exports = { launch, getClient };
