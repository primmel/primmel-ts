// ─────────────────────────────────────────────────────────────────────
// C84 constraint-shape (TODO.roadmap/51 — BUG.R60-SSOT gap 7): the
// kernel gate for the subject-intrinsic constraint's DECLARATION shape,
// mirroring the OIML SMART constraints.yaml schema
// (data/schemas/constraints.yaml). PRL-native packages guarded only by
// `primmel check` previously had no constraint-shape gate at all (the
// task-51 review, deviation 5). The resolution legs (OCL identifier
// resolution against the HAS inventory, source-clause bindings against
// the .prd oracle) stay smart-side as linker rule R32; duplicate
// constraint ids are the parse-time duplicate-id rule.
//
// Seeded-violation discipline: each mutant violates ONE leg and fires
// EXACTLY ONE C84 error.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPackage } from '../src/check';

const WELL_FORMED = `constraint dead_load_max_geometry {
  stereotype inv
  name "Dead-load maximum geometry"
  check "ocl{model.parameters.d_max >= 0.9 * model.parameters.e_max}"
  violation_meaning "The declared test setup does not realize the upper end of the measuring range — the type evaluation is void."
  on_violation invalid
  source { doc "urn:oiml:pub:r:60-1:2021" clause "3.6" }
}

constraint warm_up_observability {
  stereotype inv
  check "ocl{model.parameters.warm_up_time.oclIsUndefined() or model.parameters.warm_up_time >= 0}"
  violation_meaning "The declared warm-up time is not a duration — the declaration cannot be judged."
  on_violation indeterminate
}
`;

const BAD_STEREOTYPE = `constraint c1 {
  stereotype req
  check "ocl{true}"
  violation_meaning "Seeded violation."
  on_violation invalid
}
`;

const BAD_CHECK = `constraint c1 {
  stereotype inv
  check "model.parameters.d_max >= 0"
  violation_meaning "Seeded violation."
  on_violation invalid
}
`;

const NO_MEANING = `constraint c1 {
  stereotype inv
  check "ocl{true}"
  on_violation invalid
}
`;

const BAD_ON_VIOLATION = `constraint c1 {
  stereotype inv
  check "ocl{true}"
  violation_meaning "Seeded violation."
  on_violation fail
}
`;

const SOURCE_NO_CLAUSE = `constraint c1 {
  stereotype inv
  check "ocl{true}"
  violation_meaning "Seeded violation."
  on_violation invalid
  source { doc "urn:oiml:pub:r:60-1:2021" }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-c84-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'specification'));
  writeFileSync(join(dir, 'specification', 'constraints.prl'), body);
  return dir;
}

const c84 = (body: string) =>
  checkPackage(makePackage(body)).filter(i => i.check === 'C84');

describe('C84 constraint-shape', () => {
  it('accepts well-formed constraints (incl. absent name/source/on_violation default)', () => {
    assert.deepEqual(c84(WELL_FORMED), []);
    // The minimal declaration — on_violation defaults to invalid.
    assert.deepEqual(
      c84(
        'constraint bare { stereotype inv check "ocl{true}" violation_meaning "x" }',
      ),
      [],
    );
  });

  it('flags a non-inv stereotype (seeded violation — exactly one error)', () => {
    const issues = c84(BAD_STEREOTYPE);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'error');
    assert.ok(issues[0].message.includes('"req"'));
    assert.ok(issues[0].message.includes('constraint-shape'));
  });

  it('flags a check that is not one ocl{…} expression (seeded violation)', () => {
    const issues = c84(BAD_CHECK);
    assert.equal(issues.length, 1);
    assert.ok(issues[0].message.includes('ocl{…}'));
  });

  it('flags a missing violation_meaning (seeded violation)', () => {
    const issues = c84(NO_MEANING);
    assert.equal(issues.length, 1);
    assert.ok(issues[0].message.includes('violation_meaning is required'));
  });

  it('flags an on_violation outside invalid|indeterminate — never a fail (seeded violation)', () => {
    const issues = c84(BAD_ON_VIOLATION);
    assert.equal(issues.length, 1);
    assert.ok(issues[0].message.includes('"fail"'));
    assert.ok(issues[0].message.includes('never a fail'));
  });

  it('flags a source without a clause (seeded violation)', () => {
    const issues = c84(SOURCE_NO_CLAUSE);
    assert.equal(issues.length, 1);
    assert.ok(issues[0].message.includes('doc and clause'));
  });

  it('is silent when the package declares no constraints', () => {
    assert.deepEqual(c84(''), []);
  });
});
