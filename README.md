# AWS Utils

Home of various packages for testing, deploying and building applications on top of AWS and other cloud infrastructure.


## AppSync Emulator Deprecation notice

We've worked with AWS over the last few months to transition ownership of the emulator directly into Amplify's (and AWS) hands. 

Please see: https://www.linkedin.com/feed/update/urn:li:activity:6565000058121572352 for details. We will be deprecating the package shortly.

## Prerequisites

* Java version >= 8
* Python 3
* Golang 1.x
* [aws-sam-cli](https://github.com/awslabs/aws-sam-cli)

This repo tests that Go and Python serverless functions work. For the
specs to run, you will need both Python 3 and Golang installed and to
have built the Go files using the `.compileAll.sh` script.

## Developing

### Clone this repo and build everything:

```bash
git clone git@github.com:ConduitVC/aws-utils.git
cd aws-utils
go get -u github.com/aws/aws-lambda-go/lambda
./compileAll.sh
yarn install
```

### Then make sure all the specs pass:

This mono repo runs all tests through jest (including eslint!) to run
the tests you first need to start `docker-compose` to make the localstack
services available.

```bash
docker-compose run -d localstack
docker-compose run wait
yarn test
```

If you find the tests running slowly or with intermittent failures, try
running this once to clear the Jest cache:

```bash
yarn test --clearCache
```

Also, check that you have enough RAM allocated to Docker. 4GB would be a
good starting point.

It may help to use `yarn test --runInBand` to stop the localstack stuff
getting overwhelmed by the default parallel tests.

To debug the tests, do this:

```bash
NODE_DEBUG=appsync-emulator:lambdaRunner TERM=dumb yarn test
```

Without `TERM=dumb`, any `console.log()` or log messages will be
swallowed by Jest as it scrolls up to replace its own output.
