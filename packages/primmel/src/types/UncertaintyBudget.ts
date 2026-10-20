import type { SourceRef } from './Subject';

/**
 * The uncertainty budget (register W5 — the language side of the GUM
 * plane): the components of one measured quantity's standard uncertainty
 * and the coverage factor of its expansion. The budget is a DECLARATION —
 * the propagation law (u_c = √(Σ uᵢ²), U = k·u_c) is the GUM's, computed
 * by the evaluation plane (plurimath's mandate, plurimath#488); the model
 * names the components, their kinds, and their provenance, never the
 * arithmetic.
 *
 *   uncertainty_budget u_ref {
 *     target mpe_error
 *     coverage k 2
 *     component u_cal {
 *       type B
 *       distribution rectangular
 *       half_width 0.5
 *       unit "kg"
 *       ref derives-from "urn:...#clause-..."
 *     }
 *     component u_rep {
 *       type A
 *       series reference_pair_error
 *     }
 *   }
 */

/** One budget component: a Type A (the statistics of a captured series)
 *  or a Type B (a stated distribution around a half-width) evaluation. */
export interface UncertaintyBudgetComponent {
  /** The component's id (budget-local; conventionally u_<effect>). */
  id: string;
  /** `A` (the statistics of a series) | `B` (a stated distribution). */
  type: 'A' | 'B';
  /** Type A: the declared test variable holding the captured series the
   *  statistics compute from. */
  series: string;
  /** Type B: the stated distribution — rectangular | triangular |
   *  normal | ushape (the GUM's input models; the divisor rule is the
   *  evaluation plane's). */
  distribution: string;
  /** Type B: the half-width the distribution spans. */
  halfWidth: string;
  /** The half-width's unit (the measured quantity's unit). */
  unit: string;
  /** Where the component's value comes from — the certificate, the
   *  calibration record, the traceability chain. */
  source: SourceRef | null;
  /** The component's effect, in prose. */
  description: string;
}

export default interface UncertaintyBudget {
  id: string;
  /** The verdict whose measured quantity this budget backs (C179). */
  target: string;
  /** The coverage factor k of the expansion (U = k·u_c); the GUM's
   *  default 2 when omitted. */
  coverageK: string;
  /** The budget's components. */
  components: UncertaintyBudgetComponent[];
  /** Normative anchor. */
  source: SourceRef | null;
  sourceRefs?: SourceRef[];
  /** The unified typed references (docs/primmel/18). */
  refs?: import('./Ref').Ref[];
  /** The correspondence annotations (MN 114 v3.1, clause 19.4). */
  correspondences?: import('./Correspondence').Correspondence[];
}
