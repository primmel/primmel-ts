// ─────────────────────────────────────────────────────────────────────
// The legacy provenance spellings are RETIRED (1.21.21): `source { doc
// clause }`, the `reference { doc clause }` role-channel blocks, and
// `specification_reference "…"` no longer parse — the canonical
// `ref derives-from "<document anchor>"` / `ref cites "<anchor>"` is the
// only spelling. The evaluation's citation rides `ref cites` inside the
// evaluation line (its display string retired with the others).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dump, load } from '../src/ser-des/index';

describe('the retired provenance spellings', () => {
  it('refuses a source block', () => {
    assert.throws(
      () =>
        load(
          'requirement r { statement "S" source { doc "urn:x" clause "1" } }',
        ),
      /source \{ doc clause \} provenance spelling is retired/,
    );
  });

  it('refuses specification_reference on a field', () => {
    assert.throws(
      () =>
        load(
          'form f { clause "1" field a : boolean { specification_reference "R 60-1, 5.3.1" } }',
        ),
      /specification_reference facet is retired/,
    );
  });

  it('refuses specification_reference inside an evaluation', () => {
    assert.throws(
      () =>
        load(
          'form f { clause "1" field a : boolean { evaluation { rule "ocl{x}" condition "C" specification_reference "R 60-1, 5.3.1" } } }',
        ),
      /specification_reference facet is retired/,
    );
  });
});

describe('the canonical citation channels', () => {
  it('parses ref derives-from on a construct and folds it onto provenance', () => {
    const m = load(
      'requirement r { statement "S" ref derives-from "urn:oiml:pub:r:60-1:2021#clause-5.3.1" }',
    );
    const r = m.requirements[0]!;
    assert.equal(r.source?.doc, 'urn:oiml:pub:r:60-1:2021');
    assert.equal(r.source?.clause, '5.3.1');
    assert.equal(dump(m), dump(load(dump(m))));
  });

  it('parses ref cites inside an evaluation and round-trips it', () => {
    const src =
      'form f {\n' +
      '  clause "1"\n' +
      '  field a : boolean {\n' +
      '    evaluation { rule "ocl{x}" condition "C" ref cites "urn:oiml:pub:r:60-1:2021#clause-5.3.1" }\n' +
      '  }\n' +
      '}\n';
    const m = load(src);
    const ev = m.forms[0]!.fields[0]!.evaluation!;
    assert.equal(ev.refs?.length, 1);
    assert.equal(ev.refs?.[0]?.predicate, 'cites');
    assert.equal(ev.refs?.[0]?.target, 'urn:oiml:pub:r:60-1:2021#clause-5.3.1');
    const out = dump(m);
    assert.ok(
      out.includes('ref cites "urn:oiml:pub:r:60-1:2021#clause-5.3.1"'),
    );
    assert.equal(dump(load(out)), out);
  });
});
