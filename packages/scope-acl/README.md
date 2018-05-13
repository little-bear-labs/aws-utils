# @conduitvc/scope-acl

This package provides an abstraction over dynamodb to provide a ACL functionality.

## Workflow

This library assumes that some entity specific id is available which is unique. That unique id is then used to store the acl information in a dynamodb table.

The acl is made of of many "scopes" a scope is a triple made up of (resource, action, id).

For example the following scope:

```
foo::bar::qux
```

Could be checked against a stored permission ACL of :

```
# note the wildcard *
foo::bar::*
```

The above stored permission will be valid when checked against the resource "foo" and the action "bar" and any "id"


## API

### Manager

The manager is the primary way of interacting with the dynamodb table which stores the ACL details for the entity (typically user).

```js
const aws = require('aws-sdk');
const { Manager } = require('@conduitvc/scope-acl');
const dynamodb = new aws.DynamoDB();
const manager = new Manager('TableName', dynamodb);
```

#### addScope

Add a scope to a given entity.

```js
await manager.addScope(id, {
  resource: 'foo',
  action: 'bar',
  id: 'id',
});
```

#### deleteScope

Add a scope to a given entity.

```js
// this will accept either a string or object as shown above.
await manager.deleteScope(id, 'foo::bar::id');
```

#### checkScope

Check if the given scope is available to the entity.

```js
await manager.checkScope(id, {
  resource: 'resource',
  action: 'action',
  id: '...',
});
```

#### deleteRecord

Delete the record of the entity in dynamodb.

```js
await manager.deleteRecord('id');
```