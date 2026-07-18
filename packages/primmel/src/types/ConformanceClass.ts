/**
 * Conformance class construct (Primmel v2) — a conformance-test scope
 * (/conf/<area>), grouping tests with shared target/subject/applicability.
 */

import type { ApplicabilityEntry } from './Form';

export interface ConformanceClass {
  id: string;
  name: string;
  title?: string;
  description?: string;
  /** The requirement scope(s) these tests verify. */
  target: string;
  /** Subject type or classification the tests apply to. */
  subject: string;
  applicability: ApplicabilityEntry[];
  guidance: string;
  dependencies: string[];
  referenceIds: string[];
}
