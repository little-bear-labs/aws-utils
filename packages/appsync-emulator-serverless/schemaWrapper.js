const { GraphQLScalarType } = require('graphql');
const GraphQLJSON = require('graphql-type-json');

const {
  GraphQLDate,
  GraphQLTime,
  GraphQLDateTime,
} = require('graphql-iso-date');

const GraphQLPhoneType = require('graphql-phone-type');

const { EmailAddress, URL } = require('@okgrow/graphql-scalars');

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
  AWSPhone: GraphQLPhoneType,
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
