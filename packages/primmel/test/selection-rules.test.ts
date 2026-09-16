// ─────────────────────────────────────────────────────────────────────
// The selection-rule constructs (smart TODO.roadmap/40 batch 3) —
// lab_selection_criterion, sample_selection_rule, and
// specimen_governance_rule: the parse legs (incl. the digit-leading
// id hazard), the parse-enforced vocabularies, the codec fixpoints,
// and C139 (the model_field resolutions gated, the
// operator-conditional match facets, the sample/governance shape
// legs).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const LAB_CRITERIA = `
lab_selection_criterion humidity-testing {
  weight required
  parameter_type dimension
  label "Humidity testing capability"
  description "CH and SH load cells require humidity testing."
  applies_when { model_field humidity_symbol in { CH SH } }
  match {
    operator has_capability
    required_capability "humidity-testing"
  }
}
lab_selection_criterion emax-range {
  weight required
  parameter_type parameter
  label "Emax range capability"
  applies_when { model_field e_max not_null true }
  match {
    operator capability_covers_value
    required_capability_prefix "emax-up-to-"
    model_field e_max
  }
}
lab_selection_criterion any-lab {
  weight preferred
  match { operator always_pass }
}
`;

const SAMPLE_RULES = `
sample_selection_rule D.2.6-partial-evaluation-flags {
  step "D.2.6"
  rule "If a non-selected load cell of the same capacity has lower v_min or higher y than the selected one, flag for partial evaluation."
  rationale "R 60-2 §2.4.6 — cross-group characteristic coverage"
  applicability "selected.length > 0"
  selector "WHERE same_e_max(non_selected, selected)"
  test_kind partial_evaluation
  additional_tests { temperature_mdlo "Triggered by lower v_min or higher y" creep_dr "Triggered by higher y only" }
}
sample_selection_rule 7.1.2-definitive-type-per-model {
  step "7.1.2"
  rule "The definitive type is tested per model."
  rationale "R 129, 7.1.2"
  applicability "always"
  test_kind full_evaluation
  single_sample true
}
`;

const GOVERNANCE = `
specimen_governance_rule unit-continuity {
  rule "A sample's identity is continuous across the test runs."
  rationale "R 60-2, 2.4"
  applicability "always"
  constraint "test_runs.group_by(test_kind).all { |g| g.sample_id.unique() }"
  post "Violations invalidate the affected runs."
}
`;

const REGISTERS = `
attribute_definition e_max {
  name "Maximum capacity"
  value_type QuantityValue
  is_dimension false
}
dimension humidity_symbol {
  cardinality single
  values {
    NH { label "No humidity" }
    CH { label "Cyclic humidity" }
    SH { label "Static humidity" }
  }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-selrule-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('selection rules (smart TODO.roadmap/40 batch 3)', () => {
  it('parses the lab criteria (all three applies_when variants)', () => {
    const m = load(LAB_CRITERIA);
    assert.equal(m.labSelectionCriteria.length, 3);
    const h = m.labSelectionCriteria[0]!;
    assert.equal(h.weight, 'required');
    assert.equal(h.parameterType, 'dimension');
    assert.deepEqual(h.appliesWhen?.in, ['CH', 'SH']);
    assert.equal(h.appliesWhen?.modelField, 'humidity_symbol');
    assert.equal(h.match?.operator, 'has_capability');
    assert.equal(h.match?.requiredCapability, 'humidity-testing');
    const e = m.labSelectionCriteria[1]!;
    assert.equal(e.appliesWhen?.notNull, true);
    assert.equal(e.match?.requiredCapabilityPrefix, 'emax-up-to-');
    assert.equal(e.match?.modelField, 'e_max');
    assert.equal(m.labSelectionCriteria[2]!.match?.operator, 'always_pass');
  });

  it('parses the sample rules (the digit-leading id hazard)', () => {
    const m = load(SAMPLE_RULES);
    assert.equal(m.sampleSelectionRules.length, 2);
    const p = m.sampleSelectionRules[0]!;
    assert.equal(p.id, 'D.2.6-partial-evaluation-flags');
    assert.equal(p.step, 'D.2.6');
    assert.equal(p.testKind, 'partial_evaluation');
    assert.deepEqual(p.additionalTests, {
      temperature_mdlo: 'Triggered by lower v_min or higher y',
      creep_dr: 'Triggered by higher y only',
    });
    const d = m.sampleSelectionRules[1]!;
    assert.equal(d.id, '7.1.2-definitive-type-per-model');
    assert.equal(d.singleSample, true);
  });

  it('parses the governance rule', () => {
    const m = load(GOVERNANCE);
    const g = m.specimenGovernanceRules[0]!;
    assert.equal(g.id, 'unit-continuity');
    assert.match(g.constraint, /group_by\(test_kind\)/);
    assert.match(g.post, /invalidate/);
  });

  it('round-trips byte-clean (the codec fixpoints)', () => {
    const out = dump(load(LAB_CRITERIA + SAMPLE_RULES + GOVERNANCE));
    assert.ok(
      out.includes(
        '  applies_when { model_field humidity_symbol in { CH SH } }\n',
      ),
    );
    assert.ok(
      out.includes('  applies_when { model_field e_max not_null true }\n'),
    );
    assert.ok(
      out.includes(
        '  additional_tests { temperature_mdlo "Triggered by lower v_min or higher y" creep_dr "Triggered by higher y only" }\n',
      ),
    );
    assert.ok(
      out.includes('sample_selection_rule 7.1.2-definitive-type-per-model {\n'),
    );
    assert.equal(dump(load(out)), out);
  });

  it('rejects the unknown vocabularies at parse (the fail-closed precedent)', () => {
    assert.throws(
      () => load('lab_selection_criterion x { weight mandatory }'),
      /Unknown weight "mandatory"/,
    );
    assert.throws(
      () => load('lab_selection_criterion x { parameter_type symbolic }'),
      /Unknown parameter_type "symbolic"/,
    );
    assert.throws(
      () => load('lab_selection_criterion x { match { operator covers } }'),
      /Unknown match operator "covers"/,
    );
    assert.throws(
      () => load('sample_selection_rule x { test_kind full }'),
      /Unknown test_kind "full"/,
    );
  });

  it('C139: a coherent register set is clean', () => {
    const issues = checkPackage(
      makePackage(REGISTERS + LAB_CRITERIA + SAMPLE_RULES + GOVERNANCE),
    ).filter(i => i.check === 'C139');
    assert.deepEqual(issues, []);
  });

  it('C139: an unresolvable model_field is flagged (attribute OR dimension, gated)', () => {
    const body = `
${REGISTERS}
lab_selection_criterion x {
  weight required
  applies_when { model_field bogus_field not_null true }
  match { operator capability_from_field required_capability_prefix "x-" model_field bogus_too }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C139',
    );
    assert.equal(issues.length, 2);
    assert.match(issues[0]!.message, /applies_when model_field "bogus_field"/);
    assert.match(issues[1]!.message, /match model_field "bogus_too"/);
  });

  it('C139 gates the model_field legs — no attribute/dimension registers, no legs', () => {
    const body = `
lab_selection_criterion x {
  weight required
  applies_when { model_field bogus_field not_null true }
  match { operator capability_from_field required_capability_prefix "x-" model_field bogus_too }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C139',
    );
    assert.deepEqual(issues, []);
  });

  it('C139: the operator-conditional match facets', () => {
    const mk = (match: string) =>
      `lab_selection_criterion x { weight required match { ${match} } }`;
    const missing = checkPackage(
      makePackage(mk('operator has_capability')),
    ).filter(i => i.check === 'C139');
    assert.equal(missing.length, 1);
    assert.match(
      missing[0]!.message,
      /has_capability requires the required_capability facet/,
    );
    const prefix = checkPackage(
      makePackage(mk('operator capability_prefix_match model_field e_max')),
    ).filter(i => i.check === 'C139');
    assert.equal(prefix.length, 1);
    assert.match(
      prefix[0]!.message,
      /requires required_capability_prefix and model_field/,
    );
    const pass = checkPackage(
      makePackage(mk('operator always_pass required_capability "x"')),
    ).filter(i => i.check === 'C139');
    assert.equal(pass.length, 1);
    assert.match(pass[0]!.message, /always_pass carries no other match facet/);
  });

  it('C139: the sample/governance shape legs (rule/rationale/applicability non-empty)', () => {
    const issues = checkPackage(
      makePackage(
        'sample_selection_rule s { rule "x" } specimen_governance_rule g { rule "x" rationale "y" }',
      ),
    ).filter(i => i.check === 'C139');
    assert.equal(issues.length, 3);
    assert.match(
      issues[0]!.message,
      /sample_selection_rule s: the rationale facet is required/,
    );
    assert.match(
      issues[1]!.message,
      /sample_selection_rule s: the applicability facet is required/,
    );
    assert.match(
      issues[2]!.message,
      /specimen_governance_rule g: the applicability facet is required/,
    );
  });
});
