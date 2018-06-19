const del = require('del');
const fs = require('fs');
const util = require('util');

const exec = util.promisify(require('child_process').exec);

const REPO_FOLDER = `${__dirname}/test-repo`;

const reset = async () => {
  return
  if (fs.existsSync(REPO_FOLDER)) {
    if (fs.existsSync(`${REPO_FOLDER}/serverless.yml`)) {
      // await exec(`cd ${REPO_FOLDER}; serverless delete-appsync`);
    }
    await del([REPO_FOLDER]);
  }
};

beforeAll(async () => {
  await reset();
  fs.mkdirSync(REPO_FOLDER);
  fs.mkdirSync(`${REPO_FOLDER}/config`);
  fs.copyFileSync(`${__dirname}/config/defaults.js`, `${REPO_FOLDER}/config/defaults.js`);
  fs.copyFileSync(`${__dirname}/config/test.js`, `${REPO_FOLDER}/config/test.js`);
  await exec(`cd ${REPO_FOLDER}; cp ${__dirname}/.test-package.json ${REPO_FOLDER}/package.json`);
  await exec(`cd ${REPO_FOLDER}; node ${__dirname}/../bin/bootstrapAppSyncDynamo.js`);
  await exec(`cd ${REPO_FOLDER}; serverless deploy-appsync --AWS_ACCOUNT_ID 229055845648 --USER_POOL_ID us-east-2_PKa2Qpncv`);
});

afterAll(async () => {
  await reset();
});

describe('Bootstrap Appsync Dynamo', () => {
  it('win', () => {
    expect(true).toBeTruthy();
  });
});
