/**
 * This is intended to be a test helper for jest to run lambda functions
 * as a full http server.
 */
const e2p = require('event-to-promise');
const http = require('http');
const util = require('util');
const { findServerless, findServerlessPath } = require('./findServerless');
const path = require('path');
const debug = require('debug')('aws-utils:lambdaHttp');

function drainStream(stream) {
  return new Promise((accept, reject) => {
    const buffers = [];
    stream.on('data', data => buffers.push(data));
    stream.once('end', () => accept(Buffer.concat(buffers).toString()));
    stream.once('error', reject);
  });
}

async function convertRequestToLambdaRequest(req) {
  const body = await drainStream(req);
  return {
    resource: req.url,
    path: req.url,
    httpMethod: req.method,
    headers: {
      Accept: '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9',
      Authorization:
        'eyJraWQiOiI2SnRBWkxOdFIrSENMK0Nxd2dkM2g3N09OWWFjTkV1Y1wvd0lHeWhIM3A5TT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIyMzU3YmU3Yy0zOWUwLTQ2MWUtOGQ4Zi05YTdhMDAzYzI5NGQiLCJhdWQiOiJxNHBwdTQwNHNkaXFsY2pnMjE3NTZodmFwIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImV2ZW50X2lkIjoiOTI5MDNlNGItNWI4My0xMWU4LWEyYmItMGI4MmE1MzZlNDUwIiwidG9rZW5fdXNlIjoiaWQiLCJhdXRoX3RpbWUiOjE1MjY3NDgxMjksImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC51cy1lYXN0LTEuYW1hem9uYXdzLmNvbVwvdXMtZWFzdC0xXzI3V2NNTDlrOCIsImNvZ25pdG86dXNlcm5hbWUiOiJkOWFlYWFkYy1lNjc3LTRjNjUtOWQ2OS1hNGQ2ZjNhN2RmODYiLCJleHAiOjE1MjY3NjcxNTMsImlhdCI6MTUyNjc2MzU1MywiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIn0.NTkpdSzIrNPbPjpycf5FT9hm5oXos6muvAt8oihrgELq6eUizn0xZFOlj6zuCbsmpOgYOHrlghdWvoPSwRDLt77ku4qQey4m_IwfaQ2gLM1LT3Ga-qN5Y_DXVOn3C8tNVJtGxM7WeFvJAbnCX4jCD_Z2LEmnRoSTMpIgwnNzWyAcOKTDEzEvqnK84P0jw1Nxv_G1uxAmmZjkSIJyCt8xVmdCAgCF6CnpqB8uHvWpc8VsfethY2QFH9UT8lDZ_ZoiPmp4oU2YEUR6g0NGzwwwazvhey8mUQfsyJoUKrRc2MYFHQoh9BX4yKUNaiWc18nrKEJPmEUeUtqHHMs7upR7Tw',
      'cache-control': 'no-cache',
      'CloudFront-Forwarded-Proto': 'https',
      'CloudFront-Is-Desktop-Viewer': 'true',
      'CloudFront-Is-Mobile-Viewer': 'false',
      'CloudFront-Is-SmartTV-Viewer': 'false',
      'CloudFront-Is-Tablet-Viewer': 'false',
      'CloudFront-Viewer-Country': 'US',
      'X-Amz-Cf-Id': 'qjuHdioMr3Wkv729dJAoAcTANhDn9d0n53oVxfXCEGo8t1Vh0r7q1w==',
      'X-Amzn-Trace-Id': 'Root=1-5b009021-d0ad8066c32a016ee9408428',
      'X-Forwarded-For': '',
      'X-Forwarded-Port': '443',
      'X-Forwarded-Proto': 'https',
      ...req.headers,
    },
    queryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      resourceId: 'i0vjwq',
      authorizer: {
        claims: {
          sub: '2357be7c-39e0-461e-8d8f-9a7a003c294d',
          aud: 'q4ppu404sdiqlcjg21756hvap',
          email_verified: 'true',
          event_id: '92903e4b-5b83-11e8-a2bb-0b82a536e450',
          token_use: 'id',
          auth_time: '1526748129',
          iss:
            'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_27WcML9k8',
          'cognito:username': 'd9aeaadc-e677-4c65-9d69-a4d6f3a7df86',
          exp: 'Sat May 19 21:59:13 UTC 2018',
          iat: 'Sat May 19 20:59:13 UTC 2018',
          email: 'user@example.com',
        },
      },
      resourcePath: req.url,
      httpMethod: req.method,
      extendedRequestId: 'HJt1SE01iYcFTFg=',
      requestTime: '19/May/2018:20:59:13 +0000',
      path: req.url,
      accountId: '229055845648',
      protocol: 'HTTP/1.1',
      stage: 'dev',
      requestTimeEpoch: 1526763553830,
      requestId: '7c534d29-5ba7-11e8-8b53-01a096ccb37d',
      identity: {
        cognitoIdentityPoolId: null,
        accountId: null,
        cognitoIdentityId: null,
        caller: null,
        sourceIp: '161.97.247.158',
        accessKey: null,
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: null,
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3432.3 Safari/537.36',
        user: null,
      },
      apiId: 'mr1ssm7ne1',
    },
    body: JSON.parse(body),
    isBase64Encoded: false,
  };
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

function createHandler(functions) {
  const serverlessRoot = findServerlessPath(module.parent);
  const pathMapping = Object.values(functions).reduce((sum, func) => {
    const httpEvents = (func.events || []).filter(event => 'http' in event);
    if (!httpEvents.length) {
      return sum;
    }

    return httpEvents.reduce((innerSum, httpEvent) => {
      const {
        http: { path: httpPath, method, cors = false },
      } = httpEvent;
      const [handlerPath, handlerExport] = func.handler.split('.');
      // eslint-disable-next-line
      const handlerModule = require(path.join(serverlessRoot, handlerPath));
      const handler = handlerModule[handlerExport];
      const resolvedPath = path.join('/', httpPath);

      // eslint-disable-next-line
      innerSum[resolvedPath] = innerSum[resolvedPath] || [];
      debug('register http event', { resolvedPath, method, cors });
      innerSum[resolvedPath].push({
        method,
        handler,
        cors,
      });
      return innerSum;
    }, sum);
  }, {});

  return async (req, res) => {
    debug('request', { url: req.url, method: req.method });
    const handlers = pathMapping[path.normalize(req.url)];

    if (!handlers) {
      debug('no handler');
      res.writeHead(404);
      res.end();
      return;
    }

    const handler = handlers.find(
      handle => handle.method.toLowerCase() === req.method.toLowerCase(),
    );
    if (!handler) {
      debug('no handler for method', { url: req.url, method: req.method });
      res.writeHead(404);
      res.end();
      return;
    }

    const event = await convertRequestToLambdaRequest(req);
    const { body = '', statusCode = 200, headers = {} } = await util.promisify(
      handler.handler,
    )(event, {});
    debug('set response', { body, statusCode, headers });

    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    if (handler.cors) setCorsHeaders(res);
    res.writeHead(statusCode);
    res.end(typeof body === 'object' ? JSON.stringify(body) : body);
  };
}

const lambdaHttp = () => {
  // load serverless to configure services.
  const { functions } = findServerless(module);

  const result = {};

  beforeEach(async () => {
    result.server = http.createServer(createHandler(functions));
    result.server.listen(0);
    await e2p(result.server, 'listening');
    const { port } = result.server.address();
    debug('listening on port', port);
    result.urls = Object.keys(functions).reduce((sum, key) => {
      const func = functions[key];
      // XXX: We only support a single http event per function.
      const httpEvent = (func.events || []).find(event => 'http' in event);
      if (!httpEvent) {
        return sum;
      }

      return {
        ...sum,
        [key]: `http://localhost:${port}/${httpEvent.http.path}`,
      };
    }, {});
  });

  return result;
};

module.exports = lambdaHttp;
