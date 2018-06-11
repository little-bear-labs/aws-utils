const GlobalCache = {};
const yaml = require('js-yaml');
const path = require('path');
const pkgUp = require('pkg-up');
const fs = require('fs');

const findServerlessPath = ({ parent: { filename } } = module) =>
  path.dirname(pkgUp.sync(filename));

const findServerless = (mod = module) => {
  const serverlessPath =
    typeof mod === 'string'
      ? mod
      : path.join(findServerlessPath(mod), 'serverless.yml');
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

module.exports = {
  findServerlessPath,
  findServerless,
};
