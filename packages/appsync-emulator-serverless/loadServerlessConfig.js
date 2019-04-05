/**
 * NOTE: This is a really terrible hack that relies on the internals
 * of serverless.
 */

const Serverless = require('serverless');
const path = require('path');
const fs = require('fs');

// const testCWD = '/Users/sahajalal/workspace/conduit/file-service/backend';

const GlobalCache = new Map();

class ConfigServerless extends Serverless {
  async getConfig(servicePath) {
    this.processedInput = {
      commands: [],
      options: { stage: 'dev' },
    };

    this.config.servicePath = servicePath;
    this.pluginManager.setCliOptions(this.processedInput.options);
    this.pluginManager.setCliCommands(this.processedInput.commands);
    await this.service.load(this.processedInput);

    // make sure the command exists before doing anything else
    this.pluginManager.validateCommand(this.processedInput.commands);

    // populate variables after --help, otherwise help may fail to print
    // (https://github.com/serverless/serverless/issues/2041)
    return this.variables
      .populateService(this.pluginManager.cliOptions)
      .then(() => {
        // merge arrays after variables have been populated
        // (https://github.com/serverless/serverless/issues/3511)
        this.service.mergeArrays();

        // populate function names after variables are loaded in case functions were externalized
        // (https://github.com/serverless/serverless/issues/2997)
        this.service.setFunctionNames(this.processedInput.options);

        // validate the service configuration, now that variables are loaded
        this.service.validate();
      });
  }
}

const normalizeResources = config => {
  if (!config.resources) {
    return config.resources;
  }

  if (!config.resources.Resources) {
    return {};
  }

  if (!Array.isArray(config.resources.Resources)) {
    return config.resources;
  }

  const newResources = config.resources.Resources.reduce(
    (sum, { Resources, Outputs = {} }) => ({
      ...sum,
      ...Resources,
      Outputs: {
        ...(sum.Outputs || {}),
        ...Outputs,
      },
    }),
    {},
  );

  return {
    Resources: newResources,
  };
};

const flatten = arr =>
  arr.reduce((acc, curr) => {
    if (Array.isArray(curr)) {
      return [...acc, ...flatten(curr)];
    }
    return [...acc, curr];
  }, []);

const loadServerlessConfig = async (cwd = process.cwd()) => {
  const stat = fs.statSync(cwd);
  if (!stat.isDirectory()) {
    // eslint-disable-next-line
    cwd = path.dirname(cwd);
  }

  if (GlobalCache.has(cwd)) {
    return { ...GlobalCache.get(cwd) };
  }
  const serverless = new ConfigServerless();
  await serverless.getConfig(cwd);
  const { service: config } = serverless;

  const { custom = {} } = config;
  const { appSync = {} } = custom;
  const { mappingTemplates = [] } = appSync;
  const { dataSources = [] } = appSync;

  const output = {
    config: {
      ...config,
      custom: {
        ...custom,
        appSync: {
          ...appSync,
          mappingTemplates: flatten(mappingTemplates),
          dataSources: flatten(dataSources),
        },
      },
      resources: normalizeResources(config),
    },
    directory: cwd,
  };

  GlobalCache.set(cwd, output);
  return output;
};

module.exports = { loadServerlessConfig };
