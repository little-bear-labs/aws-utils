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

const waitTimeout = 30 * 1000;
const requestTimeout = waitTimeout;
const deamonPath = path.join(__dirname, 'deamon.js');
const pidPath = path.join('/Users/christopherbaron', '.pid');
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
    log.info('request', urlpath, params);
    const start = Date.now();
    console.log('bout to request', urlpath, unixSocket);
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
        res.setEncoding('utf8');
        const buffers = [];
        res.once('error', e => {
          console.log('got wrecked');
          reject(e);
        });
        res.on('data', buffer => {
          console.log(buffer);
          console.log('buffer type', typeof buffer);
          if (typeof buffer === 'string') {
            buffers.push([buffer]);
          } else {
            buffers.push(buffer);
          }
        });
        res.on('error', e => {
          console.log('error', e);
        });
        res.on('end', () => {
          log.info('response', urlpath, params, Date.now() - start);
          console.log('buffers', buffers.toString());
          accept(JSON.parse(Buffer.from(buffers.toString())));
        });
      },
    );
    req.once('timeout', () => reject(new Error('timed out making request')));
    req.end();
    console.log('requested');
  });

async function buildEmulatorHandle(unixSocketFile, options) {
  const start = Date.now();
  const { url, port, pid } = await get(unixSocketFile, 'launch', options);
  log.info('got emulator in (ms)', Date.now() - start);

  return {
    url,
    port,
    pid,
    // for api compat with index.js emulator
    terminate: async () => {},
  };
}

async function requestEmulator(unixSocketFile, options) {
  console.log('bout to shake');
  const state = await get(unixSocketFile, 'handshake');
  console.log('done with shake', state);

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
  console.log(pidFile);
  const fd = fs.openSync(pidFile, 'w');
  console.log(fd);
  try {
    // ensure nobody else is writing to this file.
    flockSync(fd, 'sh');
  } catch (err) {
    console.error(err.stack, '<<< failed flock');
  }
  console.log(process.argv0, [deamonPath, hash]);
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

  let emulator;
  const start = Date.now();
  while (Date.now() - start < waitTimeout) {
    console.log('unix socket file', unixSocketFile);
    if (await fsExists(unixSocketFile)) {
      emulator = requestEmulator(unixSocketFile, options);
    }
    // add some wait time so we are not trying too frequently.
    await wait(80);
  }

  if (!emulator) {
    throw new Error('failed to start client timed out...');
  }

  return emulator;
}

async function launch(options = {}) {
  const hash = objHash(options);
  // const unixSocketFile = path.relative(process.cwd(), path.join(pidPath, hash));
  const unixSocketFile = `/Users/christopherbaron/.pid/${hash}`;
  // path one the unix descriptor exists...
  if (fs.existsSync(unixSocketFile)) {
    console.log(unixSocketFile);
    return requestEmulator(unixSocketFile, options);
  }

  console.log('starting daemon');
  return startDeamon(hash, unixSocketFile, options);
}

module.exports = { launch, getClient };
