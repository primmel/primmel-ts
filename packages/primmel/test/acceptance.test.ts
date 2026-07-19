import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

// Shared acceptance decision block ($defs/acceptanceDecision of
// data/schemas/{rc,cc,verdicts}.yaml, TODO.refactor/10): decision rule,
// guard band, uncertainty budget, verdict criterion, and the
// statistical-justification variant. Attachable to requirement limits,
// conformance tests, and verdicts.

const ACCEPTANCE = `acceptance {
    rule guarded
    guard_band { kind NSFa value 0.5 }
    uncertainty { max_ratio_to_mpe 0.333 }
    criterion D/NSFa
    statistics { method error_distribution on_basis_of errors permits count_override }
  }`;

function assertAcceptance(a: any) {
  assert.ok(a);
  assert.equal(a.rule, 'guarded');
  assert.deepEqual(a.guardBand, { kind: 'NSFa', value: 0.5 });
  assert.deepEqual(a.uncertainty, { maxRatioToMpe: 0.333 });
  assert.equal(a.criterion, 'D/NSFa');
  assert.deepEqual(a.statistics, {
    method: 'error_distribution',
    onBasisOf: 'errors',
    permits: 'count_override',
  });
}

const SRC = `requirement /req/metrological/mpe {
  name "Maximum permissible error"
  limit {
    expression "ocl{abs(e_l) <= mpe}"
    uses { e_l mpe }
    ${ACCEPTANCE}
  }
}

conformance_test DisturbanceTest {
  name "Disturbance test"
  type Testing
  ${ACCEPTANCE}
}

verdict drift_error {
  quantity { kind volume-fraction unit "ppm" }
  derive "ocl{indication - cgm_certified_value}"
  inputs { indication cgm_certified_value }
  ${ACCEPTANCE}
  source { doc "urn:oiml:pub:r:144-2:2013" clause "4.8" }
}
`;

describe('acceptance decision block', () => {
  it('parses on a requirement limit', () => {
    const m = load(SRC);
    assertAcceptance(m.requirements[0].limit?.acceptance);
  });

  it('parses on a conformance test body', () => {
    const m = load(SRC);
    assertAcceptance(m.conformanceTests[0].acceptance);
  });

  it('parses on a verdict body', () => {
    const m = load(SRC);
    assertAcceptance(m.verdicts[0].acceptance);
  });

  it('parses a minimal acceptance (rule only)', () => {
    const m = load(`conformance_test T {
      acceptance { rule shared_risk }
    }`);
    const a = m.conformanceTests[0].acceptance!;
    assert.equal(a.rule, 'shared_risk');
    assert.equal(a.guardBand, null);
    assert.equal(a.uncertainty, null);
    assert.equal(a.criterion, '');
    assert.equal(a.statistics, null);
    const m2 = load(dump(m));
    assert.deepEqual(m2.conformanceTests, m.conformanceTests);
  });

  it('rejects an unknown rule, guard kind, and criterion', () => {
    assert.throws(
      () => load('conformance_test T { acceptance { rule rigged } }'),
      /Unknown rule rigged/,
    );
    assert.throws(
      () =>
        load(
          'conformance_test T { acceptance { guard_band { kind fuzzy value 1 } } }',
        ),
      /Unknown guard_band kind fuzzy/,
    );
    assert.throws(
      () => load('conformance_test T { acceptance { criterion X/Y } }'),
      /Unknown criterion X\/Y/,
    );
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('acceptance {'));
    assert.ok(dumped.includes('guard_band { kind NSFa value 0.5 }'));
    assert.ok(dumped.includes('criterion D/NSFa'));

    const m2 = load(dumped);
    assert.deepEqual(m2.requirements, m1.requirements);
    assert.deepEqual(m2.conformanceTests, m1.conformanceTests);
    assert.deepEqual(m2.verdicts, m1.verdicts);
    assert.equal(dump(m2), dumped);
  });
});
