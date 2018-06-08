#! /usr/bin/env node

// XXX: Hack to ensure we get the test config.
process.env.NODE_ENV = 'test';
// needed for amazon-cognito-identity-js
global.fetch = require('node-fetch');

const uuid = require('uuid/v4');
const aws = require('aws-sdk');
const createConfig = require('@conduitvc/config');
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');

const config = createConfig(module.parent);
const userPool = new AmazonCognitoIdentity.CognitoUserPool({
  UserPoolId: config.userPool.id,
  ClientId: config.userPool.clientId,
  region: config.cognito.region,
});

const createUser = async (cognito, { userPoolId, username, password }) => {
  const tempPassword = uuid();
  await cognito
    .adminCreateUser({
      UserPoolId: userPoolId,
      Username: username,
      MessageAction: 'SUPPRESS',
      TemporaryPassword: tempPassword,
      UserAttributes: [
        { Name: 'email_verified', Value: 'True' },
        { Name: 'email', Value: 'user@example.com' },
      ],
    })
    .promise();

  const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
    Username: username,
    Password: tempPassword,
  });
  const user = new AmazonCognitoIdentity.CognitoUser({
    Username: username,
    Pool: userPool,
  });
  user.setAuthenticationFlowType('USER_SRP_AUTH');

  await new Promise((accept, reject) => {
    user.authenticateUser(authDetails, {
      onSuccess: () => {
        accept(user);
      },
      onFailure: err => {
        reject(err);
      },
      newPasswordRequired: () => {
        accept(user);
      },
    });
  });

  await new Promise((accept, reject) => {
    user.completeNewPasswordChallenge(
      password,
      {},
      {
        onSuccess: accept,
        onFailure: reject,
      },
    );
  });

  return user;
};

async function main() {
  const username = uuid();
  const password = uuid();
  const cognito = new aws.CognitoIdentityServiceProvider(config.cognito);
  const user = await createUser(cognito, {
    userPoolId: config.userPool.id,
    username,
    password,
  });

  const idKey = user
    .getSignInUserSession()
    .getIdToken()
    .getJwtToken();

  console.log('Created Cognito user for testing:');
  console.log();
  console.log('  Username: ', username);
  console.log('  Password: ', password);
  console.log('  JWT ID Token:');
  console.log(idKey);
  console.log();
}

main().catch(err => {
  console.error('Something went wrong', err.stack);
  process.exit(1);
});
