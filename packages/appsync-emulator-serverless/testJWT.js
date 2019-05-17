const faker = require('faker');
const jsonwebtoken = require('jsonwebtoken');
const jwtDecode = require('jwt-decode');

const string =
  'eyJraWQiOiI2SnRBWkxOdFIrSENMK0Nxd2dkM2g3N09OWWFjTkV1Y1wvd0lHeWhIM3A5TT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIyMzU3YmU3Yy0zOWUwLTQ2MWUtOGQ4Zi05YTdhMDAzYzI5NGQiLCJhdWQiOiJxNHBwdTQwNHNkaXFsY2pnMjE3NTZodmFwIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImV2ZW50X2lkIjoiMDY2ZjFjYWQtNmRhMC0xMWU4LTg1MTQtODc4NTQwZThkZjMzIiwidG9rZW5fdXNlIjoiaWQiLCJhdXRoX3RpbWUiOjE1Mjg3Mzk0NzAsImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC51cy1lYXN0LTEuYW1hem9uYXdzLmNvbVwvdXMtZWFzdC0xXzI3V2NNTDlrOCIsImNvZ25pdG86dXNlcm5hbWUiOiJkOWFlYWFkYy1lNjc3LTRjNjUtOWQ2OS1hNGQ2ZjNhN2RmODYiLCJleHAiOjE1Mjg3NDMwNzAsImlhdCI6MTUyODczOTQ3MCwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIn0.X7PSLJ27adURsyD5lTFNkBTWnhpOrgoObVhk4pyXQ7kFofA9JrNguxKg_h-2pp0VWhwrJ_HoprCLtuB9O3Ly0AZfYOhzcmD-S67a2TSyq3JgANcJIE5b8hPahQoEdojdbctfp9JkRmxnWVOTDZ8jJ_HTTStougBIVVvvp9tEPDwvDZmfUmsfQKKYTgUXN-KvSOm_wzsKb1_AJ13dbpFcCDpn2msoQ9ghC7Iwv8wtFnP4QmPUOeoSkDpMSiRzVSOQiOTG33ZuxtFyEHy5frEx_q-UW9Y5czUs1owtbC1J-QaYKUZQCVJPkHohN6xRfQo3SshzUUIZ_aoK1aqSompDIQ';

function generateTestJWT(overrides = {}) {
  return jsonwebtoken.sign(
    {
      sub: faker.random.uuid(),
      aud: faker.random.alphaNumeric().toLowerCase(),
      email_verified: true,
      event_id: faker.random.uuid(),
      token_use: 'id',
      auth_time: 1528739470,
      iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_27WcML9k8',
      'cognito:username': faker.random.uuid(),
      exp: 1528743070,
      iat: 1528739470,
      email: faker.internet.email(),
      ...overrides,
    },
    '',
    { algorithm: 'none' },
  );
}

module.exports = {
  string,
  decoded: jwtDecode(string),
  generateTestJWT,
};

// string Decodes to:

/*

header:
{
  "kid": "6JtAZLNtR+HCL+Cqwgd3h77ONYacNEuc/wIGyhH3p9M=",
  "alg": "RS256"
}

payload:
{
  "sub": "2357be7c-39e0-461e-8d8f-9a7a003c294d",
  "aud": "q4ppu404sdiqlcjg21756hvap",
  "email_verified": true,
  "event_id": "066f1cad-6da0-11e8-8514-878540e8df33",
  "token_use": "id",
  "auth_time": 1528739470,
  "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_27WcML9k8",
  "cognito:username": "d9aeaadc-e677-4c65-9d69-a4d6f3a7df86",
  "exp": 1528743070,
  "iat": 1528739470,
  "email": "user@example.com"
}
*/
