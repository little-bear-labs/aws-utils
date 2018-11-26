const nock = require('nock');
const httpSource = require('../httpSource');

describe('httpSource', () => {
  beforeEach(() => {
    nock('http://localhost:3000')
      .get('/api/users')
      .query({
        foo: 'bar',
      })
      .reply(200, {
        data: [{ name: 'Name1' }, { name: 'Name2' }],
      });

    nock('http://localhost:3000')
      .post('/api/users', { id: '123ABC' })
      .reply(200, { id: '123ABC' });
  });

  it('HTTP GET', async () => {
    const result = await httpSource('http://localhost:3000', {
      resourcePath: '/api/users',
      method: 'GET',
      params: {
        query: {
          foo: 'bar',
        },
      },
    });

    expect(result).toMatchObject({
      body: '{"data":[{"name":"Name1"},{"name":"Name2"}]}',
      statusCode: 200,
    });
  });

  it('HTTP POST', async () => {
    const result = await httpSource('http://localhost:3000', {
      resourcePath: '/api/users',
      method: 'POST',
      params: {
        body: JSON.stringify({ id: '123ABC' }),
      },
    });

    expect(result).toMatchObject({
      body: '{"id":"123ABC"}',
      statusCode: 200,
    });
  });
});
