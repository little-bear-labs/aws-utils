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
    const refTable = 'tablefromref';
    const {
      custom: {
        appSync: { dataSources },
      },
    } = cloudFormationProcessor(configs, {
      dynamodbTables: {
        'QuoteRequest-emulator': refTable,
      },
    });

    const dataSourceByName = Object.entries(dataSources).reduce(
      (sum, [, value]) => ({
        ...sum,
        [value.name]: value,
      }),
      {},
    );

    expect(dataSourceByName.QuoteRequest).toMatchObject({
      config: {
        tableName: refTable,
      },
    });
  });

  it('will throw errors messages with pathing information', () => {
    expect(() => {
      cloudFormationProcessor(
        {
          config: {
            nested: {
              inarray: [{ Ref: 'somethingnothere' }],
            },
          },
        },
        {},
      );
    }).toThrow('nested.inarray.0.Ref');
  });
});
