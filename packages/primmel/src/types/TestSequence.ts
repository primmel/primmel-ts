/**
 * The `test_sequence` construct (smart gap-close E10,
 * analysis/architecture-gaps-2026-07.md; the smart contract
 * data/schemas/test-sequences.yaml + data/r60/specification/
 * test-sequences.yaml): a required test ordering of a Recommendation —
 * the first-class replacement for the hand-authored supplemental YAML
 * the R 60 sequences (MDLO → creep → DR; the temperature-cycling
 * environment program) ride today:
 *
 *   test_sequence mdlo-creep-dr {
 *     name "MDLO → Creep → DR sequence"
 *     description "The three performance tests must run in this order on the same sample …"
 *     step 1 {
 *       test "/conf/metrological-tests/measurement-error-repeatability-mdlo"
 *       role baseline
 *     }
 *     step 2 {
 *       test "/conf/metrological-tests/creep"
 *       role follow_up
 *       depends_on 1
 *     }
 *     step 3 {
 *       test "/conf/metrological-tests/dr"
 *       role follow_up
 *       depends_on 2
 *     }
 *     sample_applicability all
 *     source { doc "urn:oiml:pub:r:60-2:2021" clause "2.10" }
 *     source { doc "urn:oiml:pub:r:60-2:2021" clause "2.11.1" }
 *   }
 *
 * The facets (the smart side's test-sequences.yaml contract — the
 * projection the kernel model feeds):
 *   - name — the short sequence name, MANDATORY (C92).
 *   - description — what the ordering protects, MANDATORY (C92). The
 *     default spelling's value is authored inline; alternates ride the
 *     ISO 24229 `text <id>.description { spell <code> "…" }` blocks
 *     (TODO.roadmap/25 — the same machinery every prose field uses).
 *   - steps — the ordered steps, MANDATORY non-empty (C92). One step:
 *     order (a positive integer, unique in the sequence — C92), test
 *     XOR phase (a conformance-test reference vs an environment-program
 *     phase name — C92; test-ref RESOLUTION is the smart-side linker
 *     rule R39's job, never the kernel's), role (OPTIONAL, test steps
 *     only, baseline | follow_up — C92), depends_on (OPTIONAL, the
 *     order of an EARLIER step of the same sequence — C93).
 *   - sample_applicability — which samples the sequence binds,
 *     OPTIONAL, free vocabulary (the smart side owns the semantics —
 *     presence-judged never, like the invariant severity).
 *   - source — clause-URN provenance, the platform's content doctrine:
 *     repeated `source { doc "urn:…" clause "…" }` blocks collecting
 *     into sourceRefs (the requirement family's idiom).
 *
 * Linter rules (check.ts, family base):
 *   C92 test-sequence-shape, C93 test-sequence-integrity.
 */

import type { SourceRef } from './Subject';

/**
 * The step-role vocabulary (C92): a test step is the baseline the
 * sequence protects, or a follow_up chained to an earlier step. Roles
 * are meaningless on phase steps (an environment phase runs no test).
 */
export const TEST_SEQUENCE_STEP_ROLES = ['baseline', 'follow_up'] as const;

/**
 * One ordered step of a test sequence. `order` is the step's declared
 * position (null = undeclared — C92; a non-integer or non-positive
 * value is the C92 shape error, never a parse error — the parser stays
 * total). `test` XOR `phase` (C92): both '' = neither declared, both
 * set = the malformed both-set declaration the linter judges.
 */
export interface TestSequenceStep {
  /** The declared 1-based position (null = undeclared — C92). */
  order: number | null;
  /** The conformance test this step runs ('' = undeclared; XOR phase). */
  test: string;
  /** The environment-program phase ('' = undeclared; XOR test). */
  phase: string;
  /** The step's role ('' = absent; baseline | follow_up, test steps only — C92). */
  role: string;
  /** The order of an earlier step this step depends on (null = absent — C93). */
  dependsOn: number | null;
}

/**
 * test_sequence <id> — a required test ordering of a Recommendation
 * (smart gap-close E10). Top-level construct, a sibling collection of
 * `invariants`: declared once per ordering, composed through `uses`
 * like every doctrine collection (MERGE_FIELDS).
 */
export interface TestSequence {
  id: string;
  /** The short sequence name ('' = undeclared — C92). */
  name: string;
  /** What the ordering protects, in the package's default spelling
   *  ('' = undeclared — C92; alternates ride `text <id>.description`
   *  blocks). */
  description: string;
  /** The ordered steps (empty = undeclared — C92). */
  steps: TestSequenceStep[];
  /** Which samples the sequence binds ('' = absent; free vocabulary —
   *  the smart side owns the semantics). */
  sampleApplicability: string;
  /** Clause-URN provenance (repeated `source { doc clause }` blocks —
   *  the requirement family's sourceRefs idiom). */
  sourceRefs: SourceRef[];
  /** The unified typed references (docs/primmel/18). */
  refs?: import('./Ref').Ref[];
}
