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
  });
});
