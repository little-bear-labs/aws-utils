const url = require('url');

const fetch = options =>
  new Promise((resolve, reject) => {
    const lib = options.protocol.startsWith('https')
      ? require('https')
      : require('http');
    const request = lib.request(options, response => {
      const body = [];
      response.on('data', chunk => body.push(chunk));
      response.on('end', () =>
        resolve({
          body: body.join(''),
          statusCode: response.statusCode,
        }),
      );
    });
    request.on('error', err => reject(err));
    request.end();
  });

const httpSource = async (endpoint, { resourcePath, method, params }) => {
  const { protocol, hostname, port } = url.parse(endpoint);

  const options = {
    protocol,
    hostname,
    port,
    path: resourcePath,
    method,
    headers: params ? params.headers : {},
  };

  return fetch(options);
};

module.exports = httpSource;
