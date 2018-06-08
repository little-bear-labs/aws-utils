const assert = require('assert');
const { defaultResolver } = require('graphql');
const { SchemaDirectiveVisitor } = require('graphql-tools');
const { scopeToString } = require('@conduitvc/scope-acl');

const typeDirective = (getManager, getId) => {
  class SchemaVistor extends SchemaDirectiveVisitor {
    visitFieldDefinition(field) {
      const { args } = this;
      assert(args.resource, '@acl on field must have resource attribute');
      assert(args.action, '@acl on field must have action attribute');
      assert(args.idArg, '@acl on field must have idArg attribute');

      const { resolve = defaultResolver } = field;
      // eslint-disable-next-line no-param-reassign
      field.resolve = async (root, resolverArgs, ctx, info) => {
        const params = {
          root,
          arguments: resolverArgs,
          info,
          context: ctx,
          acl: args,
        };
        const entityId = getId(params);
        assert(entityId, 'getId must return a value');
        const id = resolverArgs[args.idArg];
        assert(id, `id argument: ${args.idArg} must have value`);
        const manager =
          typeof getManager === 'function' ? getManager(params) : getManager;
        assert(manager, 'manager must be passed');
        const scope = { resource: args.resource, action: args.action, id };
        if (!(await manager.checkScope(entityId, scope))) {
          throw new Error(
            `Entity: ${entityId} does not have permission to execute scope: ${scopeToString(
              scope,
            )}`,
          );
        }
        return resolve(root, resolverArgs, ctx, info);
      };

      return field;
    }
  }

  return SchemaVistor;
};

const inputDirective = (getManager, getId) => async (
  value,
  args,
  { context, info },
) => {
  assert(args);
  const { resource, action, idArg } = args;
  assert(resource, '@acl on input object must have resource attribute');
  assert(action, '@acl on input object must have action attribute');
  assert(idArg, '@acl on input object must have idArg attribute');

  const params = {
    root: value,
    arguments: null,
    info,
    context,
    acl: args,
  };

  const id = value[idArg];
  assert(id, `value has input for ${idArg}`);
  const entityId = getId(params);
  assert(entityId, 'getId must return an entity id');
  const manager =
    typeof getManager === 'function' ? getManager(params) : getManager;
  assert(manager, 'manager must be passed');

  const scope = { resource, action, id };
  if (!(await manager.checkScope(entityId, scope))) {
    throw new Error(
      `Entity: ${entityId} does not have permission to execute scope: ${scopeToString(
        scope,
      )}`,
    );
  }

  return value;
};

module.exports = { typeDirective, inputDirective };
