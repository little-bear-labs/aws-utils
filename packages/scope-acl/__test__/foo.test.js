const awsSetup = require('@conduitvc/aws-utils');
const uuid = require('uuid/v4');

const awsConfig = {
  tables: {
    UserScopesTable: uuid(),
  },
};

describe('foo', () => {
  beforeEach(() => awsSetup.bootstrapAWS(awsConfig));
  afterEach(() => awsSetup.resetAWS(awsConfig));
  it('should foo', () => {});
});
