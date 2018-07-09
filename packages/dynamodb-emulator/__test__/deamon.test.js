const { launch } = require('../client');

describe('deamon', () => {
  beforeEach(() => jest.setTimeout(60 * 1000));
  it('should allow parallel launches with single emulator', async () => {
    // intentionally using unknown option for unique emulator instance.
    const opts = { supertest: true };

    const results = await Promise.all([
      launch(opts),
      launch(opts),
      launch(opts),
      launch(opts),
      launch(opts),
      launch(opts),
      launch(opts),
      launch(opts),
      launch(opts),
      launch(opts),
    ]);

    const first = results[0];
    for (const result of results) {
      expect(result.url).toEqual(first.url);
    }
  });
});
