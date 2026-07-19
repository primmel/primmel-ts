/**
 * Shared acceptance decision block (data/schemas/{rc,cc,verdicts}.yaml
 * $defs/acceptanceDecision, TODO.refactor/10 — OIML G 1-106).
 *
 * Declares how a limit comparison decides conformity: the decision rule
 * (shared_risk default | guarded with a guard band), the reference
 * uncertainty budget, the verdict criterion taxonomy (R 91-2, 6.1), and
 * the statistical-justification variant (R 91-2, 4.4).
 */

export default interface AcceptanceDecision {
  /** shared_risk (default) | guarded. */
  rule: string;
  /** Guard band narrowing the effective limit; null when absent. */
  guardBand: { kind: string; value: number } | null;
  /** Reference-uncertainty budget (U:MPE ratio cap); null when absent. */
  uncertainty: { maxRatioToMpe: number } | null;
  /** Verdict taxonomy: I/MPE | D/NSFa | D/NSFd | n/a. */
  criterion: string;
  /** Statistical-justification variant; null when absent. */
  statistics: { method: string; onBasisOf: string; permits: string } | null;
}
