const { EventEmitter } = require('events');
const Paho = require('../paho');

class MQTTClient extends EventEmitter {
  constructor(clientId) {
    super();
    this.client = new Paho.Client('localhost', 0, clientId);
  }

  subscribe(topic) {
    return new Promise((accept, reject) => {
      this.client.subscribe(topic, {
        onSuccess: accept,
        onFailure: reject,
      });
    });
  }
}

const createMQTTClient = async (url, clientId) => {
  // the actual host is passed in connect;
  const mqtt = new MQTTClient(clientId);
  mqtt.client.onMessageArrived = value => {
    mqtt.emit('message', value);
  };

  await new Promise((accept, reject) => {
    mqtt.client.connect({
      hosts: [url],
      onSuccess: accept,
      onFailure: reject,
    });
  });

  return mqtt;
};

module.exports = createMQTTClient;
