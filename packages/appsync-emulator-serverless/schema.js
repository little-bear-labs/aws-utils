const {
  makeExecutableSchema,
  SchemaDirectiveVisitor,
} = require('graphql-tools');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const json5 = require('json5');
const { GraphQLError } = require('graphql');
const { create: createUtils } = require('./util');
const { javaify, vtl } = require('./vtl');
const dynamodbSource = require('./dynamodbSource');
const lambdaSource = require('./lambdaSource');
const httpSource = require('./httpSource');
const elasticsearchSource = require('./elasticsearchSource');
const log = require('logdown')('appsync-emulator:schema');
const consola = require('./log');
const { inspect } = require('util');
const { scalars } = require('./schemaWrapper');
const DataLoader = require('dataloader');

const vtlMacros = {
  console: (...args) => {
    // eslint-disable-next-line no-console
    console.log(...args);
    return '';
  },
};

// eslint-disable-next-line
const gqlPathAsArray = path => {
  const flattened = [];
  let curr = path;
  while (curr) {
    flattened.push(curr.key);
    curr = curr.prev;
  }
  return flattened.reverse();
};

class AppSyncError extends Error {
  constructor(errors = []) {
    super('aggregate errors');
    this.errors = errors;
  }
}

// eslint-disable-next-line
const buildVTLContext = ({ root, vars, context, info }, result = null, stash = null) => {
  const {
    jwt: { iss: issuer, sub },
    request,
  } = context;
  const util = createUtils();
  const args = javaify(vars);
  const vtlRequest = request ? { headers: request.headers } : {};

  const vtlContext = {
    arguments: args,
    args,
    request: vtlRequest,
    identity: javaify({
      sub,
      issuer,
      username: context.jwt['cognito:username'],
      sourceIp: ['0.0.0.0'],
      defaultAuthStrategy: 'ALLOW',
      claims: context.jwt,
    }),
    source: root || {},
    result: javaify(result),
    stash: stash || javaify({}),
  };
  return {
    util,
    utils: util,
    context: vtlContext,
    ctx: vtlContext,
  };
};

const returnJSON = input => {
  try {
    // apparently appsync allows things like trailing commas.
    return json5.parse(input);
  } catch (err) {
    consola.error(
      new Error('Failed to parse VTL template as JSON (see below)'),
    );
    consola.error(input);
    throw err;
  }
};

const handleVTLRender = (
  str,
  context,
  // eslint-disable-next-line
  vtlMacros,
  { info: gqlInfo, context: gqlContext },
) => {
  let templateOutput;
  try {
    templateOutput = vtl(str.toString(), context, vtlMacros);
  } catch (err) {
    // only throw the template parsing error if we have not
    // set an error on context. This will ensure we abort the template
    // but return the correct error message.
    if (context.util.getErrors().length === 0) {
      throw err;
    }
  }

  // check if we have any errors.
  const errors = context.util.getErrors();
  if (!errors.length) {
    return returnJSON(templateOutput);
  }
  // eslint-disable-next-line
  gqlContext.appsyncErrors = errors.map(error => {
    // XXX: Note we use a field other than "message" as it gets mutated
    // by the velocity engine breaking this logic.
    const { gqlMessage: message, errorType, data, errorInfo } = error;
    const gqlErrorObj = new GraphQLError(
      message,
      gqlInfo.fieldNodes,
      null,
      null,
      gqlPathAsArray(gqlInfo.path),
    );
    Object.assign(gqlErrorObj, { errorType, data, errorInfo });
    return gqlErrorObj;
  });

  log.error('GraphQL Errors', gqlContext.appsyncErrors);
  throw gqlContext.appsyncErrors[0];
};

const runRequestVTL = (fullPath, graphqlInfo) => {
  log.info('loading request vtl', path.relative(process.cwd(), fullPath));
  const context = buildVTLContext(graphqlInfo);
  const content = fs.readFileSync(fullPath, 'utf8');
  return [
    handleVTLRender(content.toString(), context, vtlMacros, graphqlInfo),
    context.ctx.stash,
  ];
};

const runResponseVTL = (fullPath, graphqlInfo, result, stash) => {
  log.info('loading response vtl', path.relative(process.cwd(), fullPath));
  const context = buildVTLContext(graphqlInfo, result, stash);
  const content = fs.readFileSync(fullPath, 'utf8');
  return handleVTLRender(content.toString(), context, vtlMacros, graphqlInfo);
};

const dispatchRequestToSource = async (
  source,
  { dynamodb, dynamodbTables, serverlessDirectory, serverlessConfig },
  request,
) => {
  consola.info(
    'Dispatch to source',
    inspect({ name: source.name, type: source.type }),
  );
  log.info('resolving with source: ', source.name, source.type);
  switch (source.type) {
    case 'AMAZON_DYNAMODB':
      return dynamodbSource(
        dynamodb,
        // default alias
        source.config.tableName,
        // mapping used for multi table operations.
        dynamodbTables,
        request,
      );
    case 'AWS_LAMBDA':
      return lambdaSource(
        {
          serverlessDirectory,
          serverlessConfig,
          dynamodbEndpoint: dynamodb.endpoint.href,
          dynamodbTables,
        },
        source.config.functionName,
        request,
      );
    case 'AMAZON_ELASTICSEARCH':
      return elasticsearchSource(source.config.endpoint, request);
    case 'HTTP':
      return httpSource(source.config.endpoint, request);
    case 'NONE':
      return request.payload;
    default:
      throw new Error(`Cannot handle source type: ${source.type}`);
  }
};

const generateDataLoaderResolver = (source, configs) => {
  const batchLoaders = {};
  return fieldPath => {
    if (batchLoaders[fieldPath] === undefined) {
      batchLoaders[fieldPath] = new DataLoader(
        requests => {
          const batchRequest = requests[0];
          batchRequest.payload = requests.map(r => r.payload);
          consola.info(
            'Rendered Batch Request:\n',
            inspect(batchRequest, { depth: null, colors: true }),
          );
          log.info('resolver batch request', batchRequest);
          return dispatchRequestToSource(source, configs, batchRequest);
        },
        {
          shouldCache: false,
        },
      );
    }

    return batchLoaders[fieldPath];
  };
};

const generateTypeResolver = (
  source,
  configs,
  { requestPath, responsePath, dataLoaderResolver },
) => async (root, vars, context, info) => {
  try {
    const fieldPath = `${info.parentType}.${info.fieldName}`;
    const pathInfo = gqlPathAsArray(info.path);
    consola.start(`Resolve: ${fieldPath} [${pathInfo}]`);
    log.info('resolving', pathInfo);

    assert(context && context.jwt, 'must have context.jwt');
    const resolverArgs = { root, vars, context, info };
    const [request, stash] = runRequestVTL(requestPath, resolverArgs);

    let requestResult;
    if (request.operation === 'BatchInvoke') {
      const loader = dataLoaderResolver(fieldPath);
      requestResult = await loader.load(request);
    } else {
      consola.info(
        'Rendered Request:\n',
        inspect(request, { depth: null, colors: true }),
      );
      log.info('resolver request', request);
      requestResult = await dispatchRequestToSource(source, configs, request);
    }

    const response = runResponseVTL(
      responsePath,
      resolverArgs,
      requestResult,
      stash,
    );
    consola.info(
      'Rendered Response:\n',
      inspect(response, { depth: null, colors: true }),
    );
    log.info('resolver response', response);
    // XXX: parentType probably is constructed with new String so == is required.
    // eslint-disable-next-line
    if (info.parentType == 'Mutation') {
      configs.pubsub.publish(info.fieldName, response);
    }
    return response;
  } catch (err) {
    consola.error(`${info.parentType}.${info.fieldName} failed`);
    consola.error(err.errorMessage || err.stack || err);
    throw err;
  }
};

const generateSubscriptionTypeResolver = (
  field,
  source,
  configs,
  { requestPath, responsePath },
) => {
  const subscriptionList = configs.subscriptions[field];
  if (!subscriptionList) {
    // no subscriptions found.
    return () => {};
  }

  const { mutations } = subscriptionList;
  assert(
    mutations && mutations.length,
    `${field} must have aws_subscribe with mutations arg`,
  );

  return {
    resolve: async (root, _, context, info) => {
      consola.start(
        `Resolve: ${info.parentType}.${info.fieldName} [${gqlPathAsArray(
          info.path,
        )}]`,
      );
      log.info('resolving', gqlPathAsArray(info.path));
      assert(context && context.jwt, 'must have context.jwt');
      // XXX: The below is what our templates expect but not 100% sure it's correct.
      // for subscriptions the "arguments" field is same as root here.
      const resolverArgs = { root, vars: root, context, info };
      const [request, stash] = runRequestVTL(requestPath, resolverArgs);
      const requestResult =
        (await dispatchRequestToSource(source, configs, request)) || {};

      consola.info(
        'Rendered Request:\n',
        inspect(requestResult, { depth: null, colors: true }),
      );
      log.info('subscription resolver request', requestResult);
      const response = runResponseVTL(
        responsePath,
        resolverArgs,
        requestResult,
        stash,
      );
      consola.info(
        'Rendered Response:\n',
        inspect(response, { depth: null, colors: true }),
      );
      log.info('subscription resolver response', response);
      return response;
    },
    subscribe() {
      return configs.pubsub.asyncIterator(mutations);
    },
  };
};

const generateResolvers = (cwd, config, configs) => {
  const { mappingTemplatesLocation = 'mapping-templates' } = config;
  const mappingTemplates = path.join(cwd, mappingTemplatesLocation);
  const dataSourceByName = config.dataSources.reduce(
    (sum, value) => ({
      ...sum,
      [value.name]: value,
    }),
    {},
  );

  return config.mappingTemplates.reduce(
    (sum, { dataSource, type, field, request, response }) => {
      if (!sum[type]) {
        // eslint-disable-next-line
        sum[type] = {};
      }
      const source = dataSourceByName[dataSource];
      const pathing = {
        requestPath: path.join(mappingTemplates, request),
        dataLoaderResolver: generateDataLoaderResolver(source, configs),
        responsePath: path.join(mappingTemplates, response),
      };
      const resolver =
        type === 'Subscription'
          ? generateSubscriptionTypeResolver(field, source, configs, pathing)
          : generateTypeResolver(source, configs, pathing);

      return {
        ...sum,
        [type]: {
          ...sum[type],
          [field]: resolver,
        },
      };
    },
    { ...scalars },
  );
};

const createSubscriptionsVisitor = () => {
  const subscriptions = {};
  class DirectiveVisitor extends SchemaDirectiveVisitor {
    visitFieldDefinition(field) {
      subscriptions[field.name] = this.args;
    }
  }

  return {
    subscriptions,
    DirectiveVisitor,
  };
};

const createSchema = async ({
  dynamodb,
  dynamodbTables,
  graphqlSchema,
  serverlessDirectory,
  serverlessConfig,
  pubsub,
} = {}) => {
  assert(dynamodb, 'must pass dynamodb');
  assert(
    dynamodbTables && typeof dynamodbTables === 'object',
    'must pass dynamodbTables',
  );
  assert(graphqlSchema, 'must pass graphql schema');
  assert(serverlessDirectory, 'must pass serverless dir');
  assert(serverlessConfig, 'must pass serverless config');
  assert(pubsub, 'must pass pubsub');

  const { subscriptions, DirectiveVisitor } = createSubscriptionsVisitor();
  const { custom: { appSync: appSyncConfig } = {} } = serverlessConfig;

  // XXX: Below is a nice and easy hack.
  // walk the AST without saving the schema ... this is to capture subscription directives.
  makeExecutableSchema({
    typeDefs: graphqlSchema,
    schemaDirectives: {
      aws_subscribe: DirectiveVisitor,
    },
  });

  const resolvers = await generateResolvers(
    serverlessDirectory,
    appSyncConfig,
    {
      dynamodb,
      dynamodbTables,
      pubsub,
      subscriptions,
      serverlessDirectory,
      serverlessConfig,
    },
  );
  const schema = makeExecutableSchema({
    typeDefs: graphqlSchema,
    resolvers,
    schemaDirectives: {
      aws_subscribe: DirectiveVisitor,
    },
  });

  const topics = Array.from(
    new Set(
      Object.values(subscriptions).reduce(
        (sum, { mutations }) => sum.concat(mutations),
        [],
      ),
    ),
  );

  return {
    schema,
    topics,
    subscriptions,
  };
};

module.exports = { createSchema, AppSyncError };
