import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error — tsx allows the .ts extension; tsc doesn't. The runtime
// needs the explicit extension to resolve the source file in ESM mode.
import { load, dump, loadFile } from '../index.ts';

describe('public API surface', () => {
  it('exposes load, loadFile, dump as functions', () => {
    assert.equal(typeof load, 'function');
    assert.equal(typeof loadFile, 'function');
    assert.equal(typeof dump, 'function');
  });

  it('load() handles an empty document', () => {
    const s = load('');
    assert.deepEqual(s.roles, []);
    assert.deepEqual(s.processes, []);
  });

  it('dump() of a parsed document is a non-empty string when the doc has content', () => {
    const s = load('role a { name "A" }');
    const out = dump(s);
    assert.equal(typeof out, 'string');
    assert.match(out, /role a/);
  });

  it('re-exports all advertised types (compilation-time check)', () => {
    // This test exists so that a broken type re-export in index.ts would
    // surface at compile time. At runtime it is a no-op.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type _Probe = import('../index').Standard;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _check: _Probe = {} as any;
    void _check;
  });
});
