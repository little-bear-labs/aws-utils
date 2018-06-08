#! /usr/bin/env node
const createConfig = require('@conduitvc/config');
const fs = require('fs');
const yaml = require('write-yaml');

const { promises: fsPromises } = fs;
const capitalize = val => val.charAt(0).toUpperCase() + val.slice(1);
const config = createConfig(module.parent);

const deriveMappingTemplates = () =>
  config.entities.reduce((sum, entity) => {
    const rv = sum.concat([{
      dataSource: entity.name,
      type: 'Query',
      field: `${entity.name}ById`,
      request: 'byId-request.txt',
      response: 'result-response.txt',
    }, {
      dataSource: entity.name,
      type: 'Query',
      field: entity.name,
      request: 'scan-request.txt',
      response: 'resultItems-response.txt',
    }, {
      dataSource: entity.name,
      type: 'Mutation',
      field: `put${entity.name}`,
      request: 'put-request.txt',
      response: 'result-response.txt',
    }, {
      dataSource: entity.name,
      type: 'Mutation',
      field: `update${entity.name}`,
      request: 'update-request.txt',
      response: 'result-response.txt',
    }, {
      dataSource: entity.name,
      type: 'Mutation',
      field: `delete${entity.name}`,
      request: 'delete-request.txt',
      response: 'result-response.txt',
    }]);
    if (entity.subscriptions) {
      entity.subscriptions.forEach((subscription) => {
        rv.push({
          dataSource: 'SubscriberPassthrough',
          type: 'Subscription',
          field: `subscribeTo${capitalize(subscription)}${entity.name}`,
          request: 'subscribePassthrough-request.txt',
          response: 'result-response.txt',
        });
      });
    }
    return rv;
  }, []);

const deriveDataSources = () => {
  const dataSources = config.entities.map(entity => ({
    type: 'AMAZON_DYNAMODB',
    name: entity.name,
    description: entity.description || `${entity.name} description`,
    config: {
      tableName: entity.name,
      serviceRoleArn: '"arn:aws:iam::${self:custom.accountId}:role/Dynamo-${self:custom.appSync.serviceRole}"',
    },
  }));

  if (config.entities.some(entity => entity.subscriptions)) {
    dataSources.push({
      type: 'None',
      name: 'SubscriberPassthrough',
      description: 'Non-datasource datasource',
      config: {
        serviceRoleArn: '"arn:aws:iam::${self:custom.accountId}:role/Dynamo-${self:custom.appSync.serviceRole}"',
      },
    });
  }
  return dataSources;
};

const deriveResources = () => {
  const resources = {
    Resources: config.entities.reduce((sum, entity) => ({
      ...sum,
      [`${entity.name}Table`]: {
        Type: 'AWS::DynamoDB::Table',
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
    }), { }),
  };

  resources.AppSyncServiceRole = {
    Type: 'AWS::IAM::Role',
    Properties: {
      RoleName: 'Dynamo-AppSyncServiceRole',
      AssumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: {
            Service: ['appsync.amazonaws.com'],
          },
          Action: ['sts:AssumeRole'],
        }],
      },
      Policies: [{
        PolicyName: 'Dynamo-AppSyncServiceRole-Policy',
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [{
            Effect: 'Allow',
            Action: [
              'dynamodb:Query',
              'dynamodb:BatchWriteItem',
              'dynamodb:GetItem',
              'dynamodb:DeleteItem',
              'dynamodb:PutItem',
              'dynamodb:Scan',
              'dynamodb:UpdateItem',
            ],
            Resource: config.entities.reduce((sum, entity) =>
              [
                ...sum,
                `arn:aws:dynamodb:${config.region}:*:table/${entity.name}`,
                `arn:aws:dynamodb:${config.region}:*:table/${entity.name}/*`,
              ], []),
          }],
        },
      }],
    },
  };

  return resources;
};

const writeGraphqlSchema = (dir) => {
  console.log('Ѱζ༼ᴼل͜ᴼ༽ᶘѰ    Writing schema.graphql');
  const { entities } = config;
  const writeStream = fs.createWriteStream(`${dir}/schema.graphql`);

  return new Promise((resolve) => {
    writeStream.on('error', (e) => {
      console.error(e);
      process.exit(1);
    });

    writeStream.on('finish', resolve);

    const writeType = type => writeStream.write(`\ntype ${type} {\n`);
    const writeEnd = () => writeStream.write('}\n');

    writeStream.write('schema {\n');
    writeStream.write('  query: Query\n');
    writeStream.write('  mutation: Mutation\n');
    if (entities.some(entity => entity.subscriptions)) {
      writeStream.write('  subscription: Subscription\n');
    }
    writeEnd();

    writeType('Query');
    entities.forEach((entity) => {
      const type = entity.name;
      writeStream.write(`  ${type}byId(id: ID!): ${type}\n`);
      writeStream.write(`  ${type}(query: [AttributeFilter]): [${type}]!\n`);
    });
    writeEnd();

    writeType('Mutation');
    entities.forEach((entity) => {
      const { name } = entity;
      writeStream.write(`  put${name}(id: ID, input: ${name}Input!): ${name}!\n`);
      writeStream.write(`  update${name}(id: ID!, input: ${name}Input!): ${name}!\n`);
      writeStream.write(`  delete${name}(id: ID!): Boolean\n`);
    });
    writeEnd();

    if (entities.some(entity => entity.subscriptions)) {
      writeType('Subscription');

      entities
        .filter(entity => entity.subscriptions)
        .forEach((entity) => {
          const { name } = entity;
          entity.subscriptions.forEach((subscription) => {
            writeStream.write(`  subscribeTo${capitalize(subscription)}${name}: ${name}!\n`);
            writeStream.write(`  @aws_subscribe(mutations: ["${subscription}${name}"])\n`);
          });
        });
      writeEnd();
    }

    entities.forEach((entity) => {
      const { attributes, name } = entity;

      writeType(name);
      writeStream.write('  id: ID!\n');
      writeStream.write(`${attributes.map(attribute => `  ${attribute.name}: ${attribute.type}`).join('\n')}\n`);
      writeEnd();

      writeType(`${name}Input`);
      writeStream.write(`${attributes.map(attribute => `  ${attribute.name}: ${attribute.type}`).join('\n')}\n`);
      writeEnd();
    });

    writeType('AttributeFilter');
    writeStream.write('  expression: String!\n');
    writeStream.write('  expressionName: String!\n');
    writeStream.write('  expressionNumberValue: Float\n');
    writeStream.write('  expressionStringValue: Float\n');
    writeEnd();

    writeStream.end();
  });
};

const writeServerless = (input) => {
  console.log('(；一_一)   Writing serverless.yml');
  yaml.sync(`${input}/serverless.yml`, {
    service: config.name,
    frameworkVersion: '>=1.21.0 <2.0.0',
    provider: {
      name: 'aws',
      runtime: 'nodejs6.10',
      stage: 'dev',
      region: config.region,
    },
    plugins: [
      'serverless-appsync-plugin',
    ],
    custom: {
      appSync: {
        accountId: '${env:AWS_ACCOUNT_ID}',
        name: config.name,
        apiId: config.apiId || '',
        authenticationType: 'AMAZON_COGNITO_USER_POOLS',
        userPoolConfig: {
          ...config.userPool,
          userPoolId: '${env:USER_POOL_ID}',
        },
        region: config.region,
        mappingTemplates: deriveMappingTemplates(),
        serviceRole: 'AppSyncServiceRole',
        dataSources: deriveDataSources(),
      },
    },
    resources: deriveResources(),
  });
};

const copyMappingTemplates = async (input) => {
  console.log('(ﾉ◕ヮ◕)ﾉ    Copying mapping templates');
  const fileList = [
    'byId-request.txt',
    'result-response.txt',
    'scan-request.txt',
    'resultItems-response.txt',
    'put-request.txt',
    'update-request.txt',
    'delete-request.txt',
    'subscribePassthrough-request.txt',
  ];

  const mappingTemplatesDir = `${input}/mapping-templates`;
  if (!fs.existsSync(mappingTemplatesDir)) {
    fs.mkdirSync(mappingTemplatesDir);
  }

  await fileList.map(filename =>
    fsPromises.copyFile(
      `${__dirname}/../mapping-templates/${filename}`,
      `${mappingTemplatesDir}/${filename}`,
    ));
};

async function main() {
  let input = process.argv[2];

  if (!input || !fs.existsSync(input)) {
    input = process.cwd();
  }

  writeServerless(input);
  await Promise.all([
    copyMappingTemplates(input),
    writeGraphqlSchema(input),
  ]);

  console.log('(⌐■_■) Complete! (⌐■_■)');
  process.exit(0);
}

main().catch((err) => {
  console.error('Something went wrong', err.stack);
  process.exit(1);
});
