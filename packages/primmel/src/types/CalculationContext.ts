// ─────────────────────────────────────────────────────────────────────
// The calculation context (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — the evaluation-side WIRING of computation
// inputs to their subject-chain sources (smart's
// computation-context.service.ts), a different thing from the
// `calculation` construct (the specification-side register of named
// computations with typed signatures):
//
//   calculation_context evaluation {        # singleton per rec
//     field accuracy_class { source classification.accuracy_class }
//     field p_lc           { source parameters.p_lc }
//     field v_min {
//       source computed
//       expression "(e_max - e_min) / (n_lc * f)"
//     }
//   }
//
// The `source` is a dotted scalar (parse-total): classification.<dim>
// (a classification dimension of the subject chain), parameters.<attr>
// (an attribute_definition, resolved by INV-10 delegation Sample →
// Model → Group → Family), or `computed` (the expression wires other
// fields). The legacy schema tokens (dimensions, application,
// application.specs, lookup) are unused everywhere and get NO facet —
// C133 errors on them if they ever appear, forcing the modern spelling.
//
// C133 calculation-context-references: the classification/parameters
// targets resolve (per-register gated), computed ⇔ expression presence,
// and the expression's free identifiers name the context's own fields
// (WARNING — runtime-bound inputs like r60's `f` (conversion_factor_f)
// and r144's `measured_value` are legitimate non-field references).
// ─────────────────────────────────────────────────────────────────────

/** One wired field of the calculation context. */
export interface CalculationContextField {
  /** The computation input's name (the variable id). */
  id: string;
  /** classification.<dim> | parameters.<attr> | computed (dotted scalar,
   *  parse-total; the resolution legs are C133's). */
  source: string;
  /** The computation when source = computed ('' otherwise — C133). */
  expression: string;
}

export default interface CalculationContext {
  /** Conventionally `evaluation` (singleton per rec). */
  id: string;
  /** The wired fields, in declared order. */
  fields: CalculationContextField[];
}
