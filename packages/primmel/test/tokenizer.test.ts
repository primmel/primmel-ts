import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import tokenize, {
  tokenizePackage,
  removePackage,
} from '../src/ser-des/tokenize';
import { forEachAttribute, forEachEntry } from '../src/ser-des/parse-block';

describe('tokenize', () => {
  it('splits whitespace-delimited tokens', () => {
    assert.deepEqual(tokenize('a b c'), ['a', 'b', 'c']);
  });

  it('collapses multiple whitespace', () => {
    assert.deepEqual(tokenize('a   b\n\tc'), ['a', 'b', 'c']);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(tokenize(''), []);
  });

  it('returns empty array for whitespace-only input', () => {
    assert.deepEqual(tokenize('   \n\t  '), []);
  });

  it('treats "..." strings as single tokens', () => {
    assert.deepEqual(tokenize('"hello world" id'), ['"hello world"', 'id']);
  });

  it('treats { ... } blocks as single tokens', () => {
    assert.deepEqual(tokenize('id { a b c }'), ['id', '{ a b c }']);
  });

  it('counts nested braces', () => {
    assert.deepEqual(tokenize('id { a { b } c }'), ['id', '{ a { b } c }']);
  });

  it('does NOT count braces inside quoted strings', () => {
    // The string "{ fake }" must not confuse the brace counter.
    assert.deepEqual(tokenize('id { prefix "{ fake }" suffix }'), [
      'id',
      '{ prefix "{ fake }" suffix }',
    ]);
  });

  it('does NOT terminate strings inside brace blocks early', () => {
    // A quoted "}" inside a block must not end the block.
    assert.deepEqual(tokenize('id { key "val } ue" }'), [
      'id',
      '{ key "val } ue" }',
    ]);
  });

  it('skips // line comments', () => {
    assert.deepEqual(tokenize('// comment\na b\n// trailing\n'), ['a', 'b']);
  });

  it('skips # line comments', () => {
    assert.deepEqual(tokenize('# comment\na b\n# trailing\n'), ['a', 'b']);
  });

  it('ignores // inside quoted strings', () => {
    assert.deepEqual(tokenize('"a // b" c'), ['"a // b"', 'c']);
  });

  it('honours backslash escapes in strings', () => {
    assert.deepEqual(tokenize('"he said \\"hi\\"" c'), [
      '"he said \\"hi\\""',
      'c',
    ]);
  });

  it('does NOT terminate strings on escaped quotes inside brace blocks', () => {
    assert.deepEqual(tokenize('id { key "val \\" } \\" ue" }'), [
      'id',
      '{ key "val \\" } \\" ue" }',
    ]);
  });
});

describe('removePackage', () => {
  it('strips outer braces from a {...} block', () => {
    assert.equal(removePackage('{ inner }'), ' inner ');
  });

  it('returns input unchanged for a string shorter than 2 chars', () => {
    assert.equal(removePackage(''), '');
    assert.equal(removePackage('{'), '{');
  });
});

describe('tokenizePackage', () => {
  it('removes outer braces then tokenizes', () => {
    assert.deepEqual(tokenizePackage('{ a "b c" d }'), ['a', '"b c"', 'd']);
  });
});

describe('forEachAttribute', () => {
  // forEachAttribute parses class-body style `<name-spec> { <block> }`
  // pairs. The name-spec may span multiple tokens (e.g. `attr1: string`).
  const collect = (data: string) => {
    const out: Array<[string, string]> = [];
    forEachAttribute(data, (name, block) => out.push([name, block]), {
      construct: 'test',
      id: '',
    });
    return out;
  };

  it('emits name-spec and block pairs', () => {
    assert.deepEqual(collect('{ a { x 1 } b { y 2 } }'), [
      ['a', ' x 1 '],
      ['b', ' y 2 '],
    ]);
  });

  it('keeps multi-token name specs together', () => {
    assert.deepEqual(collect('{ a: string { x 1 } b: int [0..1] { y 2 } }'), [
      ['a: string', ' x 1 '],
      ['b: int [0..1]', ' y 2 '],
    ]);
  });

  it('counts nested braces as part of one block', () => {
    assert.deepEqual(collect('{ id { outer { inner } tail } }'), [
      ['id', ' outer { inner } tail '],
    ]);
  });

  it('does NOT count braces inside quoted strings', () => {
    assert.deepEqual(collect('{ id { default "has } char" } }'), [
      ['id', ' default "has } char" '],
    ]);
  });

  it('does NOT terminate strings on escaped quotes', () => {
    assert.deepEqual(collect('{ id { default "val \\" tail" } }'), [
      ['id', ' default "val \\" tail" '],
    ]);
  });

  it('throws on a truncated body', () => {
    assert.throws(() => collect('{ a b c }'), /Expecting \{ after a b c/);
  });
});

describe('forEachEntry', () => {
  it('auto-skips unknown keywords for forward compat', () => {
    const seen: Array<[string, string | undefined]> = [];
    forEachEntry(
      '{ known value1 unknown value2 }',
      (kw, value) => {
        if (kw === 'known') {
          seen.push([kw, value()]);
          return true;
        }
        return false;
      },
      { construct: 'test', id: '' },
    );
    // 'unknown' should be auto-skipped; 'known' is claimed.
    assert.deepEqual(seen, [['known', 'value1']]);
  });

  it('throws on truncated block', () => {
    assert.throws(
      () =>
        forEachEntry('{ orphan }', () => true, { construct: 'test', id: 'x' }),
      /Expecting value for orpha/,
    );
  });
});
