const GraphQLJSON = require('graphql-type-json');

const {
  GraphQLDate,
  GraphQLTime,
  GraphQLDateTime,
} = require('graphql-iso-date');

const { EmailAddress, PhoneNumber, URL } = require('@okgrow/graphql-scalars');

const scalars = {
  AWSJSON: GraphQLJSON,
  AWSDate: GraphQLDate,
  AWSTime: GraphQLTime,
  AWSDateTime: GraphQLDateTime,
  AWSEmail: EmailAddress,
  AWSPhone: PhoneNumber,
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
