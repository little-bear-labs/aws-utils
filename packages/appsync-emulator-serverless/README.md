# AppSync Emulator (Serverless)

This module provides emulation and testing helpers for use with AWS AppSync. Currently this depends on using https://github.com/sid88in/serverless-appsync-plugin and following the conventions.

It is possible to use this emulator without serverless by mirroring the structure defined there. In the future we will provide other methods of configuring the emulator.

## AppSync Features

We aim to support the majority of appsync features (as we use all of them except elastic search).

* Lambda source (only tested with serverless functions, including Node, Python)
* DynamoDB source (batch operations, all single table operations, etc.)
* HTTP(S) source
* NONE source
* Full VTL support ($util) and compatibility with Java stdlib
* Support for `API_KEY` and `AMAZON_COGNITO_USER_POOLS` authentication
* Subscriptions

## Requirements

* Java\*

\*If installing DynamoDB Local.

## Installation

[DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html) is an optional dependency and installed by default. If you would rather provide your own DynamoDB server, you can instruct npm/yarn not to install optional dependencies.

```
npm i @conduitvc/appsync-emulator-serverless [--no-optional]
```

or

```
yarn add @conduitvc/appsync-emulator-serverless [--ignore-optional]
```

## Usage

If using the DynamoDB emulator, data is preserved between emulator runs and is stored in `.dynamodb` in the same directory that `package.json` would be in.

### As a CLI

```sh
# NOTE unless you assign a specific port a random one will be chosen.
yarn appsync-emulator --port 62222
```

#### dynamodb with fixed port

optional start dynamodb at a fixed port - e.g. 8000

```sh
# NOTE unless you assign a specific port for dynamodb a random one will be chosen.
yarn appsync-emulator --port 62222 --dynamodb-port 8000
```

to access the dynamodb instance using javascript you need to use the following configuration:

```
const { DynamoDB } = require('aws-sdk');
const dynamodb = new DynamoDB({
  endpoint: 'http://localhost:8000',
  region: 'us-fake-1',
  accessKeyId: 'fake',
  secretAccessKey: 'fake',
});
const client = new DynamoDB.DocumentClient({ service: dynamodb });
```

#### Custom build prefix for webpack, typescript

For compatibility with plugins such as Serverless Webpack that allow the usage of webpack
you will need to add the following configuration to your project's `serverless.yml` file.

```
custom:
  appsync-emulator:
    buildPrefix: $PREFIX_LOCATION
```

Where `$PREFIX_LOCATION` is your specified webpack build path i.e. `.webpack`

## Testing

### Jest

We extensively use jest so bundle a jest specific helper (which likely will work for mocha as well).

```js
const gql = require('graphql-tag');
const { AWSAppSyncClient } = require('aws-appsync');

// we export a specific module for testing.
const createAppSync = require('@conduitvc/appsync-emulator-serverless/jest');
// required by apollo-client
global.fetch = require('node-fetch');

describe('graphql', () => {
  const appsync = createAppSync();

  it('Type.resolver', async () => {
    await appsync.client.query({
      query: gql`
        ....
      `,
    });
  });
});
```

### generic.

(Below example is jest but any framework will work)

```js
const gql = require('graphql-tag');
const { AWSAppSyncClient } = require('aws-appsync');

// we export a specific module for testing.
const {
  create,
  connect,
} = require('@conduitvc/appsync-emulator-serverless/tester');
// required by apollo-client
global.fetch = require('node-fetch');

describe('graphql', () => {
  let server, client;
  beforeEach(async () => {
    // by default, ths create method will spin up a dynamodb emulator in memory using java
    // to utilize another dynamodb instance instead, pass in a valid dynamodbConfig to create:
    /* below works with localstack
      create({
        dynamodbConfig: {
          endpoint: 'http://localhost:61023',
          accessKeyId: 'fake',
          secretAccessKey: 'fake',
          region: 'fake',
        }
      })
    */
    server = await create();
    client = connect(server, AWSAppSyncClient);
  });

  // important to clear state.
  afterEach(async () => server.close());
  // very important not to leave java processes lying around.
  afterAll(async () => server.terminate());

  it('Type.resolver', async () => {
    await client.query({
      query: gql`
        ....
      `,
    });
  });
});
```

### Python Lambda

Add the following description for a Python Lambda (the runtime flag is important). In the following example, it will look for a file named
handler.py in the current directory with a method called `composedJSON`.

```
functions:
  composedJSON:
    handler: handler.composedJSON
    runtime: python3.6
```

Running a Python Lambda requires `sls` to be on your environment `$PATH`.

### Lambda <> DynamoDB

If you need your lambda functions to interact with the local dynamoDB emulator:

```js
const { DynamoDB } = require('aws-sdk');

const dynamodb = new DynamoDB({
  endpoint: process.env.DYNAMODB_ENDPOINT,
  region: 'us-fake-1',
  accessKeyId: 'fake',
  secretAccessKey: 'fake',
});
const client = new DynamoDB.DocumentClient({ service: dynamodb });

module.exports.myFn = async (event, context, callback) => {
  const TableName = process.env[`DYNAMODB_TABLE_${YOURTABLENAME}`];
  const { id } = event.arguments;
  const dynamoResult = await client
    .get({
      TableName,
      Key: { id },
    })
    .promise();

  return dynamoResult;
};
```

### IAM

If you would like to simulate IAM authentication locally, checkout the [testJWT](https://github.com/ConduitVC/aws-utils/blob/master/packages/appsync-emulator-serverless/testJWT.js) module
See the [tester](https://github.com/ConduitVC/aws-utils/blob/master/packages/appsync-emulator-serverless/tester.js) module for sample usage.
