const nock = require('nock');
const httpSource = require('../httpSource');

describe('httpSource', () => {
  beforeEach(() => {
    nock('http://localhost:3000')
      .get('/api/users')
      .reply(200, {
        data: [{ name: 'Name1' }, { name: 'Name2' }],
      });
  });

  it('HTTP source', async () => {
    const result = await httpSource('http://localhost:3000', {
      resourcePath: '/api/users',
      method: 'GET',
      params: {},
    });

    expect(result).toMatchObject({
      body: '{"data":[{"name":"Name1"},{"name":"Name2"}]}',
      statusCode: 200,
    });
  });
});
