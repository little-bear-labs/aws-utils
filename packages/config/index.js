const merge = require('lodash.merge');
const pkgUp = require('pkg-up');
const path = require('path');

function extractCWD(parent) {
  if (!parent) return process.cwd();
  return parent.filename;
}

// we pass parent here to allow the CLI to pass it's own module.parent.
module.exports = (parent = module.parent) => {
  const env = process.env.NODE_ENV || 'development';
  const cwd = extractCWD(parent);
  const loadPath = path.dirname(pkgUp.sync(cwd));

  // load the default:
  // eslint-disable-next-line
  const defaults = require(path.join(loadPath, 'config/defaults'));
  // eslint-disable-next-line
  const envSpecific = require(path.join(loadPath, 'config', env));
  return merge({}, defaults, envSpecific);
};
