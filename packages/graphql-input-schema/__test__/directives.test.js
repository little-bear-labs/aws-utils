const { makeExecutableSchema } = require('../src/transformer');
const { graphql } = require('graphql');
const allValidators = require('../src/directives');
// for syntax highlighting...
const { stripIndent: gql } = require('common-tags');

describe('transformers', () => {
  const resolvers = {
    Mutation: {
      test: () => {},
    },
    Query: {},
  };
  const executeArray = (schema, variables) =>
    graphql({
      schema,
      source: `
        mutation test($input: [Input]!) {
          test(input: $input)
        }
      `,
      variableValues: variables,
    });
  const execute = (schema, variables) =>
    graphql({
      schema,
      source: `
        mutation test($input: Input!) {
          test(input: $input)
        }
      `,
      variableValues: variables,
    });

  const hasError = (result, message) => {
    expect(result.errors).toBeTruthy();
    expect(result.errors[0].message).toMatch(message);
  };

  describe('isIn', () => {
    const schema = makeExecutableSchema({
      typeDefs: gql`
        input Input {
          value: [String]! @validateIsIn(in: ["one", "two", "three"])
        }

        type Mutation {
          test(input: [Input]!): ID
        }

        type Query {
          test: String
        }
      `,
      resolvers,
    });
    test('valid', async () => {
      const result = await executeArray(schema, {
        input: { value: ['one', 'two'] },
      });
      expect(result.errors).not.toBeTruthy();
    });

    test('invalid', async () => {
      const result = await executeArray(schema, {
        input: { value: ['three', 'four'] },
      });
      hasError(result, 'not in list one, two, three');
    });
  });
  describe('isNotIn', () => {
    const schema = makeExecutableSchema({
      typeDefs: gql`
        input Input {
          value: [String]! @validateIsNotIn(in: ["one", "two", "three"])
        }

        type Mutation {
          test(input: [Input]!): ID
        }

        type Query {
          test: String
        }
      `,
      resolvers,
    });
    test('invalid', async () => {
      const result = await executeArray(schema, {
        input: { value: ['one', 'two'] },
      });
      hasError(result, 'disallowed');
    });

    test('valid', async () => {
      const result = await executeArray(schema, {
        input: { value: ['four'] },
      });
      expect(result.errors).not.toBeTruthy();
    });
  });

  // some of the simple single values
  [
    { method: 'validateIsAlpha', valid: 'foo', invalid: '1222' },
    {
      method: 'validateIsAlphanumeric',
      valid: 'foo',
      invalid: '1222--^^^^###',
    },
    {
      method: 'validateIsJSON',
      valid: JSON.stringify({ foo: 1 }),
      invalid: '1222--^^^^###',
    },
    {
      method: 'validateLessThan',
      valid: 1,
      invalid: 200,
      args: 'number: 101',
      message: 'greater than 101',
    },
    {
      method: 'validateGreaterThan',
      valid: 200,
      invalid: 1,
      args: 'number: 101',
      message: 'less than 101',
    },
    {
      method: 'validateLength',
      valid: 'aa',
      invalid: 'aaaaaa',
      args: 'min: 2, max: 5',
      message: '2-5',
    },
    {
      method: 'validateByteLength',
      valid: 'aa',
      invalid: 'aaaaaa',
      args: 'min: 2, max: 5',
      message: '2-5',
    },
    {
      method: 'validateMinLength',
      valid: 'aa',
      invalid: 'a',
      args: 'min: 2',
      message: '2',
    },
    {
      method: 'validateMaxLength',
      invalid: 'aaa',
      valid: 'a',
      args: 'max: 2',
      message: '2',
    },
  ].forEach(({ method, valid, invalid, message, args }) => {
    describe(method, () => {
      const schema = makeExecutableSchema({
        typeDefs: gql`
            input Input {
              value: String! @${method}${args ? `(${args})` : ''}
            }

            type Mutation {
              test(input: Input!): ID
            }

            type Query {
              test: String
            }
          `,
        resolvers,
      });
      test('invalid', async () => {
        const result = await execute(schema, {
          input: { value: invalid },
        });
        hasError(result, message || method);
      });

      test('valid', async () => {
        expect(Object.keys(allValidators)).toContain(method);
        const result = await execute(schema, {
          input: { value: valid },
        });
        expect(result.errors).not.toBeTruthy();
      });
    });
  });
});
