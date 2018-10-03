const GraphQLJSON = require('graphql-type-json');

const {
  GraphQLDate,
  GraphQLTime,
  GraphQLDateTime,
} = require('graphql-iso-date');

const {
  EmailAddress,
  RegularExpression,
  URL,
} = require('@okgrow/graphql-scalars');

const GraphQLPhone = new RegularExpression('GraphQLPhone', /^.*$/);

const scalars = {
  AWSJSON: GraphQLJSON,
  AWSDate: GraphQLDate,
  AWSTime: GraphQLTime,
  AWSDateTime: GraphQLDateTime,
  AWSPhone: GraphQLPhone,
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
