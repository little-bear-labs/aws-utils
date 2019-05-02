const fs = require('fs');

// A mkdirSync which will not throw when directory exists already...
module.exports = path => {
  try {
    fs.mkdirSync(path);
  } catch (err) {
    if (err.code === 'EEXIST') {
      return;
    }
    throw err;
  }
};
