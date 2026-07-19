import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

// Run-validity preconditions on conformance tests (data/schemas/cc.yaml):
// a violation VOIDS the run — verdict outcome 'invalid', never a fail.

const SRC = `conformance_test CreepTest {
  name "Creep test"
  type Testing
  reference { doc "urn:oiml:pub:r:60-2:2021" clause "2.7.3" }
  preconditions {
    precondition temperature-stability {
      check "ocl{temperature_variation <= min(2, 0.2 * (family.parameters.t_max - family.parameters.t_min))}"
      description "Ambient temperature stability (R 60-2, 2.7.3.1): a run recorded under unstable temperature is INVALID, not a fail."
    }
    precondition count-sufficient {
      check "ocl{measurement_count >= 100}"
      description "Minimum valid measurements (R 91-2, 4.4)"
      on_violation invalid
    }
  }
  acceptance_criteria {
    criterion creep_30min_criterion { pass_if "ocl{abs(c_c) <= 0.7 * abs(mpe_at_dmax)}" }
  }
}
`;

describe('conformance_test preconditions', () => {
  it('parses preconditions with check, description, and outcome', () => {
    const m = load(SRC);
    const ct = m.conformanceTests.find(t => t.id === 'CreepTest')!;
    assert.equal(ct.preconditions.length, 2);

    const p0 = ct.preconditions[0];
    assert.equal(p0.id, 'temperature-stability');
    assert.equal(
      p0.check,
      'ocl{temperature_variation <= min(2, 0.2 * (family.parameters.t_max - family.parameters.t_min))}',
    );
    assert.match(p0.description, /2\.7\.3\.1/);
    // Violation voids the run — the default outcome is 'invalid'.
    assert.equal(p0.onViolation, 'invalid');

    const p1 = ct.preconditions[1];
    assert.equal(p1.id, 'count-sufficient');
    assert.equal(p1.check, 'ocl{measurement_count >= 100}');
    assert.equal(p1.onViolation, 'invalid');
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('preconditions {'));
    assert.ok(dumped.includes('precondition temperature-stability {'));
    assert.ok(dumped.includes('on_violation invalid'));

    const m2 = load(dumped);
    assert.deepEqual(m2.conformanceTests, m1.conformanceTests);
    assert.equal(dump(m2), dumped);
  });

  it('defaults on_violation to invalid when omitted', () => {
    const m = load(`conformance_test T {
      preconditions {
        precondition p { check "ocl{x > 0}" }
      }
    }`);
    const p = m.conformanceTests[0].preconditions[0];
    assert.equal(p.id, 'p');
    assert.equal(p.check, 'ocl{x > 0}');
    assert.equal(p.description, '');
    assert.equal(p.onViolation, 'invalid');
  });

  it('keeps tests without preconditions unchanged', () => {
    const m = load(`conformance_test T {
      name "Plain"
      type Testing
    }`);
    assert.deepEqual(m.conformanceTests[0].preconditions, []);
    const m2 = load(dump(m));
    assert.deepEqual(m2.conformanceTests, m.conformanceTests);
  });
});
