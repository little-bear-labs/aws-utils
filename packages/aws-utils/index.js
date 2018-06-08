const aws = require('aws-sdk');
const debug = require('debug')('aws-utils:index');
const { findServerless } = require('./findServerless');

const AwsDefaultConfig = {
  dynamodb: {
    endpoint: 'http://localhost:61023',
    accessKeyId: 'fake',
    secretAccessKey: 'fake',
    region: 'fake',
  },
};

const defaultDynamoDB = new aws.DynamoDB(AwsDefaultConfig.dynamodb);

const bootstrapAWS = async ({ tables, dynamodb = defaultDynamoDB } = {}) => {
  const dynamodbResources = Object.entries(
    findServerless(module).resources.Resources,
  ).filter(([, resource]) => resource.Type === 'AWS::DynamoDB::Table');

  await Promise.all(
    dynamodbResources.map(async ([name, resource]) => {
      const TableName = tables[name];
      if (!TableName) {
        throw new Error(`No table name mapping for ${name}`);
      }

      const params = {
        ...resource.Properties,
        TableName,
      };

      await dynamodb.createTable(params).promise();
      await dynamodb.waitFor('tableExists', { TableName }).promise();
      debug('created table', { TableName, name });
    }),
  );

  return { dynamodb };
};

const resetAWS = async ({ tables, dynamodb = defaultDynamoDB } = {}) => {
  const dynamodbResources = Object.entries(
    findServerless(module).resources.Resources,
  ).filter(([, resource]) => resource.Type === 'AWS::DynamoDB::Table');

  await Promise.all(
    dynamodbResources.map(async ([name]) => {
      const TableName = tables[name];
      if (!TableName) {
        throw new Error(`No table name mapping for ${name}`);
      }
      await dynamodb.deleteTable({ TableName }).promise();
      await dynamodb.waitFor('tableNotExists', { TableName }).promise();
      debug('deleted table', { name, TableName });
    }),
  );
};

module.exports = { bootstrapAWS, resetAWS };
