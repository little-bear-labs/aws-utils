const awsSetup = require('@conduitvc/aws-utils');
const uuid = require('uuid/v4');
const subject = require('../');

const awsConfig = {
  tables: {
    UserScopesTable: uuid(),
  },
};

describe('ScopeACL', () => {
  let dynamodb;
  beforeEach(async () => {
    const { dynamodb: client } = await awsSetup.bootstrapAWS(awsConfig);
    dynamodb = client;
  });
  afterEach(() => awsSetup.resetAWS(awsConfig));

  describe('parseScope', () => {
    describe('should fail for invalid scopes', () => {
      ['', 'zz', 'foo::۞::', '::::foo'].forEach((scope) => {
        it(`should fail to parse: ${scope}`, () => {
          expect(() => {
            subject.parseScope(scope);
          }).toThrowError('Invalid scope');
        });
      });
    });

    describe('it should pass for valid scopes', () => {
      [
        {
          scope: 'foo::bar::quxr::!',
          expected: {
            resource: 'foo',
            action: 'bar',
            id: 'quxr::!',
          },
          matches: ['foo::bar::quxr::!'],
          notMatches: ['*::*::*', 'foo::bar::1'],
        },
        {
          scope: 'a.b.c::write/action::quxr::!',
          expected: {
            resource: 'a.b.c',
            action: 'write/action',
            id: 'quxr::!',
          },
          matches: ['a.b.c::write/action::quxr::!'],
          notMatches: ['a.b.c::write::qqqq'],
        },
        {
          scope: 'f999oo::bar::۞',
          expected: {
            resource: 'f999oo',
            action: 'bar',
            id: '۞',
          },
          matches: ['f999oo::bar::۞'],
          notMatches: ['f999oo::bar::'],
        },
        {
          scope: 'foo::*::quxr::!',
          expected: {
            resource: 'foo',
            action: '*',
            id: 'quxr::!',
          },
          matches: ['foo::QUX::quxr::!', 'foo::thisisalongstringfullofthings999999::quxr::!'],
          notMatches: ['bar::qux::foo'],
        },
        {
          scope: 'foo::*::*',
          expected: {
            resource: 'foo',
            action: '*',
            id: '*',
          },
          matches: ['foo::bar::qux'],
          notMatches: ['nuts::STAR::STAR'],
        },
      ].forEach(({
        scope, expected, matches = [], nonMatches = [],
      }) => {
        describe(`for ${scope}`, () => {
          it(`should parse scope : ${scope}`, () => {
            expect(subject.parseScope(scope)).toEqual(expected);
          });

          matches.forEach((scopeToMatch) => {
            it(`it should match ${scopeToMatch}`, () => {
              expect(subject.matchesScope(scopeToMatch, [scope])).toBeTruthy();
            });
          });

          nonMatches.forEach((scopeToMatch) => {
            it(`it should not match ${scopeToMatch}`, () => {
              expect(subject.matchesScope(scopeToMatch, [scope])).toBeFalsy();
            });
          });
        });
      });
    });
  });

  describe('scope workflows', () => {
    it('should add scope', async () => {
      const manager = new subject.Manager(awsConfig.tables.UserScopesTable, dynamodb);
      const id = 'foo';

      expect(await manager.checkScope(id, 'foo::bar::qux')).toBeFalsy();
      await manager.addScope(id, { resource: 'foo', action: 'bar', id: 'qux' });
      expect(await manager.checkScope(id, 'foo::bar::qux')).toBeTruthy();
      expect(await manager.checkScope(id, { resource: 'foo', action: 'bar', id: 'qux' })).toBeTruthy();
      await manager.deleteScope(id, 'foo::bar::qux');
      expect(await manager.checkScope(id, 'foo::bar::qux')).toBeFalsy();
      await manager.deleteRecord(id);
      expect(await manager.checkScope(id, 'foo::bar::qux')).toBeFalsy();
    });
  });
});
