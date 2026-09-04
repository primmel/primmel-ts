// ─────────────────────────────────────────────────────────────────────
// The term alias family (Primmel v3.2, TODO.primmel/11; MN 114 clause
// 13.10.1 — primmel/spec#18 ask 1): `aliases` / `colloquial` /
// `abbreviations` / `deprecated`, the spelling-tagged variant form
// (`colloquial fra-Latn { … }`), the v2 `alt` spelling folding into the
// canonical `aliases` channel, the forward-compat multi-token skip
// (§9.5), and the linter rule
//   C110 term-alias-shape
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

describe('term alias family: parse', () => {
  it('parses the four facets of the family', () => {
    const m = load(`
      term durability {
        label "durability"
        definition "Ability to maintain performance over a period of use."
        aliases { "long-term stability" }
        colloquial { "drifting" "scale keeps drifting" }
        abbreviations { "dur." }
        deprecated { "long-run stability" }
      }
    `);
    const t = m.terms[0];
    assert.deepEqual(t.aliases, ['long-term stability']);
    assert.deepEqual(t.colloquial, ['drifting', 'scale keeps drifting']);
    assert.deepEqual(t.abbreviations, ['dur.']);
    assert.deepEqual(t.deprecated, ['long-run stability']);
  });

  it('folds the v2 `alt` spelling into the aliases channel', () => {
    const m = load(`
      term load-cell {
        label "load cell"
        alt { "weighing cell" }
      }
    `);
    const t = m.terms[0];
    assert.deepEqual(t.aliases, ['weighing cell']);
    // The legacy field stays populated for backwards compatibility.
    assert.deepEqual(t.alt, ['weighing cell']);
  });

  it('parses spelling-tagged variant lists', () => {
    const m = load(`
      term durability {
        label "durability"
        colloquial { "drifting" }
        colloquial fra-Latn { "dérive" "les lectures dérivent" }
        aliases eng-Latn { "long-term stability" }
      }
    `);
    const t = m.terms[0];
    assert.deepEqual(t.colloquial, ['drifting']);
    assert.deepEqual(t.aliasSpellings?.['fra-Latn']?.colloquial, [
      'dérive',
      'les lectures dérivent',
    ]);
    assert.deepEqual(t.aliasSpellings?.['eng-Latn']?.aliases, [
      'long-term stability',
    ]);
  });

  it('rejects a spelling code without its list block', () => {
    assert.throws(
      () =>
        load(`
      term x {
        label "X"
        colloquial fra-Latn
      }
    `),
      /alias-family facet "colloquial" with spelling code "fra-Latn" expects a list block/,
    );
  });
});

describe('term alias family: serialization', () => {
  it('emits the canonical `aliases` form for the v2 `alt` spelling', () => {
    const out = dump(
      load(`
      term load-cell {
        label "load cell"
        alt { "weighing cell" }
      }
    `),
    );
    assert.match(out, /aliases \{ "weighing cell" \}/);
    assert.doesNotMatch(out, /\balt \{/);
  });

  it('round-trips the family to a fixed point', () => {
    const src = `
      term durability {
        label "durability"
        definition "Ability to maintain performance over a period of use."
        aliases { "long-term stability" }
        colloquial { "drifting" "scale keeps drifting" }
        abbreviations { "dur." }
        deprecated { "long-run stability" }
        colloquial fra-Latn { "dérive" "les lectures dérivent" }
        aliases eng-Latn { "long-term stability" }
      }
    `;
    const first = dump(load(src));
    assert.match(
      first,
      /colloquial fra-Latn \{ dérive "les lectures dérivent" \}/,
    );
    assert.equal(dump(load(first)), first);
  });
});

describe('term alias family: the forward-compat skip (§9.5)', () => {
  it('a construct not modelling the family skips the tagged form whole', () => {
    // A v3.1 reader meets `colloquial fra-Latn { … }` on a requirement:
    // the shape-aware skip consumes the spelling code AND the list block
    // — a one-token skip would desynchronize the facet walk.
    const m = load(`
      requirement /req/metrological/mpe {
        statement "The error shall not exceed the mpe."
        colloquial fra-Latn { "dérive" }
        obligation should
      }
    `);
    assert.equal(m.requirements.length, 1);
    assert.equal(m.requirements[0].obligation, 'should');
  });

  it('skips the bare form on an unrecording construct', () => {
    const m = load(`
      requirement /req/metrological/mpe {
        statement "The error shall not exceed the mpe."
        aliases { "maximum permissible error" }
        obligation should
      }
    `);
    assert.equal(m.requirements[0].obligation, 'should');
  });
});

// ── the check legs (C110) ────────────────────────────────────────────

function check(model: string) {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-alias-'));
  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'package.primmel'),
    'package {\n  id corpus-alias-case\n}\n',
  );
  writeFileSync(join(dir, 'model', 'm.prl'), model);
  return checkPackage(dir).filter(i => i.check === 'C110');
}

describe('term alias family: the checker (C110)', () => {
  it('a well-formed family checks clean', () => {
    const issues = check(`
term durability {
  label "durability"
  definition "…"
  aliases { "long-term stability" }
  colloquial { "drifting" }
  colloquial fra-Latn { "dérive" }
  abbreviations { "dur." }
  deprecated { "long-run stability" }
}
`);
    assert.deepEqual(issues, []);
  });

  it('a duplicate entry within one list is an error', () => {
    const issues = check(`
term durability {
  label "durability"
  colloquial { "drifting" "drifting" }
}
`);
    assert.equal(issues.filter(i => i.severity === 'error').length, 1);
    assert.match(issues[0].message, /duplicate entry "drifting"/);
  });

  it('the same string in two family fields is a rollout warning (the spec error tightens after 11d)', () => {
    const issues = check(`
term durability {
  label "durability"
  aliases { "stable" }
  colloquial { "stable" }
}
`);
    assert.deepEqual(
      issues.map(i => i.severity),
      ['warning'],
    );
    assert.match(issues[0].message, /already appears in aliases/);
  });

  it('the same string in two spellings is the variant mechanism, not a duplicate', () => {
    const issues = check(`
term durability {
  label "durability"
  colloquial { "drifting" }
  colloquial eng-Latn { "drifting" }
}
`);
    assert.deepEqual(issues, []);
  });

  it('an entry echoing the label is a warning', () => {
    const issues = check(`
term durability {
  label "durability"
  aliases { "durability" "long-term stability" }
}
`);
    assert.deepEqual(
      issues.map(i => [i.severity, /echoes the term's label/]),
      [['warning', /echoes the term's label/]],
    );
  });
});
