/**
 * Reference material construct (data/schemas/reference-materials.yaml,
 * TODO.refactor/10 L7): the reference-material registry.
 *
 * Every measurement reference a standard's tests rely on (R 144 CGMs,
 * R 91 reference speed meters) is declared once here with its identity
 * fields and its normative CONSTRAINTS as machine-checkable rules.
 * Conformance tests link a material via `reference_materials { <id> }`;
 * a violated constraint with on_violation invalidate voids the run
 * (verdict outcome invalid, never fail).
 */

import type { SourceRef } from './Subject';

/** One identity field of a material instance (certified value, ...). */
export interface MaterialIdentityField {
  name: string;
  description: string;
  unit: string;
  type: string;
  required: boolean;
}

/** Authority-allowed relaxation of a constraint (recorded evidence only). */
export interface MaterialConstraintOverride {
  /** Relaxed OCL Boolean rule (same binding as `rule`). */
  rule: string;
  /** Who may allow the override (e.g. issuing_authority). */
  by: string;
  /** Boolean evidence field id whose true value activates the override. */
  evidence: string;
}

/** Normative, machine-checked constraint on the material. */
export interface MaterialConstraint {
  id: string;
  description: string;
  /** OCL Boolean expression — free identifiers bind via `evidence`. */
  rule: string;
  /** Constraint identifier → evidence field id binding. */
  evidence: Record<string, string>;
  override: MaterialConstraintOverride | null;
  /** invalidate: a violated constraint voids the run. */
  onViolation: string;
  source: SourceRef | null;
  sourceRefs?: import('./Subject').SourceRef[];
}

export default interface ReferenceMaterial {
  id: string;
  /** Material kind (e.g. certified_gas_mixture, reference_speed_meter). */
  kind: string;
  name: string;
  definition: string;
  source: SourceRef | null;
  /** All provenance bindings (docs/primmel/18 §18.4 — the derives-from
   *  fold target; `source` stays the first entry). */
  sourceRefs?: import('./Subject').SourceRef[];
  /** The unified typed references (docs/primmel/18) — semantic
   *  predicates stay here; citation kinds fold onto source/sourceRefs. */
  refs?: import('./Ref').Ref[];
  /** The correspondence annotations (MN 114 v3.1, clause 19.4). */
  correspondences?: import('./Correspondence').Correspondence[];
  identityFields: MaterialIdentityField[];
  constraints: MaterialConstraint[];
}
