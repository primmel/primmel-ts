import type AcceptanceDecision from './Acceptance';
import type TestDesign from './Design';
import type Reference from './Reference';
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
