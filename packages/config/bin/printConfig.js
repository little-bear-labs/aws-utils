#! /usr/bin/env node

const loadConfig = require('..');

const config = loadConfig(module.parent);
/* eslint-disable no-console */
console.log('The configuration');
console.log();
console.log(JSON.stringify(config, null, 2));
console.log();
/* eslint-enable no-console */
