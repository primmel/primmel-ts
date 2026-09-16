// ─────────────────────────────────────────────────────────────────────
// The workflow stage (smart TODO.roadmap/40 batch 5 step 5d; the
// packages-as-SSOT epic — closes the kernel half of smart's
// TODO.refactor/16) — the named pipeline stage grouping the workflow
// constructs: the member processes, the bracketing events, the
// approvals and gateways the stage routes through:
//
//   workflow_stage application_processing {
//     label "Application processing"
//     description "The IA intake pipeline — receipt to acceptance."
//     elements { receive_application check_completeness }
//     start_event application_received
//     end_events { application_accepted application_rejected }
//     approvals { ia_approve_application }
//     gateways { completeness_gateway }
//   }
//
// The member references resolve at CHECK time (C142
// gateway-edges-resolve, the stage members-resolve legs): elements →
// the process register, approvals → the approval register, gateways →
// the gateway register — per-register gated (the C58 doctrine). The
// events are DOCUMENTARY tokens (dossier hazard 3, decision (b)): the
// kernel's event register is the canvas start/end construct, a
// different sense — the stage's start_event / end_events name the
// pipeline's bracketing moments and are never resolved.
//
// The name is `workflow_stage`, not `subprocess`: the kernel
// `subprocess` keyword is a canvas-page reference (a different sense),
// and smart's naming registry governs product/component naming only —
// construct names are internal machinery, explicitly "Not named".
//
// The codec stays total — every facet is an opaque string or an id
// list; only C142 refuses the dangling members.
// ─────────────────────────────────────────────────────────────────────

export default interface WorkflowStage {
  /** The stage id. */
  id: string;
  /** The UI label ('' when unstated). */
  label: string;
  /** The prose description ('' when unstated). */
  description: string;
  /** The member process ids (resolve against the process register —
   *  C142, gated). */
  elements: string[];
  /** The opening event token (documentary — never resolved). */
  startEvent: string;
  /** The closing event tokens (documentary — never resolved). */
  endEvents: string[];
  /** The approval ids the stage routes through (resolve against the
   *  approval register — C142, gated). */
  approvals: string[];
  /** The gateway ids the stage routes through (resolve against the
   *  gateway register — C142, gated). */
  gateways: string[];
}
