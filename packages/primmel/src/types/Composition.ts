/**
 * The composition facet (TODO.integration/14 — doctrine ch. 14, the
 * hierarchical-twin construct): a twin subject declares `composed_of` —
 * the component twins it is made of and the projection decomposition
 * (which component supplies each composite register, and the
 * composite's own state rule).
 *
 * Grammar (nested in the subject anatomy — is.composedOf):
 *
 *   subject CGMSystem {
 *     is {
 *       composed_of {
 *         component analyzer {
 *           product acme-cgm-200@2026
 *           endpoint cgm_api
 *           serial "CGM200-DEMO-0001"
 *           certificate null
 *         }
 *         component sample_line {
 *           product acme-cgm-system/sample-line@2026
 *           endpoint sample_line_api
 *           serial "CGM200-SL-0001"
 *           certificate null
 *         }
 *         decomposition {
 *           sample.indication_co -> analyzer.indication_co
 *           sample.indication_nox -> analyzer.indication_nox
 *           sample.test_context.flow -> sample_line.flow
 *           sample.state -> rule any_fault_else_analyzer
 *         }
 *       }
 *     }
 *   }
 *
 * The YAML projection (payload/composition.yaml — the codec's
 * projection, byte-clean): composition { components, decomposition,
 * revision, previous_revisions }.
 */

/** One component twin of the composition. */
export interface CompositionComponent {
  /** The component id (the decomposition's reference key). */
  id: string;
  /** The product package it instantiates, pinned `pkg@edition`. */
  product: string;
  /** The component's endpoint id (its projection serves on). */
  endpoint: string;
  /** The unit's serial. */
  serial: string;
  /** Twin certificate id in the register, or null (uncertified). */
  certificate: string | null;
}

/** One decomposition entry: composite register → the supplying
 *  component's register, or the composite's own state rule. */
export interface DecompositionEntry {
  /** The composite register (the subject's served aspect). */
  register: string;
  /** The supplying component id, or 'composite' for a rule entry. */
  component: string;
  /** The component's register (when component ≠ 'composite'). */
  componentRegister?: string;
  /** The state rule (when component = 'composite') — the CLOSED
   *  vocabulary: any_fault_else_analyzer. */
  rule?: string;
}

/** The composition facet of one composite subject. */
export interface CompositionDecl {
  components: CompositionComponent[];
  decomposition: DecompositionEntry[];
  /** The component-set revision (1 at authoring; bumped by replacement). */
  revision?: number;
  /** Prior component sets, retained (evidence accrues, never rewrites). */
  previousRevisions?: Array<{
    revision: number;
    components: CompositionComponent[];
    note?: string;
  }>;
}

/** The closed composite-state rule vocabulary (TODO.integration/06). */
export const COMPOSITION_STATE_RULES = ['any_fault_else_analyzer'] as const;
