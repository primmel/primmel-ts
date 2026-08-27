import type { SourceRef } from './Subject';

/**
 * Domain constraint (TODO.roadmap/51 — BUG.R60-SSOT gap 7): the subject's
 * own intrinsic validity rule — stereotype «inv» (the UML/OCL invariant
 * stereotype). Requirements constrain the subject from OUTSIDE (the
 * Recommendation's regulatory limits); a constraint is a DECLARATION-LEVEL
 * validity rule of the subject itself (R 60-1, 3.6 test-setup geometry
 * 0.9·E_max ≤ D_max ≤ E_max): a violation invalidates the MEASUREMENT
 * (invalid = void measurement, never a fail) — distinct from run-level
 * preconditions, whose violation voids the RUN. The metamodel invariants
 * INV-1..14 live one level up; constraint entities are the
 * Recommendation-level counterpart.
 */
export default interface Constraint {
  id: string;
  /** Constraint stereotype — `inv` (an invariant on the subject). */
  stereotype: string;
  /** Human label (e.g. "Dead-load maximum geometry"). */
  name: string;
  /** Machine-checkable invariant as OCL over the subject's declared
   *  anatomy (model.parameters.*, sample.test_context.*, …). */
  check: string;
  /** REQUIRED: what a violation MEANS — recorded on the invalidated
   *  judgment (e.g. "the test setup does not realize the measuring range
   *  the type evaluation claims"). */
  violationMeaning: string;
  /** invalid (void measurement) | indeterminate (cannot be judged) —
   *  NEVER a fail. Defaults to invalid when omitted (the precondition
   *  discipline). */
  onViolation: string;
  /** Normative anchor (Recommendation clause). */
  source: SourceRef | null;
  sourceRefs?: SourceRef[];
  /** The unified typed references (docs/primmel/18). */
  refs?: import('./Ref').Ref[];
  /** The correspondence annotations (MN 114 v3.1, clause 19.4). */
  correspondences?: import('./Correspondence').Correspondence[];
}
