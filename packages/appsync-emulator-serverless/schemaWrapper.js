const { GraphQLScalarType, GraphQLError, Kind } = require('graphql');
const GraphQLJSON = require('graphql-type-json');
const { isValidNumber, getNumberType } = require('libphonenumber-js');

const {
  GraphQLDate,
  GraphQLTime,
  GraphQLDateTime,
} = require('graphql-iso-date');

const { EmailAddress, URL } = require('@okgrow/graphql-scalars');

const phoneValidator = (ast, { country = 'US', type } = {}) => {
  const { kind, value } = ast;
  if (kind !== Kind.STRING) {
    throw new GraphQLError(
      `Query error: Can only parse strings got a: ${kind}`,
      [ast],
    );
  }

  let isValid = isValidNumber(value, country);
  if (isValid && type) {
    isValid = getNumberType(value, country) === type;
  }
  if (!isValid) {
    throw new GraphQLError('Query error: Not a valid phone number', [ast]);
  }

  return value;
};

class AWSPhone extends GraphQLScalarType {
  constructor(options = {}) {
    const { name, description } = options;
    super({
      name,
      description,
      serialize: value => {
        const ast = {
          kind: Kind.STRING,
          value,
        };
        return phoneValidator(ast, options);
      },
      parseValue: value => {
        const ast = {
          kind: Kind.STRING,
          value,
        };
        return phoneValidator(ast, options);
      },
      parseLiteral: ast => phoneValidator(ast, options),
    });
  }
}

const AWSDate = new GraphQLScalarType({
  name: 'AWSDate',
  description: GraphQLDate.description,
  serialize(value) {
    return GraphQLDate.serialize(value);
  },
  parseValue(value) {
    return GraphQLDate.parseValue(value) ? value : undefined;
  },
  parseLiteral(value) {
    return GraphQLDate.parseLiteral(value) ? value.value : undefined;
  },
});

const AWSTime = new GraphQLScalarType({
  name: 'AWSTime',
  description: GraphQLTime.description,
  serialize(value) {
    return GraphQLTime.serialize(value);
  },
  parseValue(value) {
    return GraphQLTime.parseValue(value) ? value : undefined;
  },
  parseLiteral(value) {
    return GraphQLTime.parseLiteral(value) ? value.value : undefined;
  },
});

const AWSDateTime = new GraphQLScalarType({
  name: 'AWSDateTime',
  description: GraphQLDateTime.description,
  serialize(value) {
    return GraphQLDateTime.serialize(value);
  },
  parseValue(value) {
    return GraphQLDateTime.parseValue(value) ? value : undefined;
  },
  parseLiteral(value) {
    return GraphQLDateTime.parseLiteral(value) ? value.value : undefined;
  },
});

const scalars = {
  AWSJSON: GraphQLJSON,
  AWSDate,
  AWSTime,
  AWSDateTime,
  AWSPhone,
  AWSEmail: EmailAddress,
  AWSURL: URL,
};

const wrapSchema = schemaString => {
  const scalarStrings = Object.keys(scalars)
    .map(scalarKey => `scalar ${scalarKey}\n`)
    .join('');

  return scalarStrings + schemaString;
};

module.exports = {
  scalars,
  wrapSchema,
};
