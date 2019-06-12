const { vtl, javaify } = require('../vtl');

describe('vtl', () => {
  describe('array', () => {
    it('.add', () => {
      const out = vtl(
        `
        #set($foo = [])
        #set($x = $foo.add(0))
        #set($x = $foo.add(1))
        $foo[0] - $foo[1]
        `,
      ).trim();
      expect(out).toBe('0 - 1');
    });

    it('should work with constructor', () => {
      const out = vtl(
        `
        #set($foo = [0, 1])
        $foo[0] - $foo[1]
        `,
      ).trim();
      expect(out).toBe('0 - 1');
    });

    it('forEach', () => {
      const out = vtl(
        `
        #foreach ( $value in $ctx.values )
        $value
        #end
        `,
        javaify({
          ctx: { values: [1, 2, 3] },
        }),
      );
      expect(out.trim()).toBe('1\n                2\n                3');
    });
  });

  describe('map', () => {
    it('should expose java map methods', () => {
      const out = vtl(
        `
        #set($foo = {})
        #set($x = $foo.put('key', 'value'))
        $foo.key
      `,
      ).trim();
      expect(out).toBe('value');
    });

    it('should work with nested values', () => {
      const out = vtl(
        `
          #set($foo = { "bar": { "baz": {} } })
          #set($value = $foo.bar.baz.put('hello', 'worked'))
          #console($foo)
          $foo.bar.baz.hello
        `,
      );
      expect(out.trim()).toBe('worked');
    });

    it('should work with putAll', () => {
      const out = vtl(
        `
        #set($item = {})
        #set($ignore = $item.putAll($ctx.result))
        $item.toJSON()
        `,
        javaify({
          ctx: { result: { pk: 'pk-123', sk: 'sk' } },
        }),
      );
      expect(out.trim()).toBe('{pk=pk-123, sk=sk}');
    });
  });

  describe('string', () => {
    it('should have a replaceAll method', () => {
      const out = vtl(
        `
        #set($item = {})
        #set($ignore = $item.put('id', $ctx.result.pk.replaceAll('pk-', '')))
        $item.toJSON()
        `,
        javaify({
          ctx: { result: { pk: 'pk-123', sk: 'sk' } },
        }),
      ).trim();
      expect(out).toBe('{id=123}');
    });

    it('split without capturing groups', () => {
      const out = vtl(
        `
        #set($splitted = $ctx.args.str.split("\\|"))
        $splitted.toJSON()
        `,
        javaify({
          ctx: { args: { str: 'a|b|c' } },
        }),
      ).trim();
      expect(out).toBe('[a, b, c]');
    });

    it('split with capturing group', () => {
      const out = vtl(
        `
        #set($splitted = $ctx.args.str.split("(\\|)"))
        $splitted.toJSON()
        `,
        javaify({
          ctx: { args: { str: 'a|b|c' } },
        }),
      ).trim();
      expect(out).toBe('[a, b, c]');
    });

    it('split with two capturing groups', () => {
      const out = vtl(
        `
        #set($splitted = $ctx.args.str.split("(\\|)(x)"))
        $splitted.toJSON()
        `,
        javaify({
          ctx: { args: { str: 'a|xb|xc' } },
        }),
      ).trim();
      expect(out).toBe('[a, b, c]');
    });

    it('should do complex regex split', () => {
      const out = vtl(
        `
        #set($splitted = $ctx.args.str.split("(\\|)(?!.*\\|)"))
        $splitted.toJSON()
        `,
        javaify({
          ctx: { args: { str: 'a|b|c' } },
        }),
      ).trim();
      expect(out).toBe('[a|b, c]');
    });
  });
});

describe('value mapper', () => {
  it('should recurse through the map and assign values', () => {
    const jResult = javaify({ ctx: { result: { pk: 'pk-123', sk: 'sk' } } });
    expect(jResult.constructor.name).toEqual('JavaMap');
    const ctx = jResult.map.get('ctx');
    expect(ctx.constructor.name).toEqual('JavaMap');
    const result = ctx.map.get('result');
    expect(result.constructor.name).toEqual('JavaMap');
    const pk = result.map.get('pk');
    const sk = result.map.get('sk');
    expect(pk.constructor.name).toEqual('JavaString');
    expect(sk.constructor.name).toEqual('JavaString');
  });

  it('should recurse through an array and assign values', () => {
    const jResult = javaify([[1, '2', 3], [4, 5, 6], [7, 8, 9]]);
    expect(jResult.constructor.name).toEqual('JavaArray');
    expect(jResult[0].constructor.name).toEqual('JavaArray');
    expect(jResult[0][0].constructor.name).toEqual('Number');
    expect(jResult[0][1].constructor.name).toEqual('JavaString');
  });

  it('should map a string', () => {
    const jResult = javaify('lorem ipsum');
    expect(jResult.constructor.name).toEqual('JavaString');
  });
});
