const { getLocation } = require('graphql/language');

class GraphQLError extends Error {
  constructor(source, node, str) {
    const { codeFrameColumns } = require('@babel/code-frame');
    const start = getLocation(source, node.loc.start);
    const end = getLocation(source, node.loc.end);
    const frame = codeFrameColumns(source.body, {
      start,
      end,
    });
    super(`${str}\n\n${frame}`);
  }
}

module.exports = GraphQLError;
