import type { SourceRef } from './Subject';

/**
 * Laboratory testing-competence kind registry (TODO.roadmap/48 —
 * BUG.R60-SSOT gap 1): the vocabulary a conformance test's
 * `required_competence` and a TestLaboratory's `accreditation_scope`
 * draw from. ISO/IEC 17025:2017 deliberately defines NO competence
 * taxonomy (scopes of accreditation are laboratory-specific; clause 6
 * governs how competence is documented and demonstrated, not what the
 * kinds are) — so the kinds live in this cross-Recommendation registry
 * (oiml-smart-core), each anchored to the 17025 clause it operationalizes
 * (§6.4 equipment, §6.2 personnel) and to the Recommendation's own
 * equipment clauses.
 */
export default interface CompetenceKind {
  id: string;
  /** Human label (e.g. "Force measurement"). */
  label: string;
  /** What the kind covers — the laboratory activity/equipment class. */
  definition: string;
  /** Normative anchor (ISO/IEC 17025 §6.x, Recommendation equipment clause). */
  source: SourceRef | null;
  /** Method-standard ids recognized for this kind (the resolution registry
   *  for `method_standard` references on required_competence /
   *  accreditation_scope entries — e.g. iec-61000-4-4). */
  methodStandards: MethodStandard[];
}

/** A recognized method standard of a competence kind. */
export interface MethodStandard {
  id: string;
  /** Bibliographic title of the standard. */
  title: string;
}

/**
 * One competence entry — the shared shape of a conformance test's
 * `required_competence` (what the test needs) and a laboratory scope
 * entry (what the lab is accredited for). The cover calculus:
 * kind equal; range covers; method_standard equal-or-compatible;
 * resolution/stability at-least-as-good (smaller is better).
 */
export interface CompetenceRequirement {
  /** Competence-kind id (registry reference). */
  kind: string;
  /** Exercised range — interval in the entry's unit. Bounds on a TEST
   *  may name a subject parameter (resolved against the dispatch
   *  context, e.g. "e_max"); a laboratory scope always states numbers. */
  range: CompetenceRange | null;
  /** Method-standard id (registry's methodStandards), when the
   *  procedure prescribes the method (e.g. IEC 61000-4-4 for bursts). */
  methodStandard: string;
  /** Readout/indication resolution the work requires or the lab holds —
   *  smaller is better (at-least-as-good = ≤). */
  resolution: CompetenceQuantity | null;
  /** Environmental stability the work requires or the lab holds —
   *  smaller is better (at-least-as-good = ≤). */
  stability: CompetenceQuantity | null;
  /** Free-text detail (grounding, per-denominator notes, …). */
  description: string;
}

/** An interval in one unit; a bound may be a parameter id (test side). */
export interface CompetenceRange {
  min: number | string | null;
  max: number | string | null;
  unit: string;
}

/** A scalar quantity bound (resolution, stability). */
export interface CompetenceQuantity {
  value: number;
  unit: string;
}
