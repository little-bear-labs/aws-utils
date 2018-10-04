const GraphQLJSON = require('graphql-type-json');

const {
  GraphQLDate,
  GraphQLTime,
  GraphQLDateTime,
} = require('graphql-iso-date');

const GraphQLPhoneType = require('graphql-phone-type');

const { EmailAddress, URL } = require('@okgrow/graphql-scalars');

const scalars = {
  AWSJSON: GraphQLJSON,
  AWSDate: GraphQLDate,
  AWSTime: GraphQLTime,
  AWSDateTime: GraphQLDateTime,
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
