/**
 * Requirement constructs (Primmel v2, gap G3).
 *
 * Requirements are REGULATORY LIMITS bound to the subject chain — not prose:
 * statement + binds_to paths + machine OCL limit + applicability.
 * Requirement classes group requirements into scopes (/req/<area>).
 */

import type AcceptanceDecision from './Acceptance';
import type { ApplicabilityEntry } from './Form';
import type SourceDiscrepancy from './SourceDiscrepancy';
import type { SourceRef } from './Subject';

/** Canonical acceptance: reference a declared VerdictQuantity by id. */
export interface RequirementLimitAccepts {
  /** VerdictQuantity id from the verdict registry. */
  verdict: string;
  /** Comparison applied between the derived value and the limit. */
  op: string;
  /** Limit predicate, ocl{...}. */
  limit: string;
  sourceDiscrepancy: SourceDiscrepancy | null;
}

export interface RequirementLimit {
  expression: string;
  uses: string[];
  /** shall (default) | should — a failed should-limit is an observation. */
  modality: string;
  /** Declared base of a relative (ratio) limit. */
  relativeTo: string;
  notes: string;
  /** Canonical acceptance via the verdict registry (derive once). */
  accepts: RequirementLimitAccepts | null;
  /** Acceptance decision rule (guarding, criterion, statistics). */
  acceptance: AcceptanceDecision | null;
  sourceDiscrepancy: SourceDiscrepancy | null;
}

/** One subject slot the requirement verifies (numbered subject chain). */
export interface RequirementSubject {
  slot: number;
  entityId: string;
  label: string;
}

/** Typed requirement parameter (e.g. n_runs with default + range). */
export interface RequirementParameter {
  name: string;
  type: string;
  description: string;
  unit: string;
  defaultValue: string;
  hasDefault: boolean;
  rangeMin: string;
  rangeMax: string;
  hasRange: boolean;
  enumValues: string[];
}

export interface Requirement {
  id: string;
  name: string;
  statement: string;
  /** Free-text guidance (application notes). */
  guidance: string;
  /** Attribute paths into the subject chain (INV-3 — bind, never restate). */
  bindsTo: string[];
  /** Machine-checkable limit as OCL (quantitative requirements). */
  limit: RequirementLimit | null;
  /** Classification applicability filter (dimension → allowed values). */
  applicability: ApplicabilityEntry[];
  /**
   * Channel dimension id (a set-cardinality classification dimension,
   * e.g. measurand_components). When declared, this requirement is
   * verified PER SELECTED VALUE of the channel dimension (see the
   * instrument's per_channel declaration). Empty = once per model.
   */
  channel: string;
  /** Subject slots the requirement verifies. */
  subjects: RequirementSubject[];
  /** Typed parameters (n_runs etc.) with defaults/ranges. */
  parameters: RequirementParameter[];
  /** shall (default) | should obligation level. */
  obligation: string;
  /** Report-table row this examination-targeted requirement maps to (rc.yaml). */
  reportRow?: string;
  /** Structured acceptance criteria (threshold/tiered/composite/qualitative), raw. */
  acceptanceCriteria: string;
  /** definitional | testing | examination | documentation */
  verificationMethod: string;
  /** Free-text explanation of the verification approach. */
  verificationDescription?: string;
  /** Other requirement ids this one depends on. */
  dependencies: string[];
  sourceDiscrepancy: SourceDiscrepancy | null;
  source: SourceRef | null;
  /** All structured provenance bindings when the requirement cites several
   * fragments (TODO.roadmap/24 — repeated `source {}` blocks; source is
   * the first entry, kept for back-compatibility). */
  sourceRefs?: SourceRef[];
  /** The unified typed references/relations (spec: docs/primmel/18) —
   *  `ref <predicate> "<target>"` lines on the requirement. */
  refs?: import('./Ref').Ref[];
  referenceIds: string[];
}

export interface RequirementClass {
  id: string;
  name: string;
  /** Display title (defaults to name when absent). */
  title?: string;
  description?: string;
  subject: string;
  guidance: string;
  /** Classification applicability filter at class scope (dimension → allowed values). */
  applicability?: ApplicabilityEntry[];
  dependencies: string[];
  referenceIds: string[];
}
