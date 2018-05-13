const assert = require('assert');
const { Source, parse: parseGQL } = require('graphql/language');
const processInputs = require('./processInputs');
const { extractName, resolveType } = require('./utils');

function buildValidateArgHandler(typeMeta, transformer) {
  return async (value, config) => {
    if (typeMeta.nullable && value === null) return value;
    return transformer(value, config);
  };
}

function buildValidateArgHandlerArray(typeMeta, transformer) {
  return async (array, config) => {
    if (typeMeta.nullable && array === null) return array;
    return Promise.all(array.map(value => transformer(value, config)));
  };
}

function buildFieldTransformer(input, typeMeta) {
  if (!input || !input.transformer) {
    return value => value;
  }

  if (typeMeta.list) {
    return buildValidateArgHandlerArray(typeMeta, input.transformer);
  }

  return buildValidateArgHandler(typeMeta, input.transformer);
}

function fieldToResolver(typeName, resolvers, field, inputTypes) {
  const resolverType = resolvers[typeName];
  if (!resolverType) {
    throw new Error(`Resolvers are missing handlers for type: ${typeName}`);
  }

  const fieldName = extractName(field);
  const resolver = resolverType[fieldName];
  if (!resolver && field.arguments.length) {
    throw new Error(`Resolver type ${typeName}.${extractName(field)} is unhandled`);
  }

  // convert arguments into argument preprocessors
  const argHandlers = field.arguments.reduce((sum, arg) => {
    const name = extractName(arg);

    const typeMeta = resolveType(arg.type);
    const input = inputTypes[typeMeta.type];

    return {
      ...sum,
      [name]: buildFieldTransformer(input, typeMeta),
    };
  }, {});

  return async (root, args, ctx, info) => {
    const parsedArgs = {};

    for (const [key, value] of Object.entries(args)) {
      assert(argHandlers[key], 'missing argument handler this should never happen!');
      // XXX: These could run in parallel
      parsedArgs[key] = await argHandlers[key](value, {
        context: ctx,
        info,
        args,
      });
    }

    return resolver(root, parsedArgs, ctx, info);
  };
}

function makeExecutableSchema({
  typeDefs,
  resolvers = {},
  classes = {},
  inputDirectives = {},
  config = {},
  ...otherOptions
}) {
  // XXX: yes we do end up parsing the source twice :/
  const source = new Source(typeDefs);

  const baseConfig = {
    // we will add context based on the request later.
    classes,
    inputDirectives: {
      ...require('./directives'),
      ...inputDirectives,
    },
    ...config,
  };

  const [doc, inputTypes] = processInputs(source, parseGQL(source), baseConfig);

  // build the resolvers
  const topLevelResolvers = doc.definitions
    .filter(({ kind }) => kind === 'ObjectTypeDefinition')
    .map((node) => {
      const name = extractName(node);
      const fieldResolvers = node.fields.reduce(
        (sum, field) => ({
          [extractName(field)]: fieldToResolver(name, resolvers, field, inputTypes),
          ...sum,
        }),
        {},
      );
      return [name, fieldResolvers];
    })
    .reduce(
      (sum, [name, fieldResolvers]) => ({
        ...sum,
        [name]: fieldResolvers,
      }),
      {},
    );

  return require('graphql-tools').makeExecutableSchema({
    typeDefs: doc,
    resolvers: topLevelResolvers,
    ...otherOptions,
  });
}

module.exports = {
  makeExecutableSchema,
};
