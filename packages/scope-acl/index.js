const assert = require('assert');
const aws = require('aws-sdk');
const debug = require('debug')('@conduitvc-scope-acl');

// <resource>::<action>::<id>
const ScopeRegex = /^([a-zA-Z0-9./]+)::([a-zA-Z0-9*./]+)::(.*)$/;
const AllowAllChar = '*';

function scopeToString(scope) {
  if (typeof scope === 'string') return scope;
  const { resource, action, id } = scope;
  return `${resource}::${action}::${id}`;
}

function parseScope(input) {
  const matches = ScopeRegex.exec(input);
  if (!matches) {
    throw new Error('Invalid scope');
  }

  const [, resource, action, id] = matches;
  return { resource, action, id };
}

function matchesScope(toCheckScopeStr, scopeStringArray) {
  debug('check scope', toCheckScopeStr);
  const { resource, action, id } = parseScope(toCheckScopeStr);
  const scopes = scopeStringArray.map(str => parseScope(str));
  return !!scopes.find(scope => {
    debug('attempting to match scope', toCheckScopeStr, scope);
    // check the resource
    if (resource !== scope.resource) return false;
    // check the action
    if (scope.action !== AllowAllChar && scope.action !== action) return false;
    // check the id
    if (scope.id !== AllowAllChar && scope.id !== id) return false;
    debug('scope match', { toCheckScopeStr, scope });
    return true;
  });
}

function processScope(scope) {
  if (typeof scope === 'string') return scope;
  assert(typeof scope === 'object');
  const { resource, action, id } = scope;
  return `${resource}::${action}::${id}`;
}

class Manager {
  constructor(table, dynamodb) {
    assert(table, 'must pass table name');
    this.table = table;
    this.dynamodb = dynamodb;
    this.doc = new aws.DynamoDB.DocumentClient({ service: dynamodb });
  }

  async addScope(id, scope) {
    debug('add scope', { id, scope });
    // eslint-disable-next-line no-param-reassign
    scope = processScope(scope);
    assert(scope);
    assert(typeof scope === 'string');
    const params = {
      TableName: this.table,
      Key: { id },
      UpdateExpression: 'add #scopes :scopes',
      ExpressionAttributeNames: { '#scopes': 'scopes' },
      ExpressionAttributeValues: {
        ':scopes': this.doc.createSet(scope),
      },
    };
    await this.doc.update(params).promise();
  }

  async deleteScope(id, scope) {
    // eslint-disable-next-line no-param-reassign
    scope = processScope(scope);
    assert(scope);
    assert(typeof scope === 'string');
    const params = {
      TableName: this.table,
      Key: { id },
      UpdateExpression: 'delete #scopes :scopes',
      ExpressionAttributeNames: { '#scopes': 'scopes' },
      ExpressionAttributeValues: {
        ':scopes': this.doc.createSet(scope),
      },
    };
    await this.doc.update(params).promise();
  }

  async deleteRecord(id) {
    assert(id);
    await this.doc
      .delete({
        TableName: this.table,
        Key: {
          id,
        },
      })
      .promise();
  }

  async checkScope(id, scopeToCheck) {
    debug('check scope', { id, scopeToCheck });
    // eslint-disable-next-line no-param-reassign
    scopeToCheck = processScope(scopeToCheck);
    assert(id);
    assert(typeof scopeToCheck === 'string');
    const { Item: doc } = await this.doc
      .get({
        TableName: this.table,

        Key: { id },
        // since we are checking auth we require a consistent read (or at least we think we do).
        ConsistentRead: true,
      })
      .promise();

    // TODO: logging.
    if (!doc) return false;
    const { scopes: { values: scopes = [] } = {} } = doc;
    return matchesScope(scopeToCheck, scopes);
  }
}

module.exports = {
  Manager,
  parseScope,
  matchesScope,
  scopeToString,
};
