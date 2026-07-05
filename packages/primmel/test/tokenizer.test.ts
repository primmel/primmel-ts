import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import tokenize, {
  tokenizePackage,
  removePackage,
  tokenizeAttributes,
} from '../src/ser-des/tokenize';

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

describe('tokenizeAttributes', () => {
  // tokenizeAttributes expects a brace-wrapped input (it strips the outer
  // braces via removePackage, then emits alternating name / block tokens).
  // Callers like parseDataClass consume the result pairwise.
  it('emits name and block tokens alternately', () => {
    const attrs = tokenizeAttributes('{ a { x 1 } b { y 2 } }');
    assert.equal(attrs.length, 4);
    assert.equal(attrs[0], 'a ');
    assert.equal(attrs[1], '{ x 1 }');
    assert.equal(attrs[2], 'b ');
    assert.equal(attrs[3], '{ y 2 }');
  });

  it('counts nested braces as part of one block token', () => {
    const attrs = tokenizeAttributes('{ id { outer { inner } tail } }');
    assert.equal(attrs.length, 2);
    assert.equal(attrs[0], 'id ');
    assert.equal(attrs[1], '{ outer { inner } tail }');
  });
});
