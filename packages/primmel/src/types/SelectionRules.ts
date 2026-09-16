// ─────────────────────────────────────────────────────────────────────
// The selection rules (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — three constructs, one file (the
// schemeType.ts two-construct precedent): the laboratory-selection
// criteria (model parameter value → required lab capability), the
// sample-selection rules (the Recommendation's specimen-selection
// procedure), and the specimen-governance rules (the documentary
// cross-run invariants):
//
//   lab_selection_criterion humidity-testing {
//     weight required                     # required|preferred (parse-enforced)
//     parameter_type dimension            # dimension|parameter|operational (parse-enforced, optional)
//     label "Humidity testing capability"
//     description "…"
//     applies_when { model_field humidity_symbol in { CH SH } }   # or: equals <v> | not_null true
//     match {
//       operator has_capability           # 5 operators, parse-enforced (the closed engine vocabulary)
//       required_capability "humidity-testing"
//     }
//   }
//
//   sample_selection_rule D.2.6-partial-evaluation-flags {
//     step "D.2.6"                        # quoted — heterogeneous free strings
//     rule "…"
//     rationale "R 60-2 §2.4.6"
//     applicability "selected.length > 0" # prose predicate — never resolved
//     selector "WHERE same_e_max(…) …"     # pseudo-code — never resolved
//     test_kind partial_evaluation        # 5 kinds, parse-enforced
//     single_sample true
//     additional_tests { temperature_mdlo "…" creep_dr "…" }
//   }
//
//   specimen_governance_rule unit-continuity {
//     rule "…"
//     rationale "R 60-2, 2.4"
//     applicability "always"
//     constraint "test_runs.group_by(test_kind).all { |g| … }"  # OCL-ish, documentary
//     post "Violations invalidate the affected runs …"
//   }
//
// C139 selection-rule-references: the lab criterion's
// applies_when/match model_field resolve against the attribute and
// dimension registers (per-register gated); the operator-conditional
// required facets (has_capability ⇒ required_capability;
// capability_from_field / capability_covers_value ⇒
// required_capability_prefix + model_field; capability_prefix_match ⇒
// prefix + model_field; always_pass ⇒ nothing else); the capability
// strings are free-form lab-side labels — never resolved. The
// sample/governance entries carry shape legs only (rule / rationale /
// applicability non-empty); the design.specimens back-reference stays
// smart-side (R13).
// ─────────────────────────────────────────────────────────────────────

/** The lab criterion's applicability condition. */
export interface LabSelectionAppliesWhen {
  /** The model field the condition reads (attribute or dimension id —
   *  C139, gated). */
  modelField: string;
  /** The value set variant ([] when unused). */
  in: string[];
  /** The equality variant ('' when unused). */
  equals: string;
  /** The presence variant (null when unused). */
  notNull: boolean | null;
}

/** The lab criterion's capability match. */
export interface LabSelectionMatch {
  /** has_capability | capability_from_field | capability_covers_value |
   *  capability_prefix_match | always_pass (parse-enforced). */
  operator: string;
  /** has_capability's capability label ('' when unused). */
  requiredCapability: string;
  /** The prefix variants' capability prefix ('' when unused). */
  requiredCapabilityPrefix: string;
  /** The field-derived variants' model field (C139, gated). */
  modelField: string;
  /** capability_covers_value's lab-side prefix ('' when unused). */
  labCapabilityPrefix: string;
}

export interface LabSelectionCriterion {
  id: string;
  /** required | preferred (parse-enforced; '' when unstated). */
  weight: string;
  /** dimension | parameter | operational (parse-enforced; '' when
   *  unstated). */
  parameterType: string;
  label: string;
  description: string;
  appliesWhen: LabSelectionAppliesWhen | null;
  match: LabSelectionMatch | null;
}

export interface SampleSelectionRule {
  /** May start with a digit (`7.1.2-…`) — quoted at emission when the
   *  bare-id grammar rejects it. */
  id: string;
  /** The source step reference — a heterogeneous free string. */
  step: string;
  rule: string;
  rationale: string;
  /** The prose predicate — never resolved. */
  applicability: string;
  /** The pseudo-code selector — never resolved. */
  selector: string;
  /** full_evaluation | partial_evaluation | deduplicate | humidity |
   *  digital_additional (parse-enforced; '' when unstated). */
  testKind: string;
  /** The single-sample flag (null when unstated — never canonicalizes
   *  to false). */
  singleSample: boolean | null;
  /** The additional-test notes, keyed by test id. */
  additionalTests: Record<string, string>;
  /** The post-condition prose ('' when unstated). */
  post: string;
}

export interface SpecimenGovernanceRule {
  id: string;
  rule: string;
  rationale: string;
  /** The prose predicate — never resolved. */
  applicability: string;
  /** The OCL-ish constraint — documentary, never resolved. */
  constraint: string;
  /** The post-condition prose ('' when unstated). */
  post: string;
}
