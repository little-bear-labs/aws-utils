const subject = require('../');

describe('config', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });
  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });
  it('should load development mode by default', () => {
    const output = subject({
      filename: `${__dirname}/../examples/`,
    });

    expect(output).toEqual({
      defaults: { default: true, env: 'development' },
      development: true,
    });
  });
});
