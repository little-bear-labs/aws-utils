const path = require('path');
const { fork } = require('child_process');
const e2p = require('event-to-promise');

const PythonRunner = path.join(__dirname, '../lambdaRunnerPython');

const run = ({ handlerMethod, payload = {} }) => {
  const child = fork(PythonRunner, [], {
    stdio: [0, 1, 2, 'ipc'],
  });

  child.send({
    serverlessDirectory: path.join(__dirname, 'example'),
    handlerMethod,
    payload,
  });
  return e2p(child, 'message');
};

describe('lambdaRunner', () => {
  describe('async python', () => {
    it('return empty', async () => {
      const response = await run({
        handlerMethod: 'emptyJSON',
      });

      expect(response.type).toBe('success');
      expect(response.output).toEqual({});
    });
    it('return object', async () => {
      const response = await run({
        handlerMethod: 'composedJSON',
      });

      expect(response.type).toBe('success');
      expect(response.output).toEqual({ a: 1, b: 2, c: 3 });
    });
    it('throw error', async () => {
      const response = await run({
        handlerMethod: 'error',
      });

      expect(response.type).toBe('error');
    });
  });
});
