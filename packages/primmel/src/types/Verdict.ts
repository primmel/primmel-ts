/**
 * Verdict construct (OIML SMART TODO.refactor/04 — canonical verdict chain).
 *
 * A Verdict declares the SINGLE canonical derivation of one acceptance
 * quantity ("derive once, reference everywhere"): requirements
 * (limit.accepts), conformance tests, and form fields reference it by id
 * instead of restating the expression. Every free identifier of the
 * derivation must appear in `inputs` (linker rule verdict-inputs-resolve).
 *
 * Maps 1:1 to verdicts.yaml (data/schemas/verdicts.yaml).
 */

import type AcceptanceDecision from './Acceptance';
import type { SourceRef } from './Subject';

/** How a series of derived values reduces to one scalar before acceptance. */
export type SeriesReduction =
  'none' | 'max' | 'mean' | 'worst_case' | 'max_abs_over_window';

/** verdict <id> — one canonical acceptance quantity. */
export default interface Verdict {
  id: string;
  /** Display symbol of the quantity (e.g. C_M for mdlo_normalized). */
  symbol?: string;
  /**
   * Id of the declared behavior this quantity is derived from — the
   * behavior→I/O→characteristic chain link (TODO.roadmap/10).
   */
  behavior?: string;
  /** Quantity kind of the derived value (e.g. mass, volume-fraction). */
  quantityKind: string;
  /** Measurement unit of the derived value; empty for dimensionless. */
  unit: string;
  /** The single canonical derivation, ocl{...}. */
  derive: string;
  /** Symbol ids the derivation reads (its free identifiers). */
  inputs: string[];
  /** Series→scalar reduction; null for scalar (single-measurement) verdicts. */
  seriesReduction: SeriesReduction | null;
  /** Acceptance decision rule (guarding, criterion, statistics). */
  acceptance?: AcceptanceDecision | null;
  source: SourceRef | null;
  sourceRefs?: import('./Subject').SourceRef[];
  /** The unified typed references (docs/primmel/18) — semantic
   *  predicates stay here; citation kinds fold onto source/sourceRefs. */
  refs?: import('./Ref').Ref[];
}
