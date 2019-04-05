module.exports.graphqlJSON = (event, context, callback) =>
  callback(null, {
    test: 'yup',
  });

module.exports.graphqlArrayJSON = (event, context, callback) =>
  callback(null, [{ test: 'yup.0' }, { test: 'yup.1' }]);

module.exports.graphqlBatchJSON = (events, context, callback) =>
  callback(
    null,
    events.map(e => [
      { test: `${e.source.test}.0` },
      { test: `${e.source.test}.1` },
    ]),
  );

module.exports.graphql = (event, context, callback) => {
  const field = Object.keys(event.arguments)[0];
  return callback(null, event.arguments[field]);
};
