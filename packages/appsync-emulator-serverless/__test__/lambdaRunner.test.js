const { run } = require('../lambdaRunner');

describe('lambdaRunner', () => {
  describe('run', () => {
    describe('callback', () => {
      test('The lambda throws an error', async () => {
        const lambda = (event, context, callback) => {
          callback('error', null);
        };
        const context = {};
        const payload = {};

        try {
          await run({ lambda, context, payload });
        } catch (e) {
          expect(e).toMatch('error');
        }
      });
      test('The lambda returns output', async () => {
        const lambda = (event, context, callback) => {
          callback(null, true);
        };
        const context = {};
        const payload = {};

        const output = await run({ lambda, context, payload });
        expect(output).toBe(true);
      });
    });

    describe('async', () => {
      test('The lambda throws an error', async () => {
        const lambda = async (event, context) => { throw new Error('error'); };
        const context = {};
        const payload = {};

        try {
          await run({ lambda, context, payload });
        } catch (e) {
          expect(e.message).toMatch('error');
        }
      });
      test('The lambda returns output', async () => {
        const lambda = async (event, context) => true
        const context = {};
        const payload = {};

        const output = await run({ lambda, context, payload });
        expect(output).toBe(true);
      });
    });
  });
});
