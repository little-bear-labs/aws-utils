const { makeExecutableSchema } = require('../src/transformer');
const { graphql } = require('graphql');
// for syntax highlighting...
const deepMerge = require('lodash.merge');
const { stripIndent: gql } = require('common-tags');

describe('transformers', () => {
  const resolvers = {
    Mutation: {
      test: () => {},
    },
    Query: {},
  };
  const execute = (schema, variables) => graphql({
    schema,
    source: gql`
        mutation test($input: Input!) {
          test(input: $input)
        }
      `,
    variableValues: variables,
  });

  test('transformer ordering', async () => {
    const schema = makeExecutableSchema({
      typeDefs: gql`
        scalar JSON

        input Input @AddField @AddAnotherField {
          value: String!
        }

        type Mutation {
          test(input: Input!): JSON
        }

        type Query {
          test: String
        }
      `,
      resolvers: deepMerge(resolvers, {
        Mutation: {
          test: (args, { input }) => input,
        },
      }),
      transformers: {
        async AddField(value) {
          return {
            ...value,
            foo: 'qux',
            z: true,
          };
        },

        AddAnotherField(value) {
          expect(value.foo).toBe('qux');
          return {
            ...value,
            foo: 'bar',
          };
        },
      },
    });

    const result = await execute(schema, {
      input: {
        value: 'foo',
      },
    });
    const {
      data: { test: resultValue },
    } = result;
    expect(resultValue).toMatchObject({
      value: 'foo',
      foo: 'bar',
      z: true,
    });
  });
});
