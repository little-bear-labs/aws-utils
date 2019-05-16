const velocity = require('velocityjs');
const assert = require('assert');
const log = require('logdown')('appsync-emulator:vtl');

const javaify = value => {
  // eslint-disable-next-line
  if (value instanceof JavaMap) return value;
  // eslint-disable-next-line
  if (Array.isArray(value) && !(value instanceof JavaArray)) {
    // eslint-disable-next-line
    return new JavaArray(value.map(x => javaify(x)));
  }
  if (
    value != null &&
    typeof value === 'object' &&
    value.constructor === Object
  ) {
    // eslint-disable-next-line
    return createMapProxy(
      // eslint-disable-next-line
      new JavaMap(
        Object.entries(value).reduce(
          (sum, [k, v]) => ({
            ...sum,
            [k]: javaify(v),
          }),
          {},
        ),
      ),
    );
  }

  // eslint-disable-next-line
  if (typeof value === 'string' && !(value instanceof JavaString)) {
    // eslint-disable-next-line
    return new JavaString(value);
  }

  // for now we don't handle number.
  return value;
};

const toJSON = value => {
  if (typeof value === 'object' && value != null && 'toJSON' in value) {
    return value.toJSON();
  }
  return value;
};

class JavaString {
  constructor(str) {
    this.strVal = str;
  }

  replaceAll(find, replace) {
    const rep = this.strVal.replace(new RegExp(find, 'g'), replace);
    return new JavaString(rep);
  }

  toJSON() {
    return this.toString();
  }

  toString() {
    return this.strVal;
  }
}

class JavaArray extends Array {
  // required so array starts with zero elements
  // eslint-disable-next-line
  constructor(values = []) {
    super();
    values.forEach(value => this.add(value));
  }

  add(value) {
    this.push(javaify(value));
    return value;
  }

  addAll(value) {
    const self = this;
    value.forEach(val => self.push(javaify(val)));
  }

  clear() {
    this.length = 0;
  }

  contains(value) {
    return this.indexOf(value) !== -1;
  }

  containsAll(value = []) {
    const self = this;
    return value.every(v => self.contains(v));
  }

  isEmpty() {
    return this.length === 0;
  }

  remove(value) {
    const idx = this.indexOf(value);
    if (idx === -1) return;
    this.splice(idx, 1);
  }

  removeAll(value) {
    const self = this;
    value.forEach(val => self.remove(val));
  }

  // eslint-disable-next-line
  retainAll() {
    throw new Error('no support for retain all');
  }

  size() {
    return this.length;
  }

  toJSON() {
    return Array.from(this).map(toJSON);
  }
}

const createMapProxy = map =>
  new Proxy(map, {
    get(obj, prop) {
      if (map.map.has(prop)) {
        return map.get(prop);
      }
      return map[prop];
    },
  });

class JavaMap {
  constructor(obj) {
    this.map = new Map();
    this.toJSON = this.toJSON.bind(this);
    Object.entries(obj).forEach(([key, value]) => {
      this.map.set(key, value);
    });
  }

  clear() {
    this.map.clear();
  }

  containsKey(key) {
    return this.map.has(key);
  }

  containsValue(value) {
    return this.map.values().indexOf(value) !== -1;
  }

  entrySet() {
    const entries = Array.from(this.map.entries()).map(([key, value]) =>
      createMapProxy(
        new JavaMap({
          key,
          value,
        }),
      ),
    );

    return new JavaArray(entries);
  }

  equals(value) {
    assert(value instanceof JavaMap);
    return this.map.entries.every(([key, v]) => value.get(key) === v);
  }

  get(key) {
    if (this.map.has(key.toString())) {
      return this.map.get(key);
    }
    return null;
  }

  isEmpty() {
    return this.map.size === 0;
  }

  keySet() {
    return new JavaArray(Array.from(this.map.keys()));
  }

  put(key, value) {
    const saveValue = javaify(value);
    this.map.set(key, saveValue);
    return saveValue;
  }

  putAll(map) {
    assert(map instanceof JavaMap);
    Array.from(map.map.entries()).forEach(([key, value]) => {
      this.put(key, value);
    });
  }

  remove(key) {
    if (!this.map.has(key)) {
      return null;
    }
    const value = this.map.get(key);
    this.map.delete(key);
    return value;
  }

  size() {
    return this.map.size;
  }

  values() {
    return new JavaArray(Array.from(this.map.values()));
  }

  toJSON() {
    return Array.from(this.map.entries()).reduce(
      (sum, [key, value]) => ({
        ...sum,
        [key]: toJSON(value),
      }),
      {},
    );
  }
}

const vtl = (str, context, macros = {}) => {
  log.info('render\n', str);
  const output = velocity.render(str, context, macros, {
    valueMapper: javaify,
  });
  log.info('render output\n', output);
  return output;
};

module.exports = { vtl, javaify, toJSON };
