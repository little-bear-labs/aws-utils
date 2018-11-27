const path = require('path');
const { fork } = require('child_process');
const e2p = require('event-to-promise');

const Runner = path.join(__dirname, '../lambdaRunner');

const run = ({ handlerMethod, payload = {} }) => {
  const child = fork(Runner, [], {
    stdio: [0, 1, 2, 'ipc'],
  });

  child.send({
    module: './__test__/lambdaFunctions',
    handlerPath: './__test__/lambdaFunctions',
    handlerMethod,
    payload,
  });

  return e2p(child, 'message');
};

describe('lambdaRunner', () => {
  describe('callback', () => {
    it('throws an error', async () => {
      const response = await run({
        handlerMethod: 'callbackWithError',
      });

      expect(response.type).toBe('error');
      expect(response.error).toBe('error');
    });
    it('returns output', async () => {
      const response = await run({
        handlerMethod: 'callbackWithOutput',
      });
      expect(response.type).toBe('success');
      expect(response.output).toBe(true);
    });
  });

  describe('async', () => {
    it('throws an error', async () => {
      const response = await run({
        handlerMethod: 'asyncWithError',
      });

      expect(response.type).toBe('error');
      expect(response.error).toHaveProperty('errorType', 'Error');
      expect(response.error).toHaveProperty('errorMessage', 'error');
    });
    it('returns output', async () => {
      const response = await run({
        handlerMethod: 'asyncWithOutput',
      });

      expect(response.type).toBe('success');
      expect(response.output).toBe(true);
    });
  });

  describe('promise', () => {
    it('throws an error', async () => {
      const response = await run({
        handlerMethod: 'promiseWithError',
      });

      expect(response.type).toBe('error');
      expect(response.error).toHaveProperty('errorType', 'Error');
      expect(response.error).toHaveProperty('errorMessage', 'error');
    });
    it('returns output', async () => {
      const response = await run({
        handlerMethod: 'promiseWithOutput',
      });

      expect(response.type).toBe('success');
      expect(response.output).toBe(true);
    });
  });
});
