const assert = require('assert');
const aws = require('aws-sdk');

// <resource>::<action>::<id>
const ScopeRegex = /^([a-zA-Z0-9]+)::([a-zA-Z0-9*]+)::(.*)$/;
const AllowAllChar = '*';

function parseScope(input) {
  const matches = ScopeRegex.exec(input);
  if (!matches) {
    throw new Error('Invalid scope');
  }

  const [, resource, action, id] = matches;
  return { resource, action, id };
}

function matchesScope(toCheckScopeStr, scopeStringArray) {
  const { resource, action, id } = parseScope(toCheckScopeStr);
  const scopes = scopeStringArray.map(str => parseScope(str));
  return scopes.find((scope) => {
    // check the resource
    if (resource !== scope.resource) return false;
    // check the action
    if (scope.action !== AllowAllChar && scope.action !== action) return false;
    // check the id
    if (scope.id !== AllowAllChar && scope.id !== id) return false;
    return true;
  });
}

class Scope {
  // similar to ARN <resource>::<id>::<action> but we do not
  // store them as strings.
  constructor({ resource, id, action }) {
    assert(resource, 'scope must have resource');
    assert(id, 'scope must have id');
    assert(action, 'scope must have action');
    Object.assign(this, { resource, id, action });
  }
}

class Manager {
  constructor(dynamodb) {
    this.dynamodb = dynamodb;
    this.doc = new aws.DynamoDB.DocumentClient({ service: dynamodb });
  }
}

module.exports = {
  Manager,
  Scope,
  parseScope,
  matchesScope,
};
