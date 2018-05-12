const aws = require('aws-sdk');
const yaml = require('js-yaml');
const path = require('path');
const pkgUp = require('pkg-up');
const fs = require('fs');

const GlobalCache = {};

const AwsDefaultConfig = {
  dynamodb: {
    endpoint: 'http://localhost:61023',
    accessKeyId: 'fake',
    secretAccessKey: 'fake',
    region: 'fake',
  },
};

const defaultDynamoDB = new aws.DynamoDB(AwsDefaultConfig.dynamodb);

const findServerless = () => {
  const {
    parent: { filename },
  } = module;
  const serverlessPath = path.join(path.dirname(pkgUp.sync(filename)), 'serverless.yml');
  if (GlobalCache[serverlessPath]) {
    return GlobalCache[serverlessPath];
  }

  if (!fs.existsSync(serverlessPath)) {
    throw new Error(`Expected serverless file at location: ${serverlessPath}`);
  }

  const parsed = yaml.safeLoad(fs.readFileSync(serverlessPath, 'utf8'));
  // eslint-disable-next-lin
  return (GlobalCache[serverlessPath] = parsed);
};

const bootstrapAWS = async ({ tables, dynamodb = defaultDynamoDB } = {}) => {
  const dynamodbResources = Object.entries(findServerless().resources.Resources).filter(([, resource]) => resource.Type === 'AWS::DynamoDB::Table');

  await Promise.all(dynamodbResources.map(async ([name, resource]) => {
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
  }));
};

const resetAWS = async ({ tables, dynamodb = defaultDynamoDB } = {}) => {
  const dynamodbResources = Object.entries(findServerless().resources.Resources).filter(([, resource]) => resource.Type === 'AWS::DynamoDB::Table');

  await Promise.all(dynamodbResources.map(async ([name]) => {
    const TableName = tables[name];
    if (!TableName) {
      throw new Error(`No table name mapping for ${name}`);
    }
    await dynamodb.deleteTable({ TableName }).promise();
    await dynamodb.waitFor('tableNotExists', { TableName }).promise();
  }));
};

module.exports = { bootstrapAWS, resetAWS };
