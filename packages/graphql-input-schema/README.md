# GraphQL Input Schema [![Build Status](https://travis-ci.org/ConduitVC/graphql-input-schema.svg?branch=master)](https://travis-ci.org/ConduitVC/graphql-input-schema)

This library uses AST rewriting techniques to provide directives for input types. The library comes with built in support to convert input types into classes (newables) and validate fields (nested & array support included) of input types. This is intended to cut down on boilerplate and make your graphql usage more declarative.

The directives used in this library are intended to be for for transformations, validation, ACL and more.

## Usage

The API is intended to be a superset of `makeExecutableSchema` from [graphql-tools](https://github.com/apollographql/graphql-tools) `makeExecutableSchema`. Any option that can be passed into that function will also work here. This library is internally wrapping `makeExecutableSchema` after extracting information from the AST.

NOTE: You must depend on both `graphql` and `graphql-tools`. They are peer dependencies.

```js
const { makeExecutableSchema } = require('graphql-input-schema');

class UserCreation {
  constructor(input) {
    Object.assign(this, input);
  }
}

const resolvers = {
  Mutation: {
    createUser(
      root,
      { user /* if no errors are thrown this will be a User instance */ },
      ctx,
    ) {
      // ...
    },
  },
};

const schema = makeExecutableSchema({
  typeDefs: `
    # your graphql schema as usual ...

    # Additional functionality for input types
    input CreateUser @class(name: "UserCreation") {
      name: String!
        @validateMinLength(min: 3)
        @validateByteLength(min: 0, max: 255)
    }

    type Mutation {
      createUser(user: CreateUser): ID!
    }
  `,
  resolvers,
  classes: { UserCreation },
});
```

### Custom Transformers

In addition to the many built in transformers it's easy to add more.

```js
const schema = makeExecutableSchema({
  // ... stuff above
  transformers: {
    toUpperCase: value => value.toUpperCase(),
    // transformers can be async functions.
    ValidateIsFoo: async value => {
      if (value !== 'foo') throw new Error('where is the foo?');
      // must return original or transformed value.
      return value;
    },
  },
});
```

NOTE: The built in transformers will (unless otherwise noted) iterate through arrays and validate each element. For maximum flexibility custom iterators must implement that functionality themselves if they wish to specifically validate elements instead of arrays. The `TypeMeta` will tell if you if the given type is an array.

NOTE: If the element is `nullable` and the value is null transformers will not be run.

### Type signature for validator/transformer functions.

````js
type Config = {
  type: {
    nullable: boolean,
    // GraphQL type name (such as String)
    type: string,
    // Is the type wrapped up in an Array?
    list?: boolean,
    // Is the GraphQL type a user created type ?
    isCustomType: boolean,
  },
  // your graphql context object
  context: any,
  // your graphql info object
  info: any,
  // arguments to the resolver
  args: Arguments,
  // name to class constructor mapping
  classes: { [key: string]: Object },
};

type Arguments = {
  [key: string]: mixed,
};

// Arguments are taken from the GraphQL arguments passed into the directive.
// For example to get the arguments { min: 5, really: true } the following
// would be passed.
//
// ```graphql
// @ValidatorName(min: 5, really: true)
// ```
type TransformerFn = (
  value: mixed,
  args: Arguments,
  config: Config,
) => Promise<mixed> | mixed;
````

### Example of adding directives

```js
const schema = makeExecutableSchema({
  typeDefs: gql`
    scalar JSON

    input Input @AddField @AddAnotherField {
      value: String! @ToUpper
    }

    type Mutation {
      test(input: Input!): JSON
    }

    type Query {
      test: String
    }
  `,
  resolvers,
  transformers: {
    ToUpper(value, args, config) {
      return value.toUpperCase();
    },

    AddField(value, args, config) {
      return {
        ...value,
        foo: 'qux',
        z: true,
      };
    },

    AddAnotherField(value, args, config) {
      return {
        ...value,
        foo: 'bar',
      };
    },
  },
});
```

## Directives

NOTE: All directives will apply to input objects and fields. Many of these directives only make sense for one or the other but not both.

Validations are from [class-validator](https://github.com/typestack/class-validator#manual-validation) see their documentation for more details.

### @validateIsIn(in: [String | Int | Float]!)

Validate if value is in list of "in"

### @validateIsNotIn(in: [String | Int | Float]!)

Validate if value is not in list of "in"

### @validateMinLength(min: Int!)

### @validateMaxLength(max: Int!)

### @validateGreaterThan(number: Int!)

### @validateLessThan(number: Int!)

### @validateLength(min: Int!, max: Int!)

### @validateByteLength(min: Int!, max: Int!)

### @validateIsAlpha

### @validateIsAlphanumeric

### @validateIsAscii

### @validateIsBase64

### @validateIsCreditCard

### @validateIsEmail

### @validateIsFQDN

### @validateIsURL

### @validateIsFullWidth

### @validateIsHalfWidth

### @validateIsVariableWidth

### @validateIsHexColor

### @validateIsHexadecimal

### @validateIsISIN

### @validateIsISO8601

### @validateIsJSON

### @validateIsLowercase

### @validateIsMongoId

### @validateIsMultibyte

### @validateIsSurrogatePair

### @validateIsUppercase

### @validateIsMilitaryTime

### @validateIsPositive

### @validateIsNegative
