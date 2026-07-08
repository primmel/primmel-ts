import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../index.ts';

describe('term keyword', () => {
  it('parses a minimal term', () => {
    const src = `
      term maximum-capacity {
        label "Maximum capacity"
        definition "The maximum load that a load cell is designed to measure"
      }
    `;
    const s = load(src);
    assert.equal(s.terms.length, 1);
    assert.equal(s.terms[0].id, 'maximum-capacity');
    assert.equal(s.terms[0].label, 'Maximum capacity');
    assert.equal(s.terms[0].definition, 'The maximum load that a load cell is designed to measure');
    assert.equal(s.terms[0].symbolId, '');
    assert.deepEqual(s.terms[0].referenceIds, []);
  });

  it('parses a term with symbol cross-reference and references', () => {
    const src = `
      term maximum-capacity {
        label "Maximum capacity"
        definition "..."
        symbol Emax
        reference { R60-1-3-3 }
      }
    `;
    const s = load(src);
    assert.equal(s.terms[0].symbolId, 'Emax');
    assert.deepEqual(s.terms[0].referenceIds, ['R60-1-3-3']);
  });

  it('dumps a term round-trip', () => {
    const src = `
      term dr {
        label "Minimum dead load output return"
        definition "DR concept"
        symbol DR
        reference { R60-1-3-5-10 }
      }
    `;
    const s = load(src);
    const out = dump(s);
    assert.match(out, /term dr \{/);
    assert.match(out, /label "Minimum dead load output return"/);
    assert.match(out, /symbol DR/);
    assert.match(out, /R60-1-3-5-10/);
  });

  it('forward-compat: unknown sub-keywords inside a term are skipped', () => {
    const src = `
      term x {
        label "X"
        future_field value
      }
    `;
    const s = load(src);
    assert.equal(s.terms.length, 1);
    assert.equal(s.terms[0].label, 'X');
  });

  it('tolerates quoted symbol id (defensive)', () => {
    // The dumper writes bare IDs (`symbol Emax`). Quoted form is accepted
    // defensively but not the canonical form.
    const src = `
      term x {
        label "X"
        symbol "Emax"
      }
    `;
    const s = load(src);
    assert.equal(s.terms[0].symbolId, 'Emax');
  });
});
