const subject = require('../');
const fs = require('fs');
const { execSync } = require('child_process');

describe('emulator operations', () => {
  const dbPath = `${__dirname}/dynamodb-data/${process.pid}`;
  // taken from dynamodb examples.
  const dbParams = {
    AttributeDefinitions: [
      {
        AttributeName: 'Artist',
        AttributeType: 'S',
      },
      {
        AttributeName: 'SongTitle',
        AttributeType: 'S',
      },
    ],
    KeySchema: [
      {
        AttributeName: 'Artist',
        KeyType: 'HASH',
      },
      {
        AttributeName: 'SongTitle',
        KeyType: 'RANGE',
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  const ensureNoDbPath = () => {
    if (fs.existsSync(dbPath)) {
      execSync(`rm -rf ${dbPath}`);
    }
  };

  beforeEach(ensureNoDbPath);
  afterEach(ensureNoDbPath);

  let emulators;
  beforeEach(() => {
    emulators = [];
    jest.setTimeout(40 * 1000);
  });
  afterEach(() => Promise.all(emulators.map(emu => emu.terminate())));

  it('should support in memory operations', async () => {
    const emu = await subject.launch();
    emulators.push(emu);
    const dynamo = subject.getClient(emu);

    const tables = await dynamo.listTables().promise();
    expect(tables).toEqual({ TableNames: [] });
  });

  it('should preserve state between restarts with dbPath', async () => {
    const emuOne = await subject.launch({ dbPath });
    emulators.push(emuOne);
    const dynamoOne = subject.getClient(emuOne);
    await dynamoOne
      .createTable({
        TableName: 'foo',
        ...dbParams,
      })
      .promise();
    await emuOne.terminate();

    const emuTwo = await subject.launch({ dbPath });
    emulators.push(emuTwo);
    const dynamoTwo = await subject.getClient(emuTwo);
    expect(await dynamoTwo.listTables().promise()).toEqual({
      TableNames: ['foo'],
    });
  });

  it('should start on specific port', async () => {
    const port = await require('portfinder').getPortPromise();
    const emu = await subject.launch({ port });
    emulators.push(emu);
    expect(emu.port).toBe(port);
  });
});
