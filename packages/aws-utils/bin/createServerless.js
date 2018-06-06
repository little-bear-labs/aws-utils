#! /usr/bin/env node
const fs = require('mz/fs')
const YAML = require('yamljs');

const createConfig = require('@conduitvc/config');
const config = createConfig(module.parent);

const capitalize = val => val.charAt(0).toUpperCase() + val.slice(1);
const newline = i => [...Array(i).keys()].reduce((sum,i) => sum + '\n','');

const provider = {
  provider: {
    name: 'aws',
    runtime: 'nodejs6.10',
    stage: 'dev',
    region: config.region,
  }
}

const plugins = [
  'serverless-appsync-plugin'
];

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
      field: entity.name,
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
    if(entity.subscriptions) {
      entity.subscriptions.forEach(subscription => {
        sum.push({
          dataSource: 'SubscriberPassthrough',
          type: 'Subscription',
          field: 'subscribeTo' + capitalize(subscription) + entity.name,
          request: "subscribePassthrough-request.txt",
          response: "subscribePassthrough-response.txt",
        })
      })
    }
    return sum
  }, [])
}

const deriveDataSources = config => {
  const dataSources = config.entities.map(entity => ({
    type: 'AMAZON_DYNAMODB',
    name: entity.name,
    description: entity.description,
    config: {
      tableName: entity.name,
      serviceRoleArn: "arn:aws:iam::${self:custom.accountId}:role/Dynamo-${self:custom.appSync.serviceRole}",
    },
  }));

  if( config.entities.some(entity => entity.subscriptions) ) {
    dataSources.push({
      type: 'None',
      name: 'SubscriberPassthrough',
      description: 'Non-datasource datasource',
      config: {
        serviceRoleArn: "arn:aws:iam::${self:custom.accountId}:role/Dynamo-${self:custom.appSync.serviceRole}"
      }
    })
  }
  return dataSources;
}

const custom = {
  accountId: config.accountId,
  appSync: {
    accountId: "${env:AWS_ACCOUNT_ID}",
    name: config.name,
    apiId: config.apiId || undefined,
    authenticationType: 'AMAZON_COGNITO_USER_POOLS',
    userPoolConfig: {
      ...config.userPool,
      userPoolId: "${env:USER_POOL_ID}"
    },
    region: config.region,
    mappingTemplates: deriveMappingTemplates(config),
    serviceRole: "AppSyncServiceRole",
    dataSources: deriveDataSources(config),
  }
}

const deriveResources = config => {
  const resources = {
    Resources: config.entities.reduce((sum,entity) => {
      return {
        ...sum,
        [entity.name + 'Table']: {
          Type: "AWS::DynamoDB::Table",
          Properties: {
            KeySchema: [{
              AttributeName: 'id',
              KeyType: 'HASH',
            }],
            AttributeDefinitions: [{
              AttributeName: 'id',
              AttributeType: 'S',
            }],
            ProvisionedThroughput: {
              ReadCapacityUnits: 10,
              WriteCapacityUnits: 10,
            },
            TableName: entity.name,
          },
        },
      }
    }, { } ),
  };
  
  resources.AppSyncServiceRole = {
    Type: "AWS::IAM::Role",
    Properties: {
      RoleName: "Dynamo-AppSyncServiceRole",
      AssumeRolePolicyDocument: {
        Version: "2012-10-17",
        Statement: [{
          Effect: "Allow",
          Principal: {
            Service: [ "appsync.amazonaws.com" ],
          },
          Action: [ "sts:AssumeRole" ],
        }],
      },
      Policies: [{
        PolicyName: "Dynamo-AppSyncServiceRole-Policy",
        PolicyDocument: {
          Version: "2012-10-17",
          Statement: [{
            Effect: "Allow",
            Action: [
              "dynamodb:Query",
              "dynamodb:BatchWriteItem",
              "dynamodb:GetItem",
              "dynamodb:DeleteItem",
              "dynamodb:PutItem",
              "dynamodb:Scan",
              "dynamodb:UpdateItem",
            ],
            Resource: config.entities.reduce((sum,entity) =>
              [
                ...sum,
                `arn:aws:dynamodb:${config.region}:*:table/${entity.name}`,
                `arn:aws:dynamodb:${config.region}:*:table/${entity.name}/*`,
              ], [] )
          }],
        },
      }],
    },
  }

  return resources;
}

async function main() {
  let input = process.argv[2];

  if(!input || !(await fs.exists(input))) {
    input = process.cwd();
  }

  const serverlessYml = fs.createWriteStream(input + '/serverless.yml');

  serverlessYml.write(`service: ${config.name}` + newline(2));
  serverlessYml.write(`frameworkVersion: ">=1.21.0 <2.0.0"` + newline(2));
  serverlessYml.write(YAML.stringify(provider, 2) + newline(2))
  serverlessYml.write(YAML.stringify(plugins, 2) + newline(2));
  serverlessYml.write(YAML.stringify(custom, 2) + newline(1));
  serverlessYml.end(YAML.stringify(deriveResources(config), 2) + newline(1));

  console.log('(⌐■_■) Great Job! (⌐■_■)');
  process.exit(0);
}

main().catch((err) => {
  console.error('Something went wrong', err.stack);
  process.exit(1);
});
