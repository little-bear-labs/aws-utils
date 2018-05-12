module.exports = {
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
