const { graphql } = require('graphql');
const { makeExecutableSchema } = require('graphql-tools');
const { typeDirective, inputDirective } = require('..');
const { makeExecutableSchema: inputExecSchema } = require('@conduitvc/graphql-input-schema');

describe('@conduitvc/graphql-scope-acl', () => {
  it('should validate fields', async () => {
    const typeDefs = `
      type Query {
        foo(id: ID!): ID! @acl(resource: "foo", action: "call", idArg: "id")
      }
    `;

    let checkScopes = true;
    let ranCheckScope = false;
    const Vistor = typeDirective(
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

  it('should allow using a function to identify manager', async () => {
    const typeDefs = `
      input InputMe @acl(resource: "foo", action: "call", idArg: "personId", module: "__test__/aclParam") {
        personId: ID!
      }

      type Query {
        foo(obj: InputMe!): ID!
      }
    `;

    let checkScopes = true;
    let ranCheckScope = false;
    const Vistor = inputDirective(
      () => ({
        async checkScope(id, scope) {
          ranCheckScope = true;
          expect(scope).toEqual({
            resource: 'foo',
            action: 'call',
            id: 'person',
          });
          return checkScopes;
        },
      }),
      ({ root: value }) => {
        expect(value).toMatchObject({ personId: 'person' });
        return 'foo';
      },
    );
    const schema = inputExecSchema({
      typeDefs,
      resolvers: {
        Query: {
          foo() {
            return 'foo';
          },
        },
      },
      inputDirectives: {
        acl: Vistor,
      },
    });

    const success = await graphql(schema, 'query($foo: InputMe!) { foo(obj: $foo) }', null, null, {
      foo: {
        personId: 'person',
      },
    });
    expect(success.errors).toBeFalsy();
    expect(ranCheckScope).toBe(true);

    checkScopes = false;
    const failure = await graphql(schema, 'query($foo: InputMe!) { foo(obj: $foo) }', null, null, {
      foo: {
        personId: 'person',
      },
    });
    expect(failure.errors).toBeTruthy();
    expect(failure.errors[0].message).toContain('foo::call::person');
  });
});
