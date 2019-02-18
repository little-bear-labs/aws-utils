const path = require('path');
const { fork } = require('child_process');
const e2p = require('event-to-promise');

const GoRunner = path.join(__dirname, '../lambdaRunnerGo');

const run = ({ handlerMethod, payload = {} }) => {
  const child = fork(GoRunner, [], {
    stdio: [0, 1, 2, 'ipc'],
  });

  child.send({
    serverlessDirectory: path.join(__dirname, 'example'),
    handlerMethod,
    payload,
  });
  return e2p(child, 'message');
};

// These specs execute slowly on Mac, so need a larger timeout.
describe('lambdaRunner', () => {
  describe('async go', () => {
    it(
      'return empty',
      async () => {
        const response = await run({
          handlerMethod: 'goemptyjson',
        });

        expect(response.output).toEqual({});
        expect(response.type).toBe('success');
      },
      40000,
    );
    it(
      'return object',
      async () => {
        const response = await run({
          handlerMethod: 'gocomposedjson',
        });

        expect(response.output).toEqual({ a: 1, b: 2, c: 3 });
        expect(response.type).toBe('success');
      },
      40000,
    );
    it(
      'throw error',
      async () => {
        const response = await run({
          handlerMethod: 'goerror',
        });

        expect(response.type).toBe('error');
      },
      40000,
    );
  });
});
