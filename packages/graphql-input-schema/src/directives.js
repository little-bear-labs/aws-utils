const { Validator } = require('class-validator');

const validator = new Validator();
const debug = require('debug')('graphql-input-schema:transformers');

const SIMPLE_SINGLE = [
  'isAlpha',
  'isAlphanumeric',
  'isAscii',
  'isBase64',
  'isCreditCard',
  'isEmail',
  'isFQDN',
  'isURL',
  'isFullWidth',
  'isHalfWidth',
  'isVariableWidth',
  'isHexColor',
  'isHexadecimal',
  'isISIN',
  'isISO8601',
  'isJSON',
  'isLowercase',
  'isMongoId',
  'isMultibyte',
  'isSurrogatePair',
  'isUppercase',
  'isMilitaryTime',
  'isPositive',
  'isNegative',
];

const runValidator = (method, value, args, err) => {
  const result = validator[method](value, ...args);
  debug('run validator', { method, value, result });
  if (!result) {
    throw new Error(err());
  }
  return value;
};

const runValidatorSingleValue = (method, meta, value, args, err) => {
  if (!meta.type.list) {
    return runValidator(method, value, args, err);
  }

  return value.reduce(
    (sum, toValidate) => runValidator(method, toValidate, args, err),
    value,
  );
};

function validateIsIn(value, { in: inputs }, meta) {
  return runValidatorSingleValue(
    'isIn',
    meta,
    value,
    [inputs],
    () => `value is not in list ${inputs.join(', ')}`,
  );
}

function validateIsNotIn(value, { in: inputs }, meta) {
  return runValidatorSingleValue(
    'isNotIn',
    meta,
    value,
    [inputs],
    () => `value disallowed from list ${inputs.join(', ')}`,
  );
}

function validateGreaterThan(value, { number }) {
  if (value < number) throw new Error(`value is less than ${number}`);
  return value;
}

function validateLessThan(value, { number }) {
  if (value > number) throw new Error(`value is greater than ${number}`);
  return value;
}

function validateLength(value, { min, max }, meta) {
  return runValidatorSingleValue(
    'length',
    meta,
    value,
    [min, max],
    () => `value must be between the length of ${min}-${max}`,
  );
}

function validateMinLength(value, { min }, meta) {
  return runValidatorSingleValue(
    'minLength',
    meta,
    value,
    [min],
    () => `value must be minimum length of ${min}`,
  );
}

function validateMaxLength(value, { max }, meta) {
  return runValidatorSingleValue(
    'maxLength',
    meta,
    value,
    [max],
    () => `value must be maximum length of ${max}`,
  );
}

function validateByteLength(value, { min, max }, meta) {
  return runValidatorSingleValue(
    'isByteLength',
    meta,
    value,
    [min, max],
    () => `value must be between the btye length of ${min}-${max}`,
  );
}

function classDirective(value, { name }, { classes }) {
  const classConstructor = classes[name];
  if (!classConstructor) {
    throw new Error(`Class ${name} is not registered`);
  }
  // eslint-disable-next-line
  return new classConstructor(value);
}

module.exports = {
  validateLength,
  validateByteLength,
  validateIsIn,
  validateIsNotIn,
  validateLessThan,
  validateGreaterThan,
  validateMinLength,
  validateMaxLength,
  class: classDirective,
};

SIMPLE_SINGLE.forEach(method => {
  const name = `validate${method[0].toUpperCase()}${method.slice(1)}`;
  module.exports[name] = (value, _, meta) =>
    runValidatorSingleValue(
      method,
      meta,
      value,
      [],
      () => `value fails pattern ${name}`,
    );
});
