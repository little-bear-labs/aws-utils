module.exports.graphqlJSON = (event, context, callback) =>
  callback(null, {
    test: 'yup',
  });

module.exports.graphql = (event, context, callback) => {
  const field = Object.keys(event.arguments)[0];
  return callback(null, event.arguments[field]);
};
