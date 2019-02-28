const childProcess = require('child_process');
const lambdaSource = require('../lambdaSource');
const e2p = require('event-to-promise');

jest.mock('child_process');
jest.mock('event-to-promise');

describe('lambdaSource', () => {
  it('should call fork with correct arguments', async () => {
    const spy = jest
      .spyOn(childProcess, 'fork')
      .mockImplementation(() => ({ send: jest.fn() }));
    e2p.mockImplementation(async () =>
      Promise.resolve({
        type: 'success',
        output: {},
      }),
    );
    const config = {
      dynamodbEndpoint: 'localhost',
      dynamodbTables: {
        USERS: 'users',
        POSTS: 'posts',
      },
      serverlessDirectory: 'foo/bar',
      serverlessConfig: {
        provider: {
          environment: {
            DYNAMODB_USERNAME: 'dynamo',
          },
        },
        functions: {
          getUsers: {
            handler: 'users.handler',
            runtime: 'nodejs8.10',
            environment: {
              USER_ENV_1: 'foo',
              USER_ENV_2: 'bar',
            },
          },
          getPosts: {
            handler: 'users.handler',
            runtime: 'nodejs8.10',
            environment: {
              POST_ENV_1: 'bazz',
              POST_ENV_2: 'buzz',
            },
          },
        },
      },
    };
    await lambdaSource(config, 'getUsers', {});
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.objectContaining({
        env: expect.objectContaining({
          DYNAMODB_USERNAME: 'dynamo',
          DYNAMODB_TABLE_USERS: 'users',
          DYNAMODB_TABLE_POSTS: 'posts',
          USER_ENV_1: 'foo',
          USER_ENV_2: 'bar',
        }),
      }),
    );
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.objectContaining({
        env: expect.not.objectContaining({
          POST_ENV_1: 'bazz',
          POST_ENV_2: 'buzz',
        }),
      }),
    );
    await lambdaSource(config, 'getPosts', {});
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.objectContaining({
        env: expect.objectContaining({
          DYNAMODB_USERNAME: 'dynamo',
          DYNAMODB_TABLE_USERS: 'users',
          DYNAMODB_TABLE_POSTS: 'posts',
          POST_ENV_1: 'bazz',
          POST_ENV_2: 'buzz',
        }),
      }),
    );
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.objectContaining({
        env: expect.not.objectContaining({
          USER_ENV_1: 'foo',
          USER_ENV_2: 'bar',
        }),
      }),
    );
  });
});
