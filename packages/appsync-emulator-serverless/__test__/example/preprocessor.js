const fs = require('fs');
const path = require('path');
const yaml = require('yamljs');

function load(file) {
  const ext = path.extname(file);
  switch (ext) {
    case '.js':
      return require(file)();
    case '.yaml':
    case '.yml':
      return JSON.stringify(yaml.load(file));
    default:
      return fs.readFileSync(file, 'utf8');
  }
}

module.exports = load;
