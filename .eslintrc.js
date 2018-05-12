module.exports = {
  parser: 'babel-eslint',
  extends: ['eslint-config-airbnb-base'],
  env: {
    jest: true,
  },
  rules: {
    'global-require': 0,
    'no-restricted-syntax': 0,
    'no-await-in-loop': 0,
    'no-return-assign': 0,
  },
};
