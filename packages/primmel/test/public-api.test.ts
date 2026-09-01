import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump, loadFile } from '../src/ser-des/index';

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

    type _Probe = import('../index').Standard;

    const _check: _Probe = {} as any;
    void _check;
  });

  it('parses and dumps the variable keyword round-trip', () => {
    const src = 'variable MassUnit { type string definition "g, kg, or t" }';
    const s = load(src);
    assert.equal(s.variables.length, 1);
    assert.equal(s.variables[0].id, 'MassUnit');
    assert.equal(s.variables[0].type, 'string');
    assert.equal(s.variables[0].definition, 'g, kg, or t');

    const dumped = dump(s);
    assert.match(dumped, /variable MassUnit/);
  });

  it('the browser entry exposes the enumerated vocabularies (editor window-2 pin)', async () => {
    // The browser bundle's entry is src/ser-des/index.ts — every runtime
    // API the root index exposes must be re-exported there, or the
    // browser build silently drops it. The editor's passport/endpoint
    // surfaces read the vocabularies from here; they must never
    // re-declare them.
    const surface = (await import('../src/ser-des/index.js')) as Record<
      string,
      unknown
    >;
    for (const name of [
      'PASSPORT_ACCESS_CLASSES',
      'PASSPORT_CONTENT_CLASSES',
      'PASSPORT_UPI_LEVELS',
      'ENDPOINT_ACCESS_SCOPES',
      'ENDPOINT_OPERATION_KINDS',
    ]) {
      assert.ok(name in surface, `the browser entry is missing ${name}`);
      const value = surface[name];
      assert.ok(
        Array.isArray(value) && value.length > 0,
        `${name} is a non-empty vocabulary`,
      );
    }
  });
});
