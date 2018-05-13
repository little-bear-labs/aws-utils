const { graphql } = require('graphql');
const { makeExecutableSchema } = require('graphql-tools');
const makeACL = require('..');

describe('@conduitvc/graphql-scope-acl', () => {
  it('should validate fields', async () => {
    const typeDefs = `
      type Query {
        foo(id: ID!): ID! @acl(resource: "foo", action: "call", idArg: "id")
      }
    `;

    let checkScopes = true;
    let ranCheckScope = false;
    const Vistor = makeACL(
      {
        async checkScope(id, scope) {
          ranCheckScope = true;
          expect(scope).toEqual({
            resource: 'foo',
            action: 'call',
            id: 'bar',
          });
          return checkScopes;
        },
      },
      () => 'foo',
    );
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers: {
        Query: {
          foo() {
            return 'foo';
          },
        },
      },
      schemaDirectives: {
        acl: Vistor,
      },
    });

    const success = await graphql(schema, '{ foo(id: "bar") }');
    expect(success.errors).toBeFalsy();
    expect(ranCheckScope).toBe(true);

    checkScopes = false;
    const failure = await graphql(schema, '{ foo(id: "bar") }');
    expect(failure.errors).toBeTruthy();
    expect(failure.errors[0].message).toContain('foo::call::bar');
  });
});
