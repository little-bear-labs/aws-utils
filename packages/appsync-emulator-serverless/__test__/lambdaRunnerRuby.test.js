const path = require('path');
const { fork } = require('child_process');
const e2p = require('event-to-promise');

const RubyRunner = path.join(__dirname, '../lambdaRunnerRuby');

const run = ({ handlerMethod, payload = {} }) => {
  const child = fork(RubyRunner, [], {
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
  describe('async ruby', () => {
    it(
      'return empty',
      async () => {
        const response = await run({
          handlerMethod: 'rubyemptyjson',
        });

        expect(response.type).toBe('success');
        expect(response.output).toEqual({});
      },
      20000,
    );
    it(
      'return object',
      async () => {
        const response = await run({
          handlerMethod: 'rubycomposedjson',
        });

        expect(response.type).toBe('success');
        expect(response.output).toEqual({ a: 1, b: 2, c: 3 });
      },
      20000,
    );
    it(
      'throw error',
      async () => {
        const response = await run({
          handlerMethod: 'rubyerror',
        });

        expect(response.type).toBe('error');
      },
      20000,
    );

    it(
      'shows Ruby errors',
      async () => {
        const response = await run({
          handlerMethod: 'rubybroken',
        });

        expect(response.error).toContain(
          'missing keyword: context (ArgumentError)',
        );
      },
      20000,
    );
  });
});
