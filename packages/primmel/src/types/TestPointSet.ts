/**
 * Test point set construct (data/<rec>/specification/test-point-sets.yaml).
 *
 * Named, shared test-point sets referenced by conformance tests
 * (R 144-2, 1.2): the points within the measuring range at which errors
 * are determined, with the cardinality rule per calibration profile and
 * the per-point anchors/offsets.
 */

import type { SourceRef } from './Subject';

/** Cardinality rule for one calibration profile (e.g. linear/nonlinear). */
export interface TestPointCardinality {
  minPoints: number | null;
  rule: string;
}

/** One named test point (fraction of range + anchor + human offset). */
export interface TestPoint {
  id: string;
  fraction: number | null;
  /** Anchor the fraction applies to (e.g. range_min, range_mid). */
  anchor: string;
  /** Human-readable offset rule (e.g. "+10 % of range"). */
  offset: string;
}

export default interface TestPointSet {
  id: string;
  description: string;
  source: SourceRef | null;
  /** Profile name (linear, nonlinear, ...) → cardinality rule. */
  cardinality: Record<string, TestPointCardinality>;
  repetitionsPerPoint: number | null;
  points: TestPoint[];
}
