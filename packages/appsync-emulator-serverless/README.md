# AppSync Emulator (Serverless)

This module provides emulation and testing helpers for use with AWS AppSync. Currently this depends on using https://github.com/sid88in/serverless-appsync-plugin and following the conventions.

It is possible to use this emulator without serverless by mirroring the structure defined there. In the future we will provide other methods of configuring the emulator.

## AppSync Features

We aim to support the majority of appsync features (as we use all of them except elastic search).

 - Lambda source (only tested with serverless functions)
 - DynamoDB source (batch operations, all single table operations, etc.)
 - NONE source
 - Full VTL support ($util) and compatibility with Java stdlib
 - Support for use with cognito credentials
 - Subscriptions

## Usage

This package will download and run the dynamodb emulator as part of it's appsync emulation features. DynamoDB data is preserved between emulator runs and is stored in `.dynamodb` in the same directory that `package.json` would be in.

### As a CLI

```sh
# NOTE unless you assign a specific port a random one will be chosen.
yarn appsync-emulator --port 62222
```

### For unit testing.

(Below example is jest but any framework will work)

```js
const gql = require("graphql-tag");
const { AWSAppSyncClient } = require("aws-appsync");

// we export a specific module for testing.
const {
  create,
  connect
} = require("@conduitvc/appsync-emulator-serverless/tester");
// required by apollo-client
global.fetch = require("node-fetch");

describe("graphql", () => {
  let server, client;
  beforeEach(async () => {
    server = await create();
    client = connect(
      server,
      AWSAppSyncClient
    );
  });

  afterEach(async () => server.close());

  it("Type.resolver", async () => {
    await client.query({
      query: gql`
        ....
      `
    })
  });
});

```
