// ─────────────────────────────────────────────────────────────────────
// The top-level dimension construct + the applicability dimension
// namespace (Primmel v3.2, TODO.primmel/11; MN 114 clauses 10.6 and
// 11.1.1 — primmel/spec#18 ask 2). Covers the parse (one grammar, two
// placements; the values_of register domain), the round-trip fixpoint,
// the C3 namespace widening (applicability keys resolve against inline
// dimensions, is_dimension attribute mirrors, and top-level
// declarations), and the linter rule
//   C111 dimension-shape
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

describe('top-level dimension: parse', () => {
  it('parses a dimension with values and provenance', () => {
    const m = load(`
      dimension power-supply-axis {
        label "Power supply"
        description "Power source of the instrument."
        cardinality single
        values {
          ac-mains { label "AC mains" description "Supply from AC mains power." }
          battery { label "Battery" }
          ac-and-battery {
            label "AC mains and battery"
            implies { ac-mains battery }
          }
        }
        ref derives-from "urn:oiml:pub:r:144-1:2013#clause-4.5.1"
      }
    `);
    assert.equal(m.dimensions.length, 1);
    const d = m.dimensions[0];
    assert.equal(d.id, 'power-supply-axis');
    assert.equal(d.label, 'Power supply');
    assert.equal(d.cardinality, 'single');
    assert.equal(d.values.length, 3);
    assert.deepEqual(d.values[2].implies, ['ac-mains', 'battery']);
    // The derives-from ref folds onto the provenance slot.
    assert.equal(d.source?.doc, 'urn:oiml:pub:r:144-1:2013');
    assert.equal(d.source?.clause, '4.5.1');
  });

  it('parses the values_of register form', () => {
    const m = load(`
      dimension capabilities {
        label "Capabilities"
        cardinality set
        values_of capabilities
      }
    `);
    const d = m.dimensions[0];
    assert.equal(d.valuesOf, 'capabilities');
    assert.deepEqual(d.values, []);
  });

  it('rejects an unknown cardinality, like the inline form', () => {
    assert.throws(
      () => load('dimension d { cardinality many }'),
      /Unknown cardinality many/,
    );
  });
});

describe('top-level dimension: serialization', () => {
  it('round-trips both forms to a fixed point', () => {
    const src = `dimension power-supply-axis {
  label "Power supply"
  cardinality single
  description "Power source of the instrument."
  reference { doc "urn:oiml:pub:r:144-1:2013" clause "4.5.1" }
  values {
    ac-mains { label "AC mains" description "Supply from AC mains power." }
    battery { label "Battery" }
    ac-and-battery { label "AC mains and battery" implies { ac-mains battery } }
  }
}
dimension capabilities {
  label "Capabilities"
  cardinality set
  values_of capabilities
}
`;
    const first = dump(load(src));
    assert.equal(dump(load(first)), first);
    assert.match(first, /values_of capabilities/);
  });

  it('a v3.1 reader skips the construct whole (lenient forward-compat)', () => {
    // The lenient parse skips the unknown top-level keyword (clause 9.5):
    // `dimension <id> { … }` reads as keyword + id + payload.
    const m = load(`
      unknown_future_thing x { payload 1 }
      term t { label "T" }
    `);
    assert.equal(m.terms.length, 1);
  });
});

// ── the check legs (C3 widening + C111) ──────────────────────────────

function check(model: string) {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-dim-'));
  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'package.primmel'),
    'package {\n  id corpus-dimension-case\n}\n',
  );
  writeFileSync(join(dir, 'model', 'm.prl'), model);
  return checkPackage(dir);
}

describe('applicability namespace: the C3 widening (clause 11.1.1)', () => {
  it('an applicability entry keys on a top-level dimension', () => {
    const issues = check(`
dimension power-supply-axis {
  cardinality single
  values { ac-mains battery }
}
requirement /req/metrological/mpe {
  statement "The error shall not exceed the mpe."
  applicability { power-supply-axis: [ac-mains] }
}
`);
    assert.deepEqual(
      issues.filter(i => i.severity === 'error'),
      [],
    );
  });

  it('a value outside the top-level dimension is a C3 error', () => {
    const issues = check(`
dimension power-supply-axis {
  cardinality single
  values { ac-mains battery }
}
requirement /req/metrological/mpe {
  statement "The error shall not exceed the mpe."
  applicability { power-supply-axis: [solar] }
}
`);
    const c3 = issues.filter(i => i.check === 'C3' && i.severity === 'error');
    assert.equal(c3.length, 1);
    assert.match(c3[0].message, /not in the dimension's values/);
  });

  it('values_of capabilities resolves the domain from the capability register', () => {
    const issues = check(`
dimension capabilities {
  cardinality set
  values_of capabilities
}
capability digital-output {
  name "Digital output"
}
requirement /req/technical/interface {
  statement "The instrument shall provide the declared interfaces."
  applicability { capabilities: [digital-output] match all }
}
`);
    assert.deepEqual(
      issues.filter(i => i.severity === 'error'),
      [],
    );
  });

  it('a capability not in the register is a C3 error', () => {
    const issues = check(`
dimension capabilities {
  cardinality set
  values_of capabilities
}
capability digital-output {
  name "Digital output"
}
requirement /req/technical/interface {
  statement "The instrument shall provide the declared interfaces."
  applicability { capabilities: [wireless] }
}
`);
    const c3 = issues.filter(i => i.check === 'C3' && i.severity === 'error');
    assert.equal(c3.length, 1);
    assert.match(c3[0].message, /capabilities="wireless"/);
  });

  it('an is_dimension attribute mirror resolves its domain from the bound enum', () => {
    const issues = check(`
enum humidity_class { H1 { } H2 { } }
attribute_definition humidity_symbol {
  name "Humidity class"
  is_dimension true
  enum humidity_class
}
requirement /req/metrological/climatic {
  statement "The instrument shall withstand the declared humidity class."
  applicability { humidity_symbol: [H1] }
}
`);
    assert.deepEqual(
      issues.filter(i => i.severity === 'error'),
      [],
    );
  });

  it('a mapping-block key resolves against the dimension values', () => {
    const issues = check(`
dimension accuracy-axis {
  cardinality single
  values { A B }
}
requirement /req/metrological/mpe {
  statement "The error shall not exceed the mpe."
  applicability { accuracy-axis: { A: 5 B: 3 } }
}
`);
    assert.deepEqual(
      issues.filter(i => i.severity === 'error'),
      [],
    );
    const bad = check(`
dimension accuracy-axis {
  cardinality single
  values { A B }
}
requirement /req/metrological/mpe {
  statement "The error shall not exceed the mpe."
  applicability { accuracy-axis: { X: 5 } }
}
`);
    const c3 = bad.filter(i => i.check === 'C3' && i.severity === 'error');
    assert.equal(c3.length, 1);
    assert.match(c3[0].message, /mapping key "X"/);
  });
});

describe('dimension-shape: the checker (C111)', () => {
  const only111 = (issues: ReturnType<typeof check>) =>
    issues.filter(i => i.check === 'C111');

  it('well-formed dimensions check clean', () => {
    const issues = only111(
      check(`
dimension power-supply-axis {
  cardinality single
  values {
    ac-mains battery
    ac-and-battery { implies { ac-mains battery } }
  }
}
dimension capabilities {
  cardinality set
  values_of capabilities
}
`),
    );
    assert.deepEqual(issues, []);
  });

  it('a duplicate value id is an error', () => {
    const issues = only111(check('dimension d { values { a b a } }'));
    assert.equal(issues.filter(i => i.severity === 'error').length, 1);
    assert.match(issues[0].message, /duplicate value id "a"/);
  });

  it('an implies target outside the dimension is an error', () => {
    const issues = only111(
      check('dimension d { values { a { implies { zz } } b } }'),
    );
    assert.equal(issues.filter(i => i.severity === 'error').length, 1);
    assert.match(issues[0].message, /implies "zz", which is not a value/);
  });

  it('an implies cycle is an error', () => {
    const issues = only111(
      check(
        'dimension d { values { a { implies { b } } b { implies { a } } } }',
      ),
    );
    assert.equal(issues.filter(i => i.severity === 'error').length, 1);
    assert.match(issues[0].message, /implies cycle/);
  });

  it('the inline instrument dimension is checked with the same grammar', () => {
    const issues = only111(
      check(`
instrument Meter {
  dimension mode {
    cardinality single
    values { x { implies { y } } y { implies { x } } }
  }
}
`),
    );
    assert.equal(issues.filter(i => i.severity === 'error').length, 1);
    assert.match(issues[0].message, /instrument Meter/);
  });

  it('values and values_of combined are an error', () => {
    const issues = only111(
      check('dimension d { values { a } values_of capabilities }'),
    );
    assert.equal(issues.filter(i => i.severity === 'error').length, 1);
    assert.match(issues[0].message, /both values and values_of/);
  });

  it('an undocumented values_of register warns and opens the domain', () => {
    const issues = check(`
dimension d {
  values_of outcomes
}
requirement /req/x {
  statement "…"
  applicability { d: [anything-goes] }
}
`);
    const c111 = issues.filter(i => i.check === 'C111');
    assert.deepEqual(
      c111.map(i => i.severity),
      ['warning'],
    );
    assert.match(c111[0].message, /values_of "outcomes"/);
    // The open domain: C3 stays silent on the value.
    assert.deepEqual(
      issues.filter(i => i.check === 'C3' && i.severity === 'error'),
      [],
    );
  });

  it('a top-level id colliding with an inline dimension is an error', () => {
    const issues = only111(
      check(`
instrument Meter {
  dimension mode { values { x } }
}
dimension mode {
  values { y }
}
`),
    );
    assert.equal(issues.filter(i => i.severity === 'error').length, 1);
    assert.match(issues[0].message, /declared both top-level and inline/);
  });

  it('two instruments declaring one dimension id are an error', () => {
    const issues = only111(
      check(`
instrument MeterA {
  dimension mode { values { x } }
}
instrument MeterB {
  dimension mode { values { y } }
}
`),
    );
    assert.equal(issues.filter(i => i.severity === 'error').length, 1);
    assert.match(issues[0].message, /declared inline on both/);
  });

  it('the is_dimension attribute/inline mirror of one id is one axis', () => {
    // The estate's dual-declaration pattern (R 144's power_supply): the
    // attribute carries the typed aspect and enum domain, the inline
    // block the presentation — tolerated, never a duplicate.
    const issues = only111(
      check(`
enum power_supply { ac-mains { } battery { } }
attribute_definition power_supply {
  name "Power supply"
  is_dimension true
  enum power_supply
}
instrument Meter {
  dimension power_supply { values { ac-mains battery } }
}
`),
    );
    assert.deepEqual(issues, []);
  });
});
