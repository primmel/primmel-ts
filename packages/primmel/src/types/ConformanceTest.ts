import type AcceptanceDecision from './Acceptance';
import type TestDesign from './Design';
import type Reference from './Reference';
import type { CompetenceRequirement } from './CompetenceKind';
import type { ApplicabilityEntry } from './Form';
import type { SeriesDecl } from './Series';
import type SourceDiscrepancy from './SourceDiscrepancy';

export interface ConformanceTestStep {
  order: number;
  action: string;
  /** Observable/value ids this step produces. */
  outputs: string[];
  /** Value ids this step consumes. */
  inputs?: string[];
}

/**
 * Probe-channel provenance on a measured test variable (smart TODO.v2/01
 * TCD-2; analysis/twin-certification-design.md Q2): the physical-side
 * channel a reference reading arrives by — the three-source vocabulary
 * `reference_instrument` (a traceable reference, cited by equipment-register
 * id) | `observer_attestation` (a verification officer reads the physical
 * display into the evidence form — admitted with the DECLARED traceability
 * limitation, "twin ≡ display, not twin ≡ mass") | `sim_ground_truth` (the
 * acceptance environment only, never a production channel). The ref's
 * RESOLUTION (equipment register / personnel registry / sim deployment) is
 * the smart-side linker's crosswalk — the kernel checks shape and
 * vocabulary (C99), register-free.
 */
export interface VariableProvenance {
  /** reference_instrument | observer_attestation | sim_ground_truth (C99). */
  channel: string;
  /** The channel's citation — equipment-register id, personnel/participant id, or sim deployment id. */
  ref: string;
  /** The test variable carrying this channel reading's observation timestamp. */
  observedAt: string;
  /** The DECLARED traceability limitation — required iff channel is observer_attestation (C99). */
  limitation: string;
}

/** Typed test variable (v2 G4): declared | measured | derived | computed | lookup. */
export interface TestVariable {
  name: string;
  type: string;
  unit: string;
  source: string;
  derivation: string;
  description: string;
  itemType: string;
  /** Series shape (axes + cell) when the variable holds a series of readings. */
  series: SeriesDecl | null;
  /** Probe-channel provenance (TCD-2) — a measured reference variable's physical channel. */
  provenance: VariableProvenance | null;
}

/** Observable output of a test run (v2 G4). */
export interface TestObservable {
  name: string;
  quantityKind: string;
  unit: string;
  as: string;
}

/** Machine acceptance criterion (v2 G4). */
export interface AcceptanceCriterion {
  item: string;
  passIf: string;
  requirementId: string;
  /** Verdict criterion taxonomy (I/MPE | D/NSFa | D/NSFd | n/a). */
  criterion: string;
  /** An optional criterion never blocks the verdict. */
  optional: boolean;
  description: string;
  /** Source reference URN. */
  reference: string;
  /** Verdict-registry acceptance binding (verdict + op + limit). */
  accepts?: { verdict: string; op: string; limit: string };
  /** Annotated source contradiction on this criterion's limit (TODO.refactor/11). */
  sourceDiscrepancy?: SourceDiscrepancy | null;
}

/**
 * Run-validity precondition (data/schemas/cc.yaml). Evaluated BEFORE the
 * acceptance limit, following inherits_from chains: a violation VOIDS the
 * run — the verdict outcome is `invalid`, never `fail` — and a check with
 * missing inputs never fires.
 */
export interface TestPrecondition {
  id: string;
  /** OCL run-validity check expression. */
  check: string;
  description: string;
  /** Verdict outcome when the check is violated — 'invalid' (void run). */
  onViolation: string;
  /** Declared escalation when the check's inputs are UNRESOLVABLE (missing
      run data): 'indeterminate' makes the verdict indeterminate (the
      unbound-reads discipline) instead of silently skipping the check;
      absent/'skip' keeps the documented leniency (never fires). */
  onUnresolvable?: string;
}

/** Runtime class-driven instantiation (cc.yaml `instances`). */
export interface TestInstances {
  /** Dimension the instantiation switches on (e.g. accuracy_class). */
  by: string;
  /** Dimension value → parameter overrides (numeric when numeric-looking). */
  values: Record<string, Record<string, string | number>>;
}

export default interface ConformanceTest {
  id: string;
  name: string;
  /** What this test verifies (narrative). */
  purpose?: string;
  /** How the test is performed (narrative method). */
  method?: string;
  /**
   * The test's executable METHOD (smart-repo TODO.roadmap/55 — BUG.R60-SSOT
   * gap 10): a reference into the rec's behavior/method vocabulary — the id
   * of the model-layer process (model/processes.prl, task-50 executable
   * anatomy: steps, gateways, preconditions) that runs the test. Additive:
   * flat tests carry the narrative `method` only; the linker's
   * test-method-link rule resolves the ref where declared.
   */
  methodRef?: string;
  /** Free-text guidance (application notes). */
  guidance: string;
  type: string;
  reference: string;
  /** Structured form when reference is a { doc, clause } block (v2). */
  sourceRef?: { doc: string; clause: string; fragment?: string } | null;
  /** All structured provenance bindings when the test cites several
   * fragments (TODO.roadmap/24 — repeated `source {}` blocks; sourceRef is
   * the first entry, kept for back-compatibility). */
  sourceRefs?: { doc: string; clause: string; fragment?: string }[];
  targets: string[];
  /** Inspection/verification targets in the subject's HAS inventory
   * (TODO.roadmap/47) — the same canonical path vocabulary as
   * Requirement.bindsTo: `targets` names the requirements verified,
   * `bindsTo` names the subject items the test exercises or inspects. */
  bindsTo: string[];
  /** Classification applicability filter (dimension → allowed values). */
  applicability: ApplicabilityEntry[];
  procedure: ConformanceTestStep[];
  /** Named string step references (R 60-style procedure_steps). */
  procedureSteps?: string[];
  measurements: string[];
  // v2 G4 additions
  kind: string;
  /**
   * Obligation level in the type-evaluation programme (TODO.roadmap/19,
   * gap audit G5): mandatory | optional | conditional. Empty = mandatory
   * (the programme default). `conditional` requires obligationNote.
   */
  obligation: string;
  /** Condition/applicability note for obligation=conditional. */
  obligationNote: string;
  testSubject: Record<string, string>;
  variables: TestVariable[];
  observables: TestObservable[];
  conditionsToEnforce: string[];
  /** Run-validity preconditions — a violation voids the run (invalid, never fail). */
  preconditions: TestPrecondition[];
  /** Reference material ids this test relies on. */
  referenceMaterials: string[];
  /** Laboratory competence this test requires (TODO.roadmap/48 —
   * BUG.R60-SSOT gap 1): the dispatch cover relation matches these
   * against the TestLaboratory's accreditation_scope; a class-specific
   * test inherits its base test's entries through inherits_from. */
  requiredCompetence: CompetenceRequirement[];
  acceptanceCriteria: AcceptanceCriterion[];
  /** Block-level acceptance_criteria kind (e.g. composite). */
  acceptanceCriteriaType: string;
  acceptanceCriteriaDescription: string;
  /** Block-level pass_if for composite criteria. */
  acceptancePassIf: string;
  /** Test-design metadata (counts/severities/test points/schedule/specimens). */
  design: TestDesign | null;
  /** Acceptance decision rule (guarding, criterion, statistics). */
  acceptance: AcceptanceDecision | null;
  /** Other conformance test ids this one depends on. */
  dependencies: string[];
  /** Runtime class-driven instantiation parameters. */
  instances: TestInstances | null;
  inheritsFrom: string;
  resultForms: string[];
  /**
   * Artifact definitions a run of this test produces via the instrument
   * under test (TODO.roadmap/09 — model/artifacts.yaml ids; e.g. R 91's
   * enforcement evidence file per measurement).
   */
  producesArtifacts?: string[];
  /** Report-table conclusion rows this executed test maps to (cc.yaml). */
  reportRows?: string[];
  derivedValues: Array<{ name: string; expression: string }>;
  sourceDiscrepancy: SourceDiscrepancy | null;
}

export type { Reference };
