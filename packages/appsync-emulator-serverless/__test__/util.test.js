const {
  create,
  Unauthorized,
  TemplateSentError,
  CustomTemplateException,
  getAppSyncConfig,
} = require('../util');
const { javaify } = require('../vtl');

describe('util', () => {
  const now = new Date(2010, 1, 1);
  let util;
  beforeEach(() => (util = create([], now)));

  it('escapeJavaScript', () => {
    expect(util.escapeJavaScript('foo"')).toBe('foo\\"');
  });

  it('urlEncode / urlDecode', () => {
    expect(util.urlDecode(util.urlEncode('&foo'))).toBe('&foo');
  });

  it('base64encode/base64decode', () => {
    expect(util.base64Decode(util.base64Encode('&supfoo'))).toBe('&supfoo');
  });

  it('autoId', () => {
    expect(util.autoId()).toBeTruthy();
  });

  it('unauthorized', () => {
    expect(() => util.unauthorized()).toThrowError(Unauthorized);
  });

  it('error', () => {
    try {
      util.error('message', 'type', { data: true }, { errorInfo: true });
    } catch (err) {
      expect(err).toBeInstanceOf(TemplateSentError);
      expect(err).toMatchObject({
        message: 'message',
        data: { data: true },
        errorInfo: { errorInfo: true },
      });
      return;
    }
    throw new Error('must throw error');
  });

  it('appendError', () => {
    util.appendError('foo');
    util.appendError('bar');

    const errors = util.getErrors();
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toBe('foo');
    expect(errors[1].message).toBe('bar');
  });

  it('validate', () => {
    expect(util.validate(true, '', '', {})).toBe('');
    expect(() => util.validate(false, 'foo')).toThrow(CustomTemplateException);
  });

  it('typeOf', () => {
    expect(util.typeOf(null)).toBe('Null');
    expect(util.typeOf(1)).toBe('Number');
    expect(util.typeOf(1.1)).toBe('Number');
    expect(util.typeOf('')).toBe('String');
    expect(util.typeOf('a')).toBe('String');
    expect(util.typeOf({})).toBe('Map');
    expect(util.typeOf([])).toBe('List');
    expect(util.typeOf(true)).toBe('Boolean');
    expect(util.typeOf(false)).toBe('Boolean');
    expect(util.typeOf(undefined)).toBe('Object');
  });

  it('matches', () => {
    expect(util.matches('a*b', 'aaaaab')).toBe(true);
  });

  describe('.time', () => {
    it('nowISO8601', () => {
      expect(util.time.nowISO8601()).toBe(now.toISOString());
    });

    it('nowEpochSeconds', () => {
      expect(util.time.nowEpochSeconds()).toBe(now.valueOf() / 1000);
    });

    it('nowEpochMilliSeconds', () => {
      expect(util.time.nowEpochMilliSeconds()).toBe(now.valueOf());
    });

    it('nowFormatted', () => {
      expect(util.time.nowFormatted('yyyy-MM-dd HH:mm:ss')).toBe(
        '2010-00-01 00:02:00',
      );
    });
  });

  describe('.list', () => {
    it('copyAndRetainAll', () => {
      expect(util.list.copyAndRetainAll(['a', 'b', 'c'], ['a', 'c'])).toEqual([
        'a',
        'c',
      ]);
    });
    it('copyAndRemoveAll', () => {
      expect(util.list.copyAndRemoveAll(['a', 'b', 'c'], ['a', 'c'])).toEqual([
        'b',
      ]);
    });
  });
  describe('.map', () => {
    it('copyAndRetainAllKeys', () => {
      expect(
        util.map.copyAndRetainAllKeys(
          {
            a: 'a',
            b: 'b',
            c: 'c',
          },
          ['b'],
        ),
      ).toEqual({
        b: 'b',
      });
    });
    it('copyAndRemoveAllKeys', () => {
      expect(
        util.map.copyAndRemoveAllKeys(
          {
            a: 'a',
            b: 'b',
            c: 'c',
          },
          ['b'],
        ),
      ).toEqual({
        a: 'a',
        c: 'c',
      });
    });
  });
  describe('.dynamodb', () => {
    it('toDynamoDB', () => {
      expect(
        util.dynamodb.toDynamoDB(
          javaify({ foo: 'bar', baz: 1234, beep: ['boop'] }),
        ),
      ).toEqual({
        M: {
          foo: { S: 'bar' },
          baz: { N: '1234' },
          beep: {
            L: [{ S: 'boop' }],
          },
        },
      });
    });
    it('.toStringSet', () => {
      expect(util.dynamodb.toStringSet(['foo', 'bar', 'baz'])).toEqual({
        SS: ['foo', 'bar', 'baz'],
      });
    });
    it('.toNumber', () => {
      expect(util.dynamodb.toNumber('1')).toEqual({ N: '1' });
    });

    it('.toNumberSet', () => {
      expect(util.dynamodb.toNumberSet([1, 23, 4.56])).toEqual({
        NS: ['1', '23', '4.56'],
      });
    });

    it('.toBinarySet', () => {
      expect(util.dynamodb.toBinarySet(['a'])).toEqual({
        BS: ['a'],
      });
    });

    it('.toList', () => {
      expect(util.dynamodb.toList(['foo', 123, { bar: 'baz' }])).toEqual({
        L: [
          { S: 'foo' },
          { N: '123' },
          {
            M: {
              bar: { S: 'baz' },
            },
          },
        ],
      });
    });

    it('.toMap', () => {
      expect(
        util.dynamodb.toMap(javaify({ foo: 'bar', baz: 1234, beep: ['boop'] })),
      ).toEqual({
        M: {
          foo: { S: 'bar' },
          baz: { N: '1234' },
          beep: {
            L: [{ S: 'boop' }],
          },
        },
      });
    });

    it('.toMapValues', () => {
      expect(
        util.dynamodb.toMapValues(
          javaify({ foo: 'bar', baz: 1234, beep: ['boop'] }),
        ),
      ).toEqual({
        foo: { S: 'bar' },
        baz: { N: '1234' },
        beep: {
          L: [{ S: 'boop' }],
        },
      });
    });
  });

  describe('getAppSyncConfig', () => {
    it('single api', () => {
      expect(
        getAppSyncConfig({ custom: { appSync: { name: 'test' } } }),
      ).toEqual({
        name: 'test',
      });
    });
    it("multiple api's", () => {
      expect(
        getAppSyncConfig({
          custom: { appSync: [{ name: 'first' }, { name: 'second' }] },
        }),
      ).toEqual({
        name: 'first',
      });
    });

    it("multiple api's with no name", () => {
      expect(
        getAppSyncConfig({
          custom: { appSync: [{ randomConfig: 1 }, { name: 'second' }] },
        }),
      ).toEqual({
        randomConfig: 1,
      });
    });
  });
});
