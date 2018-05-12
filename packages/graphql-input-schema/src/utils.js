const GraphQLError = require('./GraphQLError');

function extractValueType(source, node, argKind) {
  const { kind, value } = node.value;
  if (kind !== argKind) {
    throw new GraphQLError(
      source,
      node.value,
      `Expected argument to be type of ${argKind} was ${kind}`,
    );
  }
  return value;
}

function extractName(node) {
  return node && node.name && node.name.value;
}

function extractArgumentValue(arg) {
  const { kind, value } = arg.value;
  switch (kind) {
    case 'ListValue':
      return arg.value.values.map(subArg => extractArgumentValue({ value: subArg }));
    case 'IntValue':
      return parseInt(value, 10);
    case 'FloatValue':
      return parseFloat(value);
    case 'StringValue':
    case 'BooleanValue':
      return value;
    default:
      // return the whole argument for downstream usage.
      return arg;
  }
}

function extractArguments(args) {
  if (!args.length) return {};
  return args.reduce((sum, arg) => {
    // eslint-disable-next-line no-param-reassign
    sum[extractName(arg)] = extractArgumentValue(arg);
    return sum;
  }, {});
}

function resolveType(type, state = {}) {
  if (!type) return state;
  switch (type.kind) {
    case 'ListType':
      return { ...resolveType(type.type), list: true };
    case 'NonNullType':
      return { ...resolveType(type.type), nullable: false };
    case 'NamedType':
      return {
        nullable: true,
        type: type.name.value,
        ...resolveType(type.type),
      };
    default:
      return state;
  }
}

function isCustomType(type) {
  switch (type) {
    case 'String':
    case 'Boolean':
    case 'Int':
    case 'Float':
    case 'Enum':
      return false;
    default:
      return true;
  }
}

function typeInfo(node) {
  const info = resolveType(node.type);
  return {
    ...info,
    isCustomType: isCustomType(info.type),
  };
}

module.exports = {
  extractValueType,
  extractName,
  extractArguments,
  extractArgumentValue,
  typeInfo,
  resolveType,
};
