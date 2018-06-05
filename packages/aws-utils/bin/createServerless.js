#! /usr/bin/env node
const fs = require('mz/fs')
const YAML = require('yamljs');

const createConfig = require('@conduitvc/config');
const config = createConfig(module.parent);

const newline = i => [...Array(i).keys()].reduce((sum,i) => sum + '\n','');

const provider = {
  provider:
    name: 'aws',
    runtime: 'nodejs6.10',
    stage: 'dev',
    region: config.region,
}

const plugins = [
  'serverless-appsync-plugin'
];

const custom = {
  accountId: config.accountId,
  appSync: {
    name: config.name,
    apiId: config.apiId || undefined,
    authenticationType: 'AMAZON_COGNITO_USER_POOLS',
    userPoolConfig: config.userPool,
    region: config.region,
    mappingTemplates: deriveMappingTemplates(config)
  }
}

const deriveMappingTemplates = config => {
  return config.entities.reduce((sum,entity) => {
    sum = sum.concat([{
      dataSource: entity.name,
      type: 'Query',
      field: entity.name + 'ById',
      request: "byId-request.txt",
      response: "result-response.txt",
    },{
      dataSource: entity.name,
      type: 'Query',
      field: entity.name',
      request: "byId-request.txt",
      response: "resultItems-response.txt",
    },{
      dataSource: entity.name,
      type: 'Mutation',
      field: 'put' + entity.name,
      request: "put-request.txt",
      response: "result-response.txt",
    },{
      dataSource: entity.name,
      type: 'Mutation',
      field: 'update' + entity.name,
      request: "update-request.txt",
      response: "result-response.txt",
    },{
      dataSource: entity.name,
      type: 'Mutation',
      field: 'delete' + entity.name,
      request: "delete-request.txt",
      response: "result-response.txt",
    }])
    if(entity.subscriptions)
    return sum
  }, [])
}

async function main() {
  let input = process.argv[2];

  if(! (await fs.exists(input)) ) {
    input = process.cwd();
  }

  const serverlessYml = fs.createWriteStream(input + '/serverless.yml');

  serverlessYml.write(`service: ${config.name}` + newline(2));
  serverlessYml.write(`frameworkVersion: ">=1.21.0 <2.0.0"` + newline(2));
  serverlessYml.write(YAML.stringify(provider, 2) + newline(2))
  serverlessYml.write(YAML.stringify(plugins, 2) + newline(2));
  serverlessYml.end(YAML.stringify(custom, 2));
}

main().catch((err) => {
  console.error('Something went wrong', err.stack);
  process.exit(1);
});

service: serverless-appsync-subscription-test

frameworkVersion: ">=1.21.0 <2.0.0"

provider:
  name: aws
  runtime: nodejs6.10
  stage: dev
  region: us-east-2

plugins:
  - serverless-appsync-plugin

custom:
  accountId: 229055845648 # replace this with your accountId
  appSync:
    name: quote-provider
    apiId: guvvxnz5xzccfan6dttukk6hni
    authenticationType: AMAZON_COGNITO_USER_POOLS
    userPoolConfig:
      awsRegion: us-east-2 # required # region
      defaultAction: ALLOW
      userPoolId: us-east-2_PKa2Qpncv # replace this with your Cognito User Pool Id
    # region: # defaults to provider region
    # mappingTemplatesLocation: # defaults to mapping-templates
    mappingTemplates:
      - dataSource: QuoteRequest
        type: Query
        field: quoteRequests
        request: "quoteRequests-request.txt"
        response: "list-response.txt"
      - dataSource: QuoteResponse
        type: QuoteRequest
        field: quoteResponse
        request: "quoteResponse-request.txt"
        response: "quoteResponse-response.txt"
      - dataSource: QuoteRequest
        type: Mutation
        field: requestQuote
        request: "requestQuote-request-mapping-template.txt"
        response: "requestQuote-response-mapping-template.txt"
      - dataSource: QuoteResponse
        type: Mutation
        field: respondToQuote
        request: "respondToQuote-request-mapping-template.txt"
        response: "respondToQuote-response-mapping-template.txt"
      - dataSource: QuoteRequest
        type: CreatedQuoteResponse
        field: respondedToQuote
        request: "respondedToQuote-request.txt"
        response: "respondedToQuote-response.txt"
      - dataSource: SubscriberPassthrough
        type: Subscription
        field: subscribeToQuoteRequest
        request: "subscribeToQuoteRequest-request-mapping-template.txt"
        response: "subscribeToQuoteRequest-response-mapping-template.txt"
      - dataSource: SubscriberPassthrough
        type: Subscription
        field: subscribeToQuoteResponse
        request: "subscribeToQuoteResponse-request.txt"
        response: "subscribeToQuoteResponse-response.txt" 
    serviceRole: "AppSyncServiceRole"
    dataSources:
      - type: AMAZON_DYNAMODB
        name: QuoteRequest
        description: 'Each item contains a customer quote request'
        config:
          tableName: 'QuoteRequest'
          serviceRoleArn: "arn:aws:iam::${self:custom.accountId}:role/Dynamo-${self:custom.appSync.serviceRole}"
      - type: AMAZON_DYNAMODB
        name: QuoteResponse
        description: 'Each item contains a response to a customer quote request'
        config:
          tableName: 'QuoteResponse'
          serviceRoleArn: "arn:aws:iam::${self:custom.accountId}:role/Dynamo-${self:custom.appSync.serviceRole}"
      - type: NONE
        name: SubscriberPassthrough
        description: 'Non-datasource datasource'
        config:
          serviceRoleArn: "arn:aws:iam::${self:custom.accountId}:role/Dynamo-${self:custom.appSync.serviceRole}"
resources:
  Resources:
    QuoteRequestTable:
      Type: "AWS::DynamoDB::Table"
      Properties:
        KeySchema:
          -
            AttributeName: id
            KeyType: HASH
        AttributeDefinitions:
          -
            AttributeName: id
            AttributeType: S
        ProvisionedThroughput:
          ReadCapacityUnits: 10
          WriteCapacityUnits: 10
        TableName: "QuoteRequest"
    QuoteResponse:
      Type: "AWS::DynamoDB::Table"
      Properties:
        KeySchema:
          -
            AttributeName: id
            KeyType: HASH
        AttributeDefinitions:
          -
            AttributeName: id
            AttributeType: S
        ProvisionedThroughput:
          ReadCapacityUnits: 10
          WriteCapacityUnits: 10
        TableName: "QuoteResponse"
    AppSyncServiceRole:
      Type: "AWS::IAM::Role"
      Properties:
        RoleName: "Dynamo-AppSyncServiceRole"
        AssumeRolePolicyDocument:
          Version: "2012-10-17"
          Statement:
            -
              Effect: "Allow"
              Principal:
                Service:
                  - "appsync.amazonaws.com"
              Action:
                - "sts:AssumeRole"
        Policies:
          -
            PolicyName: "Dynamo-AppSyncServiceRole-Policy"
            PolicyDocument:
              Version: "2012-10-17"
              Statement:
                -
                  Effect: "Allow"
                  Action:
                    - "dynamodb:Query"
                    - "dynamodb:BatchWriteItem"
                    - "dynamodb:GetItem"
                    - "dynamodb:DeleteItem"
                    - "dynamodb:PutItem"
                    - "dynamodb:Scan"
                    - "dynamodb:UpdateItem"
                  Resource:
                    - "arn:aws:dynamodb:us-east-2:*:table/QuoteRequest"
                    - "arn:aws:dynamodb:us-east-2:*:table/QuoteRequest/*"
                    - "arn:aws:dynamodb:us-east-2:*:table/QuoteResponse"
                    - "arn:aws:dynamodb:us-east-2:*:table/QuoteResponse/*"
