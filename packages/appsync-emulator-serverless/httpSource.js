const fetch = require('node-fetch');

const httpSource = async (endpoint, { resourcePath, method, params }) => {
  const response = await fetch(endpoint + resourcePath, {
    ...params,
    method,
  });

  return {
    body: await response.text(),
    statusCode: response.status,
  };
};

module.exports = httpSource;
