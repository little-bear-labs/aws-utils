const { toJSON } = require('./vtl');

class Unauthorized extends Error {}
class TemplateSentError extends Error {
  constructor(gqlMessage, errorType, data, errorInfo) {
    super(gqlMessage);
    Object.assign(this, { gqlMessage, errorType, data, errorInfo });
  }
}
class ValidateError extends Error {
  constructor(gqlMessage, type, data) {
    super(gqlMessage);
    Object.assign(this, { gqlMessage, type, data });
  }
}

const create = (errors = [], now = new Date()) => ({
  quiet: () => '',
  qr: () => '',
  escapeJavaScript(value) {
    return require('js-string-escape')(value);
  },
  urlEncode(value) {
    return encodeURI(value);
  },
  urlDecode(value) {
    return decodeURI(value);
  },
  base64Encode(value) {
    // eslint-disable-next-line
    return new Buffer(value).toString('base64');
  },
  base64Decode(value) {
    // eslint-disable-next-line
    return new Buffer(value, 'base64').toString('ascii');
  },
  parseJson(value) {
    return JSON.parse(value);
  },
  toJson(value) {
    return JSON.stringify(value);
  },
  autoId() {
    return require('uuid/v4')();
  },
  unauthorized() {
    const err = new Unauthorized('Unauthorized');
    errors.push(err);
    throw err;
  },
  error(message, type = null, data = null, errorInfo = null) {
    const err = new TemplateSentError(message, type, data, errorInfo);
    errors.push(err);
    throw err;
  },
  appendError(message, type = null, data = null, errorInfo = null) {
    errors.push(new TemplateSentError(message, type, data, errorInfo));
    return '';
  },
  getErrors() {
    return errors;
  },
  validate(allGood, message, type, data) {
    if (allGood) return '';
    throw new ValidateError(message, type, data);
  },
  isNull(value) {
    return value === null;
  },
  isNullOrEmpty(value) {
    return !!value;
  },
  isNullOrBlank(value) {
    return !!value;
  },
  defaultIfNull(value, defaultValue = '') {
    if (value !== null && value !== undefined) return value;
    return defaultValue;
  },
  defaultIfNullOrEmpty(value, defaultValue) {
    if (value) return value;
    return defaultValue;
  },
  defaultIfNullOrBlank(value, defaultValue) {
    if (value) return value;
    return defaultValue;
  },
  isString(value) {
    return typeof value === 'string';
  },
  isNumber(value) {
    return typeof value === 'number';
  },
  isBoolean(value) {
    return typeof value === 'boolean';
  },
  isList(value) {
    return Array.isArray(value);
  },
  isMap(value) {
    if (value instanceof Map) return value;
    return value != null && typeof value === 'object';
  },
  typeOf(value) {
    if (value === null) return 'Null';
    if (this.isList(value)) return 'List';
    if (this.isMap(value)) return 'Map';
    switch (typeof value) {
      case 'number':
        return 'Number';
      case 'string':
        return 'String';
      case 'boolean':
        return 'Boolean';
      default:
        return 'Object';
    }
  },
  matches(pattern, value) {
    return new RegExp(pattern).test(value);
  },
  time: {
    nowISO8601() {
      return now.toISOString();
    },
    nowEpochSeconds() {
      return parseInt(now.valueOf() / 1000, 10);
    },
    nowEpochMilliSeconds() {
      return now.valueOf();
    },
    nowFormatted(format, timezone = null) {
      if (timezone) throw new Error('no support for setting timezone!');
      return require('dateformat')(now, format);
    },
    parseFormattedToEpochMilliSeconds() {
      throw new Error('not implemented');
    },
    parseISO8601ToEpochMilliSeconds() {
      throw new Error('not implemented');
    },
    epochMilliSecondsToSeconds() {
      throw new Error('not implemented');
    },
    epochMilliSecondsToISO8601() {
      throw new Error('not implemented');
    },
    epochMilliSecondsToFormatted() {
      throw new Error('not implemented');
    },
  },
  list: {
    copyAndRetainAll(list, intersect) {
      return list.filter(value => intersect.indexOf(value) !== -1);
    },
    copyAndRemoveAll(list, toRemove) {
      return list.filter(value => toRemove.indexOf(value) === -1);
    },
  },
  map: {
    copyAndRetainAllKeys(map, keys = []) {
      return Object.entries(map).reduce((sum, [key, value]) => {
        if (keys.indexOf(key) === -1) return sum;
        return {
          ...sum,
          [key]: value,
        };
      }, {});
    },
    copyAndRemoveAllKeys(map, keys = []) {
      const result = { ...map };
      for (const key of keys) {
        delete result[key];
      }
      return result;
    },
  },
  dynamodb: {
    toDynamoDB(value) {
      const {
        DynamoDB: { Converter },
      } = require('aws-sdk');
      return Converter.input(toJSON(value));
    },
    $toSet(values, fn = value => value) {
      const DynamoDBSet = require('aws-sdk/lib/dynamodb/set');
      return this.toDynamoDB(
        new DynamoDBSet([].concat(values).map(value => fn(value))),
      );
    },
    toDynamoDBJson(value) {
      return JSON.stringify(this.toDynamoDB(value));
    },
    toString(value) {
      return this.toDynamoDB(String(value));
    },
    toStringJson(value) {
      return this.toDynamoDBJson(value);
    },
    toStringSet(value) {
      return this.$toSet(value, String);
    },
    toStringSetJson(value) {
      return JSON.stringify(this.toStringSet(value));
    },
    toNumber(value) {
      return this.toDynamoDB(Number(value));
    },
    toNumberJson(value) {
      return JSON.stringify(this.toNumber(value));
    },
    toNumberSet(value) {
      return this.$toSet(value, Number);
    },
    toNumberSetJson(value) {
      return JSON.stringify(this.toNumberSet(value));
    },
    toBinary(value) {
      return { B: toJSON(value) };
    },
    toBinaryJson(value) {
      // this is probably wrong.
      return JSON.stringify(this.toBinary(value));
    },
    toBinarySet(value) {
      return { BS: [].concat(value) };
    },
    toBinarySetJson(value) {
      return JSON.stringify(this.toBinarySet(value));
    },
    toBoolean(value) {
      return { BOOL: value };
    },
    toBooleanJson(value) {
      return JSON.stringify(this.toBoolean(value));
    },
    toNull() {
      return { NULL: null };
    },
    toNullJson() {
      return JSON.stringify(this.toNull());
    },
    toList(value) {
      return this.toDynamoDB(value);
    },
    toListJson(value) {
      return JSON.stringify(this.toList(value));
    },
    toMap(value) {
      // this should probably do some kind of conversion.
      return this.toDynamoDB(toJSON(value));
    },
    toMapJson(value) {
      return JSON.stringify(this.toMap(value));
    },
    toMapValues(values) {
      return Object.entries(toJSON(values)).reduce(
        (sum, [key, value]) => ({
          ...sum,
          [key]: this.toDynamoDB(value),
        }),
        {},
      );
    },
    toMapValuesJson(values) {
      return JSON.stringify(this.toMapValues(values));
    },
    toS3ObjectJson() {
      throw new Error('not implemented');
    },
    toS3Object() {
      throw new Error('not implemented');
    },
    fromS3ObjectJson() {
      throw new Error('not implemented');
    },
  },
});

module.exports = {
  create,
  TemplateSentError,
  Unauthorized,
  ValidateError,
};
