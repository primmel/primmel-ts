// ─────────────────────────────────────────────────────────────────────
// The workflow config (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — the rec's certification workflow as a
// register of steps with explicit actor handoffs (smart's
// workflow.service.ts gating), a different thing from the
// `process`/`process_model` abstract-process machinery and from
// `state_machine` lifecycles:
//
//   workflow_config certification {        # singleton per layer
//     step application {
//       phase intake                       # intake|dispatch|testing|evaluation|issuance (parse-enforced)
//       actor applicant                    # → role register (C137)
//       label "Type Evaluation Application"
//       description "…"
//       inputs { applicant_info model_family_matrix documentation }
//       outputs { Application }
//       gates { "Application.status = SUBMITTED" "…" }
//     }
//     …
//   }
//
//   # a rec package overlays the core skeleton:
//   workflow_config certification {
//     overlay true                         # the deep-merge marker (B3.1)
//     step test-request-dispatch {
//       gates { "Each TestRequest.required_forms subset of R 60-3 form identifiers" }
//     }
//   }
//
// The OVERLAY composition is the point: the core layer carries the
// 5-step OIML-CS skeleton and each rec package appends its bound gate
// criteria — `workflowConfigs` rides OVERLAY_DEEP_MERGE_FIELDS, so an
// overlay-marked entry merges FIELD-WISE (steps union by id preserving
// first-seen order, gates append as a union, scalars override), the
// smart layer-composer's contract.
//
// C137 workflow-config-references: `actor` resolves against the role
// register (per-register gated; role ids are snake_case — the YAML
// hyphenation is the emitter's); `inputs`/`outputs` entries resolve
// against the data-class register ONLY when the entry is a single clean
// token (composite strings like "TestReport containing FormInstance"
// stay documentary — skipped, never errored); `gates` are prose
// predicates — never resolved (the R26 field-resolution precedent).
// ─────────────────────────────────────────────────────────────────────

/** One workflow step. The optional scalar facets are NULL when
 *  unstated (never '') — the overlay deep merge reads null as "the
 *  overlay does not name this key" and keeps the base value. */
export interface WorkflowStep {
  /** The step id. */
  id: string;
  /** intake | dispatch | testing | evaluation | issuance
   *  (parse-enforced; null when an overlay entry restates none). */
  phase: string | null;
  /** The owning role id (snake_case; resolves against the role
   *  register — C137; null when unstated). */
  actor: string | null;
  /** The UI label (null when unstated). */
  label: string | null;
  /** The prose description (null when unstated). */
  description: string | null;
  /** The data-class ids (or documentary composite strings) the step
   *  reads ([] appends nothing under the overlay merge). */
  inputs: string[];
  /** The data-class ids (or documentary composite strings) the step
   *  produces ([] appends nothing under the overlay merge). */
  outputs: string[];
  /** The gate predicates — prose, never resolved (C137). */
  gates: string[];
}

export default interface WorkflowConfig {
  /** Conventionally `certification` (singleton per layer). */
  id: string;
  /** The deep-merge overlay marker (B3.1; consumed by composition). */
  overlay: boolean;
  /** The steps, in declared order. */
  steps: WorkflowStep[];
}
