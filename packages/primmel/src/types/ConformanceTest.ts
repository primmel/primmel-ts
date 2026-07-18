import type Reference from './Reference';

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
  acceptanceCriteria: AcceptanceCriterion[];
  inheritsFrom: string;
  resultForms: string[];
  derivedValues: Array<{ name: string; expression: string }>;
}

export type { Reference };
