const { loadServerlessConfig } = require('../loadServerlessConfig');
const { cloudFormationProcessor } = require('../cloudFormationProcessor');

describe('cloudFormationProcessor', () => {
  const serverlessDir = `${__dirname}/example/`;

  let configs = {};
  beforeEach(async () => {
    // cleanup the configuration object...
    configs = (await loadServerlessConfig(serverlessDir)).config;
  });

  it('supports ref for dynamodb table', () => {
    const {
      custom: {
        appSync: {
          dataSources,
          userPoolConfig: { userPoolId },
        },
      },
    } = cloudFormationProcessor(configs);

    const dataSourceByName = Object.entries(dataSources).reduce(
      (sum, [, value]) => ({
        ...sum,
        [value.name]: value,
      }),
      {},
    );

    expect(dataSourceByName.QuoteRequest).toMatchObject({
      config: {
        tableName: 'QuoteRequest-emulator',
      },
    });
    expect(userPoolId).toMatchObject({
      Ref: 'UserPoolResource',
    });
  });
});
