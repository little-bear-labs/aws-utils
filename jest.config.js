module.exports = {
  bail: true,
  verbose: false,
  projects: [
    {
      displayName: 'test',
    },
    {
      runner: 'jest-runner-eslint',
      displayName: 'lint',
      testMatch: ['<rootDir>/**/*.js'],
    },
  ],
};
