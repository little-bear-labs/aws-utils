# AppSync Emulator (Serverless)

This module provides emulation and testing helpers for use with AWS AppSync. Currently this depends on using https://github.com/sid88in/serverless-appsync-plugin and following the conventions.

It is possible to use this emulator without serverless by mirroring the structure defined there. In the future we will provide other methods of configuring the emulator.

## Usage

NOTE: Everything below requires dynamodb to be available on a specific port. We recommend using localstack for dynamodb emulation (though you can use the emulator directly).

See [here](https://github.com/ConduitVC/appsync-serverless-emulator-example/blob/master/docker-compose.yml) for a `docker-compose` setup to get started.

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