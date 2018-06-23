const { launch } = require('../client');

describe('deamon', () => {
  beforeEach(() => jest.setTimeout(10 * 1000));
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
      await result.terminate();
    }

    // after we've terminated all previous emulator requests the
    // process should exit and this request should return a new pid.
    const afterTerminate = await launch(opts);
    expect(first.pid).not.toEqual(afterTerminate);
    await afterTerminate.terminate();
  });
});
