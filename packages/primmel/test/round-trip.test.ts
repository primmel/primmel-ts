import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

function roundTrip(src: string): string {
  return dump(load(src));
}

describe('round-trip', () => {
  it('preserves root + metadata block ordering', () => {
    const src = `
      root home

      metadata {
        schema "1"
        author "A"
        title "T"
        edition "1"
        namespace "ns"
        shortname "t"
      }

      subprocess home {
        elements { }
        process_flow { }
        data { }
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /^root home\b/);
    assert.match(out, /metadata \{/);
  });

  it('preserves a role definition', () => {
    const src = `role author { name "Author" }`;
    const out = roundTrip(src);
    assert.match(out, /role author \{/);
    assert.match(out, /name "Author"/);
  });

  it('preserves an enum definition', () => {
    const src = `
      enum status {
        active { definition "active" }
        archived { definition "archived" }
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /enum status \{/);
    assert.match(out, /active \{/);
    assert.match(out, /archived \{/);
  });

  it('preserves a process with actor reference', () => {
    const src = `
      role author { name "Author" }
      process p {
        name "P"
        actor author
        modality shall
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /process p \{/);
    assert.match(out, /actor author/);
    assert.match(out, /modality shall/);
  });

  it('preserves a subprocess with elements, edges, and data', () => {
    const src = `
      subprocess s1 {
        elements {
          e1 { x 0 y 0 }
        }
        process_flow {
          edge1 { from e1 to e1 }
        }
        data {
        }
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /subprocess s1 \{/);
    assert.match(out, /elements \{/);
    assert.match(out, /process_flow \{/);
  });

  it('preserves a Primmel form definition', () => {
    const src = `
      form f1 {
        name "Form 1"
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /form f1 \{/);
    assert.match(out, /name "Form 1"/);
  });

  it('preserves a Primmel symbol definition', () => {
    const src = `
      symbol temperature {
        name "Temperature"
        type number
        unit "K"
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /symbol temperature \{/);
    assert.match(out, /unit "K"/);
  });

  it('drops unknown keywords without throwing (forward compat)', () => {
    const src = `
      future_keyword ignored { nothing }
      role author { name "Author" }
    `;
    const s = load(src);
    assert.equal(s.roles.length, 1);
    assert.equal(s.roles[0].id, 'author');
  });

  it('double round-trip is stable: dump(dump(load(src))) === dump(load(src))', () => {
    const src = `
      root home
      metadata {
        schema "1" author "A" title "T" edition "1" namespace "ns" shortname "t"
      }
      role author { name "Author" }
      enum status { active { definition "a" } }
    `;
    const once = roundTrip(src);
    const twice = roundTrip(once);
    assert.equal(once, twice);
  });
});
