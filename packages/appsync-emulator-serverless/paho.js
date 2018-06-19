const Paho = require('paho-mqtt');

// hackage required to get Paho to work.
global.localStorage = {};
global.Paho = Paho;
global.Paho.MQTT = {
  Message: Paho.Message,
};

module.exports = Paho;
