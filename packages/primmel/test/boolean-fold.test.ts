// ─────────────────────────────────────────────────────────────────────
// The boolean-verdict fold (TODO.lang-gaps/03; the spec's check
// primitive, language-v3 §10, and C161, §16): the five retired surface
// spellings materialize a `Check` into the checks collection at parse.
// The fold module (ser-des/config/check-fold.ts) is the one derivation
// the parsers and the C161 completeness walk share.
//
//   1. form pass_fail                       → form:<fid>:pass_fail      (REFUSES at parse)
//   2. conformance_test acceptance_criteria → conformance_test:<tid>:acceptance_criteria[:<criterion-id>]  (the pass_if facets REFUSE)
//   3. requirement acceptance_criteria (raw)→ requirement:<rid>:acceptance_criteria
//   4. requirement limit                    → requirement:<rid>:limit:<n>
//   5. validate_measurement (process + test)→ <kind>:<id>:validate_measurement:<n>
//
// Spellings 1 and 2's pass_if retired in the wave's second PR: the
// surface refuses at parse and the corpus declares the canonical check
// (form:<fid>:pass_fail) instead; spellings 3–5 keep parsing until
// their own migration. The fold derivation stays total over Standards
// built by hand or by an older parser (the C161 walk's subject).
//
// The serialization pin: a folded check is the parse-side view of its
// owner — the serializer emits the canonical form only, so dump(load(x))
// stays byte-identical for documents spelling the verdict the retired
// (still-parsing) way.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';
import {
  foldIdentifierInputs,
  formFoldChecks,
  conformanceTestFoldChecks,
} from '../src/ser-des/config/check-fold';
import type Form from '../src/types/Form';
import type ConformanceTest from '../src/types/ConformanceTest';
import type { AcceptanceCriterion } from '../src/types/ConformanceTest';

function folded(model: string) {
  const standard = load(model);
  return Object.fromEntries(
    standard.checks.filter(c => c.folds).map(c => [c.id, c]),
  );
}

function refused(model: string, match: RegExp): Error {
  try {
    load(model);
  } catch (e) {
    assert.match((e as Error).message, match);
    return e as Error;
  }
  throw new Error('the spelling parsed — the refusal never fired');
}

describe('spelling 1 — the form pass_fail refuses at parse', () => {
  it('the retired block refuses, naming the canonical check', () => {
    const err = refused(
      `
      form temperature_test {
        name "Temperature test"
        pass_fail {
          criteria { The reading shall remain within the MPE. }
          pass_if "ocl{within_mpe}"
        }
      }
    `,
      /the pass_fail block is retired.*form:temperature_test:pass_fail/s,
    );
    assert.match(err.message, /TODO\.lang-gaps\/03/);
  });

  it('the fold derivation survives for Standards built by hand or by an older parser', () => {
    const form: Pick<Form, 'id' | 'passFail'> = {
      id: 'temperature_test',
      passFail: {
        criteria: 'The reading shall remain within the MPE.',
        passIf: 'ocl{within_mpe}',
        derivations: [],
      },
    };
    const [c] = formFoldChecks(form);
    assert.ok(c, 'the folded check is present');
    assert.equal(c.expression, 'ocl{within_mpe}');
    assert.deepEqual(c.inputs, ['within_mpe']);
    assert.deepEqual(c.folds, {
      owner: 'form:temperature_test',
      facet: 'pass_fail',
    });
    assert.deepEqual(c.source, { doc: 'form:temperature_test', clause: '' });
    assert.equal(c.operator, '');
    assert.equal(c.threshold, '');
  });

  it('the derivation calculations ride the inputs', () => {
    const [c] = formFoldChecks({
      id: 'variation_test',
      passFail: {
        criteria: 'The variation stays within the limit.',
        passIf: 'ocl{variation_within_limit}',
        derivations: [
          {
            name: 'variation',
            calculation: 'variation_calc',
            forEach: 'reading',
            unit: 'v',
          },
        ],
      },
    });
    assert.ok(c);
    assert.deepEqual(c.inputs, ['variation_within_limit', 'variation_calc']);
  });

  it('a form without pass_fail folds nothing', () => {
    assert.deepEqual(
      Object.keys(
        folded(`
          form plain { name "Plain" }
        `),
      ),
      [],
    );
  });
});

describe('spelling 2 — the acceptance_criteria pass_if refuses at parse', () => {
  it('the block-level composite pass_if refuses, naming the bare slot', () => {
    refused(
      `
      conformance_test /conf/type-evaluation/zero-setting {
        name "Zero-setting test"
        acceptance_criteria {
          type composite
          pass_if "ocl{zero_accuracy <= 0.25 and zero_range <= 4}"
        }
      }
    `,
      /the pass_if facet is retired.*conformance_test:\/conf\/type-evaluation\/zero-setting:acceptance_criteria \{/s,
    );
  });

  it('the criterion pass_if refuses, naming the criterion slot', () => {
    refused(
      `
      conformance_test /conf/disturbances {
        name "Disturbance test"
        acceptance_criteria {
          criterion no_significant_fault_during {
            target /req/metrological/disturbances
            pass_if "ocl{abs(fault) <= fault_limit or fault_detected}"
            criterion D/NSFd
          }
        }
      }
    `,
      /the pass_if facet is retired.*acceptance_criteria:no_significant_fault_during \{/s,
    );
  });

  it('the fold derivation survives for Standards built by hand or by an older parser', () => {
    const criterion: AcceptanceCriterion = {
      item: 'no_significant_fault_during',
      passIf: 'ocl{abs(fault) <= fault_limit or fault_detected}',
      requirementId: '/req/metrological/disturbances',
      criterion: '',
      optional: false,
      description: '',
      reference: '',
      sourceDiscrepancy: null,
    };
    const ct: Pick<
      ConformanceTest,
      'id' | 'acceptancePassIf' | 'acceptanceCriteria' | 'measurements'
    > = {
      id: '/conf/disturbances',
      acceptancePassIf: 'ocl{composite_held}',
      acceptanceCriteria: [criterion],
      measurements: [],
    };
    const checks = conformanceTestFoldChecks(ct);
    assert.deepEqual(
      checks.map(c => c.id),
      [
        'conformance_test:/conf/disturbances:acceptance_criteria',
        'conformance_test:/conf/disturbances:acceptance_criteria:no_significant_fault_during',
      ],
    );
    // the pass_if names first, then the target ref
    assert.deepEqual(checks[1]!.inputs, [
      'fault',
      'fault_limit',
      'fault_detected',
      '/req/metrological/disturbances',
    ]);
  });

  it('documentary criteria (no pass_if) still parse and fold nothing', () => {
    const checks = folded(`
      conformance_test /conf/docs {
        name "Documentation test"
        acceptance_criteria {
          criterion docs_only {
            description "The manual documents the procedure."
            reference "urn:example:doc"
          }
        }
      }
    `);
    assert.deepEqual(Object.keys(checks), []);
  });
});

describe('spelling 3 — the raw requirement acceptance_criteria folds', () => {
  it('a threshold block folds the limit triple', () => {
    const checks = folded(`
      requirement /req/severity {
        name "Declared severity"
        acceptance_criteria {
          type: "threshold"
          description: "The severity level is declared before the test"
          limit:
            expression: "L_sev"
            operator: "eq"
            threshold_expression: "true"
        }
      }
    `);
    const c = checks['requirement:/req/severity:acceptance_criteria'];
    assert.ok(c, 'the folded check is present');
    assert.equal(c.expression, 'L_sev');
    assert.equal(c.operator, 'eq');
    assert.equal(c.threshold, 'true');
    assert.deepEqual(c.inputs, ['L_sev']);
  });

  it('a raw pass_if folds the predicate', () => {
    const checks = folded(`
      requirement /req/watched {
        name "Watched"
        acceptance_criteria {
          pass_if: "ocl{guard_held}"
        }
      }
    `);
    const c = checks['requirement:/req/watched:acceptance_criteria'];
    assert.ok(c);
    assert.equal(c.expression, 'ocl{guard_held}');
    assert.deepEqual(c.inputs, ['guard_held']);
  });

  it('a qualitative block (typed prose items) states no verdict and folds nothing', () => {
    const checks = folded(`
      requirement /req/qualitative {
        name "Qualitative"
        acceptance_criteria {
          type: "qualitative"
          items:
            - description: "The generator carries provision against the emission"
            - description: "The dip characteristics are at least as severe"
        }
      }
    `);
    assert.deepEqual(Object.keys(checks), []);
  });
});

describe('spelling 4 — the requirement limits fold', () => {
  it('the single unnamed limit is slot 1, uses ride the inputs, accepts is the sugar', () => {
    const checks = folded(`
      requirement /req/metrological/mpe {
        name "MPE"
        limit {
          expression "ocl{abs(e) <= mpe}"
          uses { e mpe }
          accepts { verdict mdlo_normalized op lte limit "ocl{mpe}" }
        }
      }
    `);
    const c = checks['requirement:/req/metrological/mpe:limit:1'];
    assert.ok(c, 'the folded check is present');
    assert.equal(c.expression, 'ocl{abs(e) <= mpe}');
    assert.deepEqual(c.inputs, ['e', 'mpe']);
    assert.equal(c.operator, 'lte');
    assert.equal(c.threshold, 'ocl{mpe}');
    assert.deepEqual(c.folds, {
      owner: 'requirement:/req/metrological/mpe',
      facet: 'limit:1',
    });
  });

  it('multiple limits enumerate deterministically', () => {
    const checks = folded(`
      requirement /req/ranges {
        name "Ranges"
        limit "mpe-low-range" {
          expression "ocl{e <= mu_low}"
          uses { e mu_low }
        }
        limit "mpe-high-range" {
          expression "ocl{e >= mu_high}"
          uses { e mu_high }
        }
      }
    `);
    assert.deepEqual(Object.keys(checks), [
      'requirement:/req/ranges:limit:1',
      'requirement:/req/ranges:limit:2',
    ]);
    assert.equal(
      checks['requirement:/req/ranges:limit:2'].expression,
      'ocl{e >= mu_high}',
    );
    assert.deepEqual(checks['requirement:/req/ranges:limit:2'].inputs, [
      'e',
      'mu_high',
    ]);
  });

  it('a requirement without limit or acceptance_criteria folds nothing', () => {
    assert.deepEqual(
      Object.keys(
        folded(`
          requirement /req/bare {
            name "Bare"
          }
        `),
      ),
      [],
    );
  });
});

describe('spelling 5 — the validate_measurement strings fold', () => {
  it('a process measurement folds verbatim with its bracket-list names', () => {
    const checks = folded(`
      process verdict_computation {
        name "Verdict computation"
        validate_measurement { "every([within_mpe]) = true" }
      }
    `);
    const c = checks['process:verdict_computation:validate_measurement:1'];
    assert.ok(c, 'the folded check is present');
    assert.equal(c.expression, 'every([within_mpe]) = true');
    assert.deepEqual(c.inputs, ['within_mpe']);
    assert.deepEqual(c.folds, {
      owner: 'process:verdict_computation',
      facet: 'validate_measurement:1',
    });
  });

  it('a conformance-test measurement folds under the conformance_test owner', () => {
    const checks = folded(`
      conformance_test /conf/coverage {
        name "Coverage"
        validate_measurement { "[test_report_checklist_coverage] >= 1.0" }
      }
    `);
    const c = checks['conformance_test:/conf/coverage:validate_measurement:1'];
    assert.ok(c, 'the folded check is present');
    assert.equal(c.expression, '[test_report_checklist_coverage] >= 1.0');
    assert.deepEqual(c.inputs, ['test_report_checklist_coverage']);
  });

  it('repeated measurements enumerate', () => {
    const checks = folded(`
      process audit {
        name "Audit"
        validate_measurement {
          "every([finding_classified]) = true"
          "[completed_forms].count = [required_forms].count"
        }
      }
    `);
    assert.deepEqual(Object.keys(checks), [
      'process:audit:validate_measurement:1',
      'process:audit:validate_measurement:2',
    ]);
    assert.deepEqual(
      checks['process:audit:validate_measurement:2'].inputs,
      // `count` is the built-in, filtered — the two store names remain
      ['completed_forms', 'required_forms'],
    );
  });
});

describe('the fold identifiers (foldIdentifierInputs)', () => {
  it('the OCL dialect parses; the ocl{} sigil is scan-through only', () => {
    assert.deepEqual(foldIdentifierInputs('ocl{within_mpe}'), ['within_mpe']);
    assert.deepEqual(
      foldIdentifierInputs('repeatability_series->forAll(s | s.within_limit)'),
      ['repeatability_series'],
    );
    assert.deepEqual(
      foldIdentifierInputs('abs(fault) <= fault_limit or fault_detected'),
      ['fault', 'fault_limit', 'fault_detected'],
    );
  });

  it('outside the dialect the word scan reads the measurement idiom', () => {
    assert.deepEqual(foldIdentifierInputs('every([within_mpe]) = true'), [
      'within_mpe',
    ]);
    assert.deepEqual(foldIdentifierInputs('[a] + [b] = [a]'), ['a', 'b']);
  });

  it('duplicates and keywords never ride the inputs', () => {
    assert.deepEqual(foldIdentifierInputs('x and x or true'), ['x']);
  });
});

describe('the serialization pin (C161 — the fold never serializes)', () => {
  // The three still-parsing spellings in one document. The pre-change
  // dump of this text is the text's canonical form with NO checks
  // collection; the fold is parse-side, so dump(load(x)) must stay
  // byte-identical to that — the folded checks are the view, never the
  // wire. (The pass_fail and pass_if spellings refuse at parse since
  // their retirement — the refusals pin above.)
  const FIXTURE = `
conformance_test /conf/type-evaluation/zero-setting {
  name "Zero-setting test"
  acceptance_criteria {
    type composite
  }
  validate_measurement { "[checklist_coverage] >= 1.0" }
}

requirement /req/metrological/mpe {
  name "MPE"
  limit {
    expression "ocl{abs(e) <= mpe}"
    uses { e mpe }
    accepts { verdict mdlo_normalized op lte limit "ocl{mpe}" }
  }
  acceptance_criteria {
    type: "threshold"
    limit:
      expression: "L_sev"
      operator: "eq"
      threshold_expression: "true"
  }
}

process verdict_computation {
  name "Verdict computation"
  validate_measurement { "every([within_mpe]) = true" }
}
`;

  it('the fixture carries the remaining spellings and folds all of them', () => {
    const ids = Object.keys(folded(FIXTURE));
    assert.deepEqual(ids, [
      'conformance_test:/conf/type-evaluation/zero-setting:validate_measurement:1',
      'requirement:/req/metrological/mpe:limit:1',
      'requirement:/req/metrological/mpe:acceptance_criteria',
      'process:verdict_computation:validate_measurement:1',
    ]);
  });

  it('dump(load(x)) is byte-identical to the pre-change dump (no check blocks)', () => {
    const once = dump(load(FIXTURE));
    assert.equal(once.includes('check '), false, 'no canonical check emitted');
    // and the fixpoint holds: re-loading the dump re-folds identically
    assert.equal(dump(load(once)), once);
  });

  it('a declared canonical check still serializes; the folds stay view-only', () => {
    const model = `
check hot {
  inputs { reading }
  expression "ocl{reading > 5}"
  operator >
  threshold 100
}
datum reading : number { label "Reading" }
`;
    const once = dump(load(model));
    assert.match(once, /check hot \{/);
    assert.equal(dump(load(once)), once);
    const standard = load(model);
    assert.equal(standard.checks.length, 1);
    assert.equal(standard.checks[0]!.folds, undefined);
  });

  it('the canonical check carries the migrated verdict: source ref + quarantined prose', () => {
    // The migration shape (TODO.lang-gaps/03): the retired spelling's
    // predicate is the check's expression, the criteria prose lands in
    // the quarantined description block, and the owner is cited by the
    // derives-from ref (the anchor folds into the Check's source).
    const model = `
check form:span_stability:pass_fail {
  expression "ocl{measurements->forAll(m | m.within_limit)}"
  description { Span variation between any two measurements must not exceed max(0.5 v_min, 0.5 * |MPE|). }
  ref derives-from "form:span_stability"
}
`;
    const once = dump(load(model));
    assert.match(once, /ref derives-from "form:span_stability"/);
    assert.match(once, /description \{ Span variation/);
    assert.equal(dump(load(once)), once);
    const c = load(model).checks[0]!;
    assert.deepEqual(c.source, { doc: 'form:span_stability', clause: '' });
    assert.match(c.description!, /0\.5 v_min/);
  });
});
