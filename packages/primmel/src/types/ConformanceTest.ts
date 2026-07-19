import type Reference from './Reference';
import type { SeriesDecl } from './Series';

export interface ConformanceTestStep {
  order: number;
  action: string;
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
}

export default interface ConformanceTest {
  id: string;
  name: string;
  /** What this test verifies (narrative). */
  purpose?: string;
  /** How the test is performed (narrative method). */
  method?: string;
  type: string;
  reference: string;
  /** Structured form when reference is a { doc, clause } block (v2). */
  sourceRef?: { doc: string; clause: string } | null;
  targets: string[];
  procedure: ConformanceTestStep[];
  /** Named string step references (R 60-style procedure_steps). */
  procedureSteps?: string[];
  measurements: string[];
  // v2 G4 additions
  kind: string;
  testSubject: Record<string, string>;
  variables: TestVariable[];
  observables: TestObservable[];
  conditionsToEnforce: string[];
  /** Run-validity preconditions — a violation voids the run (invalid, never fail). */
  preconditions: TestPrecondition[];
  acceptanceCriteria: AcceptanceCriterion[];
  inheritsFrom: string;
  resultForms: string[];
  derivedValues: Array<{ name: string; expression: string }>;
}

export type { Reference };
