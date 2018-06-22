const noop = () => {};
const fakeLogger = {
  error: noop,
  info: noop,
  start: noop,
};

if (process.env.APPSYNC_EMULATOR_LOG) {
  module.exports = require('consola');
} else {
  module.exports = fakeLogger;
}
