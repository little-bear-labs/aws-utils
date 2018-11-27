exports.callbackWithError = (event, context, callback) => {
  callback('error', null);
};

exports.callbackWithOutput = (event, context, callback) => {
  callback(null, true);
};

exports.asyncWithError = async () => {
  throw new Error('error');
};

exports.asyncWithOutput = async () => true;

exports.promiseWithError = () =>
  new Promise((_, reject) => {
    reject(new Error('error'));
  });

exports.promiseWithOutput = () =>
  new Promise(resolve => {
    resolve(true);
  });
