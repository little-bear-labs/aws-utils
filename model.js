
const createConfig = require('@conduitvc/config');
module.exports = {
  name: 'quote-provider',
  region: 'us-east-2',
  entities: [{
    name: 'QuoteRequest',  
    subscriptions: [ 'create' ],
  },{
    name: 'QuoteResponse',
    subscriptions: [ 'create' ],
  }],
  userPool: {
    id: "us-east-2_PKa2Qpncv",
    region: 'us-east-2',
  }
}
