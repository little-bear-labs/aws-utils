const httpSource = require('./httpSource');

const elasticsearchSource = async (
  endpoint,
  { path = '', operation = 'POST', params = {} },
) => {
  const esResult = await httpSource(endpoint, {
    // ES accepts GET/HEAD operations with a body,
    // but fetch forbids it.
    method:
      ['HEAD', 'GET'].indexOf(operation) !== -1 &&
      Object.entries(params.body).length > 0
        ? 'POST'
        : operation,
    resourcePath: path,
    params: {
      query: params.queryString,
      headers: {
        'Content-Type': 'application/json',
        ...params.headers,
      },
      body:
        Object.entries(params.body).length > 0
          ? JSON.stringify(params.body)
          : undefined,
    },
  });

  return JSON.parse(esResult.body);
};

module.exports = elasticsearchSource;
