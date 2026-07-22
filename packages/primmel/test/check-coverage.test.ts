// ─────────────────────────────────────────────────────────────────────
// TODO.roadmap/17 — the coverage audit rules (check.ts):
//   C5  req-test-coverage (refined: deliberate exclusions are covered)
//   C51 coverage-test-evidence (audit)
//   C52 coverage-form-judgment (audit)
//   C53 coverage-uses-bound
//   C54 coverage-lookup-table-exists
// The budget rule C55 lives with the allowlist tests
// (check-allowlist.test.ts).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkPackage, type CheckOptions } from '../src/check';

function makeTmpPackage(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-cov-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

const checked = (
  files: Record<string, string>,
  options: CheckOptions = {},
): ReturnType<typeof checkPackage> => {
  const dir = makeTmpPackage(files);
  try {
    return checkPackage(dir, options);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const DEFS = `instrument T {
  dimension accuracy_class { scope group values { A B } }
}
attribute_definition e_max {
  symbol "E_max" origin design-fixed scope model unit t quantity_kind mass
}
behavior measure { kind measurement }
symbol speed_error { kind observable quantity_kind speed unit "km/h" }
calculation lookupMPE {
  name "lookupMPE"
  rule_type lookup
  params { reference_speed metrological_class multiplier }
  lookup { key metrological_class variable reference_speed multiplier multiplier }
  profile "profiles.mpe_tiers"
}
table profiles {
  profiles {
    profile mpe_tiers {
      dimension accuracy_class
      binding {
        A: [{ min: 0 max: 100 factor: 1 }]
        B: [{ min: 0 max: 50 factor: 1 }]
      }
    }
  }
}
table measurement_counts {
  columns "context, n"
  data { "field" "500" }
}
`;

const REQ_TEST = `requirement /req/mpe {
  binds_to { model.parameters.e_max }
  limit {
    expression "ocl{abs(speed_error) <= lookupMPE(reference_speed, metrological_class, 1.0)}"
    uses { speed_error accuracy_class formula:lookupMPE table:measurement_counts model.behaviors.measure }
  }
  verification { method testing description "field test" }
}
conformance_test /conf/t {
  targets { /req/mpe }
}
form F {
  name "F"
  conformance_process /conf/t
  pass_fail { criteria "within MPE" pass_if "ocl{within_mpe}" }
}
`;

describe('C5 req-test-coverage — refined deliberate exclusions', () => {
  it('silent when a test targets the requirement', () => {
    const c5 = checked({
      'model/a.prl': DEFS,
      'specification/r.prl': REQ_TEST,
    }).filter(i => i.check === 'C5');
    assert.deepEqual(c5, []);
  });

  it('warns on a testing-method requirement with no targeting test', () => {
    const c5 = checked({
      'model/a.prl': DEFS,
      'specification/r.prl': `requirement /req/orphan {
  binds_to { model.parameters.e_max }
  verification { method testing description "needs a test" }
}`,
    }).filter(i => i.check === 'C5');
    assert.equal(c5.length, 1);
    assert.equal(c5[0].severity, 'warning');
    assert.ok(c5[0].message.includes('/req/orphan'));
    assert.ok(c5[0].message.includes('no non-test verification'));
  });

  it('silent on a definitional-method requirement with no test (recorded, not a gap)', () => {
    const c5 = checked({
      'model/a.prl': DEFS,
      'specification/r.prl': `requirement /req/def {
  binds_to { model.parameters.e_max }
  verification { method definitional description "verified by review" }
}`,
    }).filter(i => i.check === 'C5');
    assert.deepEqual(c5, []);
  });

  it('silent on a requirement a process validate_provisions', () => {
    const c5 = checked({
      'model/a.prl': DEFS,
      'specification/r.prl': `requirement /req/cs/fee {
  statement "The fee estimate is reviewed."
  verification { method inspection description "IA review" }
}
process review_application {
  actor issuing_authority
  validate_provision { /req/cs/fee }
  output { applications }
}`,
    }).filter(i => i.check === 'C5');
    assert.deepEqual(c5, []);
  });
});

describe('C51 coverage-test-evidence (audit)', () => {
  const NO_FORM = `requirement /req/mpe {
  binds_to { model.parameters.e_max }
  verification { method testing description "t" }
}
conformance_test /conf/t {
  targets { /req/mpe }
}
`;

  it('silent at the default level (audit-only rule)', () => {
    const c51 = checked({
      'model/a.prl': DEFS,
      'specification/r.prl': NO_FORM,
    }).filter(i => i.check === 'C51');
    assert.deepEqual(c51, []);
  });

  it('warns at audit strictness when no form records the test', () => {
    const c51 = checked(
      { 'model/a.prl': DEFS, 'specification/r.prl': NO_FORM },
      { strictness: 'audit' },
    ).filter(i => i.check === 'C51');
    assert.equal(c51.length, 1);
    assert.equal(c51[0].severity, 'warning');
    assert.ok(c51[0].message.includes('/conf/t'));
  });

  it('silent when a form declares the test via conformance_process', () => {
    const c51 = checked(
      { 'model/a.prl': DEFS, 'specification/r.prl': REQ_TEST },
      { strictness: 'audit' },
    ).filter(i => i.check === 'C51');
    assert.deepEqual(c51, []);
  });

  it('silent when a form covers a requirement the test targets', () => {
    const c51 = checked(
      {
        'model/a.prl': DEFS,
        'specification/r.prl': NO_FORM,
        'execution/f.prl': `form R {
  name "R"
  requirements { /req/mpe }
}`,
      },
      { strictness: 'audit' },
    ).filter(i => i.check === 'C51');
    assert.deepEqual(c51, []);
  });

  it('inherits the evidence link over inherits_from', () => {
    const c51 = checked(
      {
        'model/a.prl': DEFS,
        'specification/r.prl': `${REQ_TEST}
conformance_test /conf/t-class-a {
  inherits_from /conf/t
  test_subject { accuracy_class: "A" }
}`,
      },
      { strictness: 'audit' },
    ).filter(i => i.check === 'C51');
    assert.deepEqual(c51, []);
  });

  it('silent when the test names result_forms', () => {
    const c51 = checked(
      {
        'model/a.prl': DEFS,
        'specification/r.prl': `requirement /req/mpe {
  binds_to { model.parameters.e_max }
  verification { method testing description "t" }
}
conformance_test /conf/t {
  targets { /req/mpe }
  result_forms { evidence-file }
}`,
      },
      { strictness: 'audit' },
    ).filter(i => i.check === 'C51');
    assert.deepEqual(c51, []);
  });
});

describe('C52 coverage-form-judgment (audit)', () => {
  const BINDING_NO_JUDGMENT = `requirement /req/mpe {
  binds_to { model.parameters.e_max }
  verification { method testing description "t" }
}
conformance_test /conf/t {
  targets { /req/mpe }
}
form F {
  name "F"
  conformance_process /conf/t
  field x { type string }
}
`;

  it('warns on a test-evidence form with no judgment', () => {
    const c52 = checked(
      { 'model/a.prl': DEFS, 'specification/r.prl': BINDING_NO_JUDGMENT },
      { strictness: 'audit' },
    ).filter(i => i.check === 'C52');
    assert.equal(c52.length, 1);
    assert.equal(c52[0].severity, 'warning');
    assert.ok(c52[0].message.includes('form F'));
  });

  it('silent when the binding form has pass_fail', () => {
    const c52 = checked(
      { 'model/a.prl': DEFS, 'specification/r.prl': REQ_TEST },
      { strictness: 'audit' },
    ).filter(i => i.check === 'C52');
    assert.deepEqual(c52, []);
  });

  it('silent when the binding form declares requirements', () => {
    const c52 = checked(
      {
        'model/a.prl': DEFS,
        'specification/r.prl': `requirement /req/mpe {
  binds_to { model.parameters.e_max }
  verification { method testing description "t" }
}
conformance_test /conf/t {
  targets { /req/mpe }
}
form F {
  name "F"
  conformance_process /conf/t
  requirements { /req/mpe }
}`,
      },
      { strictness: 'audit' },
    ).filter(i => i.check === 'C52');
    assert.deepEqual(c52, []);
  });

  it('documentary forms (no test binding) never fire', () => {
    const c52 = checked(
      {
        'model/a.prl': DEFS,
        'specification/r.prl': REQ_TEST,
        'execution/f.prl': `form Doc {
  name "Doc"
  field x { type string }
}`,
      },
      { strictness: 'audit' },
    ).filter(i => i.check === 'C52');
    assert.deepEqual(c52, []);
  });
});

describe('C53 coverage-uses-bound', () => {
  const reqWithUses = (uses: string) => `requirement /req/r {
  binds_to { model.parameters.e_max }
  limit {
    expression "ocl{e_max <= 40}"
    uses { ${uses} }
  }
  verification { method testing description "t" }
}
conformance_test /conf/t { targets { /req/r } }
`;

  it('errors on an unbound bare use input', () => {
    const c53 = checked({
      'model/a.prl': DEFS,
      'specification/r.prl': reqWithUses('e_max bogus_attr'),
    }).filter(i => i.check === 'C53');
    assert.equal(c53.length, 1);
    assert.equal(c53[0].severity, 'error');
    assert.ok(c53[0].message.includes('bogus_attr'));
  });

  it('silent for attributes, dimensions, behaviors, symbols, and formulas', () => {
    const c53 = checked({
      'model/a.prl': DEFS,
      'specification/r.prl': reqWithUses(
        'e_max accuracy_class model.behaviors.measure observable:speed_error formula:lookupMPE',
      ),
    }).filter(i => i.check === 'C53');
    assert.deepEqual(c53, []);
  });

  it('errors on a dangling observable:/formula: prefix', () => {
    const c53 = checked({
      'model/a.prl': DEFS,
      'specification/r.prl': reqWithUses(
        'observable:bogus_obs formula:bogus_calc',
      ),
    }).filter(i => i.check === 'C53');
    assert.equal(c53.length, 2);
    assert.ok(c53.every(i => i.severity === 'error'));
  });
});

describe('C54 coverage-lookup-table-exists', () => {
  const reqWithUses = (uses: string) => `requirement /req/r {
  binds_to { model.parameters.e_max }
  limit {
    expression "ocl{e_max <= lookupMPE(load, accuracy_class, 1.0)}"
    uses { ${uses} }
  }
  verification { method testing description "t" }
}
conformance_test /conf/t { targets { /req/r } }
`;

  it('silent when table:/profile: targets resolve', () => {
    const c54 = checked({
      'model/a.prl': DEFS,
      'specification/r.prl': reqWithUses(
        'table:measurement_counts profile:mpe_tiers profile:profiles.mpe_tiers',
      ),
    }).filter(i => i.check === 'C54');
    assert.deepEqual(c54, []);
  });

  it('errors on a dangling table: prefix', () => {
    const c54 = checked({
      'model/a.prl': DEFS,
      'specification/r.prl': reqWithUses('table:bogus_table'),
    }).filter(i => i.check === 'C54');
    assert.equal(c54.length, 1);
    assert.equal(c54[0].severity, 'error');
    assert.ok(c54[0].message.includes('bogus_table'));
  });

  it('errors on a dangling profile: prefix', () => {
    const c54 = checked({
      'model/a.prl': DEFS,
      'specification/r.prl': reqWithUses('profile:bogus_profile'),
    }).filter(i => i.check === 'C54');
    assert.equal(c54.length, 1);
    assert.ok(c54[0].message.includes('bogus_profile'));
  });

  it('errors on a calculation lookup profile that resolves nowhere', () => {
    const c54 = checked({
      'model/a.prl': DEFS,
      'specification/r.prl': `calculation lookupBroken {
  name "lookupBroken"
  rule_type lookup
  lookup { key accuracy_class }
  profile "profiles.no_such_profile"
}
${reqWithUses('e_max')}`,
    }).filter(i => i.check === 'C54');
    assert.equal(c54.length, 1);
    assert.ok(c54[0].message.includes('no_such_profile'));
  });
});
