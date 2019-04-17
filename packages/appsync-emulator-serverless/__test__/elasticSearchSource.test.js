const elasticsearchSource = require('../elasticsearchSource');

jest.mock('../httpSource', () => jest.fn().mockResolvedValue({ body: '{}' }));
const httpSource = require('../httpSource');

beforeEach(() => {
  httpSource.mockClear();
});

describe('elasticsearchSource', () => {
  it('HTTP POST', async () => {
    await elasticsearchSource('http://localhost:9200', {
      operation: 'POST',
      path: '/test/_search',
      params: {
        queryString: { foo: 'bar' },
        headers: {
          'X-Header-1': 'custom header',
          'X-Header-2': 'custom header 2',
        },
        body: {
          query: {
            fuzzy: {
              content: 'foobar',
            },
          },
        },
      },
    });

    expect(httpSource).toHaveBeenCalled();
    expect(httpSource.mock.calls[0][0]).toEqual('http://localhost:9200');
    expect(httpSource.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      params: {
        body: '{"query":{"fuzzy":{"content":"foobar"}}}',
        headers: {
          'Content-Type': 'application/json',
          'X-Header-1': 'custom header',
          'X-Header-2': 'custom header 2',
        },
        query: { foo: 'bar' },
      },
      resourcePath: '/test/_search',
    });
  });

  it('HTTP POST, missing params', async () => {
    await elasticsearchSource('http://localhost:9200', {
      operation: 'POST',
      path: '/test/_search',
      params: {},
    });

    expect(httpSource).toHaveBeenCalled();
    expect(httpSource.mock.calls[0][0]).toEqual('http://localhost:9200');
    expect(httpSource.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      params: {
        body: undefined,
        headers: { 'Content-Type': 'application/json' },
        query: undefined,
      },
      resourcePath: '/test/_search',
    });
  });

  it('HTTP GET gets transformed to POST', async () => {
    await elasticsearchSource('http://localhost:9200', {
      operation: 'GET',
      path: '/test/_search',
      params: {
        queryString: { foo: 'bar' },
        headers: {
          'X-Header-1': 'custom header',
          'X-Header-2': 'custom header 2',
        },
        body: {
          query: {
            fuzzy: {
              content: 'foobar',
            },
          },
        },
      },
    });

    expect(httpSource).toHaveBeenCalled();
    expect(httpSource.mock.calls[0][0]).toEqual('http://localhost:9200');
    expect(httpSource.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      params: {
        body: '{"query":{"fuzzy":{"content":"foobar"}}}',
        headers: {
          'Content-Type': 'application/json',
          'X-Header-1': 'custom header',
          'X-Header-2': 'custom header 2',
        },
        query: { foo: 'bar' },
      },
      resourcePath: '/test/_search',
    });
  });

  it('HTTP DELETE', async () => {
    await elasticsearchSource('http://localhost:9200', {
      operation: 'DELETE',
      path: '/test/_doc/1',
    });

    expect(httpSource).toHaveBeenCalled();
    expect(httpSource.mock.calls[0][0]).toEqual('http://localhost:9200');
    expect(httpSource.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      params: {
        body: undefined,
        headers: { 'Content-Type': 'application/json' },
        query: undefined,
      },
      resourcePath: '/test/_doc/1',
    });
  });
});
