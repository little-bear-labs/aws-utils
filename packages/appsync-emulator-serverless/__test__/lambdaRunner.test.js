const { run } = require('../lambdaRunner');

describe('lambdaRunner', () => {
  describe('run', () => {
    describe('callback', () => {
      it('throws an error', async () => {
        const lambda = (event, context, callback) => {
          callback('error', null);
        };
        const context = {};
        const payload = {};

        run({ lambda, context, payload }, err => {
          expect(err).toMatch('error');
        });
      });
      it('returns output', async () => {
        const lambda = (event, context, callback) => {
          callback(null, true);
        };
        const context = {};
        const payload = {};

        run({ lambda, context, payload }, (err, output) => {
          expect(output).toBe(true);
        });
      });
    });

    describe('async', () => {
      it('throws an error', async () => {
        const lambda = async () => {
          throw new Error('error');
        };
        const context = {};
        const payload = {};

        try {
          await run({ lambda, context, payload });
        } catch (e) {
          expect(e.message).toMatch('error');
        }
      });
      it('returns output', async () => {
        const lambda = async () => true;
        const context = {};
        const payload = {};

        const output = await run({ lambda, context, payload });
        expect(output).toBe(true);
      });
    });

    describe('promise', () => {
      it('throws an error', async () => {
        const lambda = () =>
          new Promise((_, reject) => {
            reject(new Error());
          });
        const context = {};
        const payload = {};

        try {
          await run({ lambda, context, payload });
        } catch (e) {
          expect(e).toBeInstanceOf(Error);
        }
      });
      it('returns output', async () => {
        const lambda = () =>
          new Promise(resolve => {
            resolve(true);
          });
        const context = {};
        const payload = {};

        const output = await run({ lambda, context, payload });
        expect(output).toBe(true);
      });
    });
  });
});
