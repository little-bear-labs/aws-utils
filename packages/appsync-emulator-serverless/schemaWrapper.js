const GraphQLJSON = require('graphql-type-json');

const scalars = {
  AWSJSON: GraphQLJSON,
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
