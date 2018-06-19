const region = 'us-east-2';

module.exports = {
  entities: [{
    attributes: [{
      name: 'foo',
      type: 'String',
    },{
      name: 'bar',
      type: 'Float',
    }],
    name: 'Baz',
    subscriptions: [ 'put' ],
  }],
  name: 'bootstrap-appsync-dynamo-test',
  region,
  userPool: {
    awsRegion: region,
    defaultAction: 'ALLOW',
  },
}; 
