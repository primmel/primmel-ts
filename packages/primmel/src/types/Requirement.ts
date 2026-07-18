/**
 * Requirement constructs (Primmel v2, gap G3).
 *
 * Requirements are REGULATORY LIMITS bound to the subject chain — not prose:
 * statement + binds_to paths + machine OCL limit + applicability.
 * Requirement classes group requirements into scopes (/req/<area>).
 */

import type { ApplicabilityEntry } from './Form';
import type { SourceRef } from './Subject';

export interface RequirementLimit {
  expression: string;
  uses: string[];
}

export interface Requirement {
  id: string;
  name: string;
  statement: string;
  /** Attribute paths into the subject chain (INV-3 — bind, never restate). */
  bindsTo: string[];
  /** Machine-checkable limit as OCL (quantitative requirements). */
  limit: RequirementLimit | null;
  /** Classification applicability filter (dimension → allowed values). */
  applicability: ApplicabilityEntry[];
  /** Structured acceptance criteria (threshold/tiered/composite/qualitative), raw. */
  acceptanceCriteria: string;
  /** definitional | testing | examination | documentation */
  verificationMethod: string;
  source: SourceRef | null;
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
  dependencies: string[];
  referenceIds: string[];
}
