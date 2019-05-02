/**
 * This module provides tools to traverse a given object and apply transformations
 * to the object using a cloud formation like syntax. We're not trying to replace
 * all CF functionality just what is needed to run the appsync emulator.
 */

const DynamoDBTable = 'AWS::DynamoDB::Table';

function lookupResourcesFromCtx(resource, ctx) {
  return ctx.resources && ctx.resources.Resources[resource];
}

function lookupResourcePropertyFromCtx(cfObject, prop) {
  return cfObject && cfObject.Properties && cfObject.Properties[prop];
}

function cfRef(value, ctx) {
  const cfObject = lookupResourcesFromCtx(value, ctx);
  if (!cfObject) {
    return false;
  }

  const { Type: type } = cfObject;
  if (!type) {
    return false;
  }

  switch (type) {
    case DynamoDBTable:
      return lookupResourcePropertyFromCtx(cfObject, 'TableName');
    default:
      return false;
  }
}

const cloudFormationHandlers = {
  Ref: cfRef,
};

function processObject(object, ctx, objectPath = []) {
  if (!object || typeof object !== 'object') {
    return object;
  }

  if (Array.isArray(object)) {
    return object.map((value, idx) =>
      processObject(value, ctx, [...objectPath, idx]),
    );
  }

  const entries = Object.entries(object);
  return entries.reduce((sum, [key, value]) => {
    const newObjectPath = [...objectPath, key];
    if (entries.length === 1 && cloudFormationHandlers[key]) {
      const resolvedResource = processObject(
        cloudFormationHandlers[key](value, ctx),
        ctx,
        newObjectPath,
      );
      if (resolvedResource !== false) {
        return resolvedResource;
      }
    }
    return {
      ...sum,
      [key]: processObject(value, ctx, newObjectPath),
    };
  }, {});
}

function cloudFormationProcessor(input) {
  const config = { ...input };
  const ctx = { resources: config.resources };
  // remove useless serverless object so we do not traverse functions.
  delete config.serverless;
  return processObject(config, ctx);
}

module.exports = { cloudFormationProcessor };
