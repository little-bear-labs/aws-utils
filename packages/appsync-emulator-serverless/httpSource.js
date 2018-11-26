const fetch = require('node-fetch');

const httpSource = async (endpoint, { resourcePath, method, params }) => {
  const urlParams =
    params.query === undefined
      ? ''
      : `?${new URLSearchParams(Object.entries(params.query))}`;

  const response = await fetch(endpoint + resourcePath + urlParams, {
    ...params,
    method,
  });

  return {
    body: await response.text(),
    statusCode: response.status,
  };
};

module.exports = httpSource;
