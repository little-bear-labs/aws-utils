const awsSetup = require('@conduitvc/aws-utils');
const uuid = require('uuid/v4');
const subject = require('../');

const awsConfig = {
  tables: {
    UserScopesTable: uuid(),
  },
};

describe('ScopeACL', () => {
  let client;
  beforeEach(async () => {
    const { dynamodb } = await awsSetup.bootstrapAWS(awsConfig);
    client = dynamodb;
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
});
