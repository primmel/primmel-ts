import { Resolvable } from './Resolvable';
import { Registry } from './data';
import { Subprocess } from './flow';
import type { TestInstances, TestPrecondition } from './ConformanceTest';
import type { QuantityValue } from './Quantity';
import type { SourceRef } from './Subject';
import Provision from './Provision';
import Role from './Role';

// ─────────────────────────────────────────────────────────────────────
// Primmel v3 process model (TODO.roadmap/02) — the v2 `process` construct
// gains the subject anatomy of a process: IS the signature/invariants/
// preconditions/executor, HAS the registers/state, DOES the steps.
//
// Two definition forms (the author's ladder):
//   - ABSTRACT — signature + invariants (+ preconditions), no `does`
//     body. Always valid: says WHAT the process is, not how it proceeds.
//   - EXECUTABLE — a `does` body of steps + flow edges is present.
//     Refining an abstract process into an executable one is additive.
//
// Precondition semantics: preconditions are OCL Booleans on entry; a
// violation voids the RUN (its verdicts become `invalid`, never `fail`).
// Evaluation is the runtime's business — the language only carries the
// declaration (same shape as conformance-test preconditions, so the type
// is shared: TestPrecondition).
// ─────────────────────────────────────────────────────────────────────

/** A typed name — a signature parameter or a register. */
export interface ProcessParameter {
  name: string;
  /** Quantity-kind / type annotation (single token, e.g. mass, time). */
  type: string;
  /**
   * Registers only (TODO.roadmap/50): the slot's INITIAL value — a literal
   * consistent with the declared type (number, text, boolean token, or a
   * quantity value + unit; the block form carries the full QuantityValue
   * contract). `= <value> [unit]` in the `registers { … }` entry.
   * undefined = no initial value declared. Signature parameters never
   * carry one (their values arrive at the call).
   */
  initial?: QuantityValue;
}

/** Process I/O signature: what the process consumes (IN) and produces (OUT). */
export interface ProcessSignature {
  inputs: ProcessParameter[];
  outputs: ProcessParameter[];
}

/**
 * One role-segregation constraint of a process (TODO.roadmap/39b — the
 * ISO/IEC 17065 clause-7 non-involvement rules: 7.5.1 reviewer ∉
 * evaluation, 7.6.2 decider ∉ evaluation, 7.13.5 complaint resolution ∉
 * case activities, 7.13.6/4.2.10 consultancy bars). First-class structured
 * declaration, NOT an OCL invariant: invariants quantify over one
 * process's own signature records, while segregation is a CROSS-process
 * relation over personnel sets, per case — and invariant strings are never
 * mechanically evaluated.
 *
 * `pair` members are PROCESS ids (that process's personnel set for the
 * case at hand), or the reserved token `case_personnel` (the personnel
 * involved in the certification activities of the case a complaint
 * relates to — 7.13.5's case-relative set). Roles are deliberately not
 * members: a scheme may bind one role to evaluation, review AND decision,
 * so the norms quantify over process INVOLVEMENT, not role assignment.
 * The linter (C59 segregation-members-resolve) checks well-formedness;
 * per-assignment runtime enforcement is the platform's business.
 */
export interface SegregationEntry {
  id: string;
  /** 'case_personnel_disjoint' | 'consultancy_bar' ('' = undeclared). */
  kind: string;
  /** Clause of the source standard stating the constraint (e.g. "7.5.1"). */
  clause: string;
  /** The two disjoint personnel sets (disjoint entries; exactly two). */
  pair: string[];
  /** ISO-8601 duration of a fixed consultancy bar (7.13.6: "P2Y"); '' = none. */
  period: string;
  /** The barred client relations ('consultancy' | 'employment') — bar entries. */
  barred: string[];
  /** Verbatim-faithful normative statement of the constraint. */
  statement: string;
}

/**
 * One evidence-record slot of an abstract process (smart TODO.roadmap/40
 * batch 2 — the OIML-CS abstract-process model): a record the process's
 * run must produce into the evidence store (the application record, the
 * review report). `required` false marks an optional slot.
 */
export interface EvidenceEntry {
  id: string;
  description: string;
  required: boolean;
}

/**
 * The decision facet of an abstract process (smart TODO.roadmap/40 batch
 * 2): the process applies a framework `decision_rule` (its voting/
 * recommendation machinery), cited with the governing clause. The rule
 * reference resolves against the composed decision_rule register at check
 * time (C121); the codec stays total.
 */
export interface ProcessDecision {
  /** decision_rule id. */
  rule: string;
  /** The clause governing the decision (e.g. "PD-03, 5.3.2"). */
  clause: string;
}

/**
 * The declaration facet of an abstract process (smart TODO.roadmap/40
 * batch 2): the process signs or updates a framework Declaration
 * (`declaration_kind`). The action vocabulary (sign | update) and the
 * kind's resolution against the declaration_kind register are check-time
 * (C121); the codec stays total.
 */
export interface ProcessDeclaration {
  /** declaration_kind id. */
  kind: string;
  /** 'sign' | 'update' ('' = undeclared). */
  action: string;
}

/**
 * One calendar window constraining an abstract process (smart
 * TODO.roadmap/40 batch 2 — e.g. PD-01 8.2/8.3: the written appeal
 * reaches the Executive Secretary within ONE MONTH of the appellant
 * being informed). `kind` is max_elapsed (a deadline) or min_elapsed (a
 * cooling-off); `anchor` and `applies_to` name the record date fields
 * opening resp. constrained by the window (field resolution is the
 * consumer's business — the R26 precedent); the duration reuses the
 * scheme_lifecycle window sub-grammar (exactly one of years/months);
 * `breach` names the state-machine action a breach fires ('' = none).
 * Shape and vocabulary are check-time (C121); the codec stays total.
 */
export interface ProcessWindow {
  id: string;
  /** 'max_elapsed' | 'min_elapsed' ('' = undeclared). */
  kind: string;
  /** The clause stating the window (e.g. "PD-01, 8.2/8.3"). */
  clause: string;
  /** The record date field opening the window. */
  anchor: string;
  /** The record date field the window constrains. */
  applies_to: string;
  /** Window duration, years component (0 = undeclared). */
  windowYears: number;
  /** Window duration, months component (0 = undeclared). */
  windowMonths: number;
  /** The state-machine action a breach fires ('' = none). */
  breach: string;
  description: string;
}

/** The eight step kinds of the v3 step vocabulary. */
export type ProcessStepKind =
  | 'action'
  | 'approval'
  | 'gateway'
  | 'parallel_gateway'
  | 'start_event'
  | 'end_event'
  | 'timer_event'
  | 'signal_event';

/**
 * One signature binding of a subprocess call (TODO.roadmap/38): the callee
 * signature parameter `param` binds to the caller-side register/parameter
 * `bind`. `callIn` bindings feed the callee's IN parameters (the caller
 * name is READ); `callOut` mappings return the callee's OUT parameters
 * (the caller name is WRITTEN). The linter (C76
 * subprocess-signature-bound) checks completeness and kind compatibility;
 * the caller-side names join the step's I/O for C12/C13/C75.
 */
export interface ProcessCallBinding {
  /** Callee signature parameter name. */
  param: string;
  /** Caller-side register/parameter name it binds to. */
  bind: string;
}

/**
 * One step of an executable process.
 *
 * Executor typing (`executor`):
 *   - 'machine' — the engine runs the step (OCL evaluation, gateway
 *     resolution, waits, register writes);
 *   - 'actor' — a role performs the step; actor steps are RECORDED, not
 *     run: `role` binds the performing role and `capture` binds the form
 *     through which the step's outputs land in evidence;
 *   - '' — untyped (events; or the author didn't declare one).
 *
 * Step I/O (`reads`/`writes`/`wait`, plus the caller-side names of a
 * call's `with` bindings) names registers and signature parameters — the
 * linter (C12/C13) checks those names resolve and that the step set
 * realizes the process signature.
 */
export interface ProcessStep {
  id: string;
  kind: ProcessStepKind;
  executor: 'machine' | 'actor' | '';
  /** Actor steps: the bound role id. */
  role: string;
  /** Actor steps: the capture form id through which outputs are recorded. */
  capture: string;
  /** Register/parameter names the step reads. */
  reads: string[];
  /** Register/parameter names the step writes. */
  writes: string[];
  /**
   * `wait <name>` — a machine hold on a duration register/parameter.
   * Counts as a read for the linter (C12/C13).
   */
  wait: string;
  /** timer_event: ISO-8601 recurrence period (e.g. "P12M"). */
  period: string;
  /** signal_event: name of the external trigger that starts/resumes. */
  signal: string;
  /**
   * `fires <transition>` (TODO.roadmap/07): when the step COMPLETES, the
   * process's bound state machine (`state <machineRef>`) takes the named
   * transition (identified by its action name). The fired sequence lands
   * in the run's state trajectory (see src/operational-state.ts).
   */
  fires: string;
  /**
   * `calls <process>` (TODO.roadmap/38): the step invokes a sub-process.
   * When the callee declares a signature, `callIn`/`callOut` bind it —
   * every IN parameter bound from a caller register, every OUT parameter
   * mapped back to a caller register (`calls <p> { with { in {…} out {…} } }`).
   * '' = not a call step.
   */
  calls: string;
  /** IN bindings of the call (callee param ← caller name; the caller READS). */
  callIn: ProcessCallBinding[];
  /** OUT mappings of the call (callee param → caller name; the caller WRITES). */
  callOut: ProcessCallBinding[];
  description: string;
}

/**
 * A flow edge between two steps of the same `does` body.
 *
 * Connection semantics (three rules only):
 *   1. serial — `A -> B`: do A, then B;
 *   2. parallel — two unconditioned paths: both, in any order;
 *   3. self-loop + timer — repeat with a period (recurrence).
 *
 * `condition` is an OCL Boolean over declared registers ('' = the
 * unconditioned/default edge). On a gateway's outgoing edges the first
 * satisfied condition in document order wins; the unconditioned edge
 * catches the rest.
 */
export interface ProcessFlowEdge {
  from: string;
  to: string;
  condition: string;
}

/**
 * The executable body (the DOES of the process). Its PRESENCE is what
 * marks a process executable — `does: null` is the abstract form.
 */
export interface ProcessFlow {
  steps: ProcessStep[];
  edges: ProcessFlowEdge[];
}

export default interface Process {
  id: string;
  name: string;
  modality: string;
  actor: Role | null;
  output: Registry[];
  input: Registry[];
  provision: Provision[];
  /**
   * The raw `validate_provision { … }` ids, exactly as authored. Unlike
   * `provision` (which holds only ids that resolved to declared
   * `provision` constructs), this list never loses a reference: OIML
   * SMART packages point validate_provision at REQUIREMENT ids
   * (`/req/cs/*` provisions — verified by the process, never by a
   * conformance test), which the provision resolver cannot see. The
   * linter reads this list (a provision'd requirement is covered, C5);
   * the dumper emits it, so an unresolvable reference survives the
   * load → dump round-trip instead of being silently dropped.
   */
  provisionRefs: string[];
  page: Subprocess | null;
  measure: string[];
  parent: string;
  children: string[];

  // ── Primmel v3 process model (TODO.roadmap/02) — all optional; a
  // process declaring none of these is exactly the v2 process. ──

  /** IS: the I/O signature (null = undeclared). A signature parameter's
   *  type token is OPTIONAL (smart TODO.roadmap/40 batch 2): a bare name
   *  is an untyped entity-store reference — the abstract-process model's
   *  signatures quantify over record stores, not quantity kinds. */
  signature: ProcessSignature | null;
  /** IS: OCL invariants over the signature and registers. */
  invariants: string[];
  /**
   * IS: ISO/IEC 17000 activity-kind ids classifying this process in the
   * functional approach (TODO.roadmap/39) — an abstract process may be
   * tagged with several kinds (ISO/IEC 17065 §7.4 "evaluation" =
   * selection + determination). Classification, not inheritance; the ids
   * resolve against a declared activity_archetype register when one is in
   * scope (C58 activity-kind-resolves).
   */
  activityKinds: string[];
  /**
   * IS: role-segregation constraints (TODO.roadmap/39b — the ISO/IEC
   * 17065 non-involvement rules: review/decision personnel disjoint from
   * evaluation personnel, complaint-resolution independence, consultancy
   * bars). First-class machine-checkable declarations, not invariants;
   * the linter (C59 segregation-members-resolve) checks well-formedness,
   * per-assignment enforcement is the runtime's business.
   */
  segregation: SegregationEntry[];
  /**
   * IS: OCL Boolean guards on entry. A violated precondition voids the
   * run AS A RUN (verdicts `invalid`, never `fail`); the language carries
   * the declaration, the runtime evaluates it.
   */
  preconditions: TestPrecondition[];
  /** IS: default executor — a role id, or the literal `machine`. */
  executor: string;
  /** HAS: typed registers the steps read and write. */
  registers: ProcessParameter[];
  /** HAS: the process's state machine reference. */
  state: string;
  /**
   * Per-classification instance parameters keyed by a subject dimension
   * (R 60: n_runs = 5 for accuracy classes A/B, 3 for C/D). Shared shape
   * with conformance-test instances: TestInstances.
   */
  instances: TestInstances | null;
  /**
   * Child composition for the coverage calculus (TODO.roadmap/04): how
   * this process's declared CHILDREN combine into its own fulfilment —
   * `all` (default): every child is required (serial/parallel semantics);
   * `gateway`: the children are exclusive branches and the gateway minimum
   * (at least one branch) suffices for minimal cover. Coverage aggregation
   * walks the parent/children tree (concept doc §5.3).
   */
  childComposition: 'all' | 'gateway';
  /** DOES: the executable body. null = abstract process (always valid). */
  does: ProcessFlow | null;

  // ── The abstract-process model (smart TODO.roadmap/40 batch 2 — the
  // OIML-CS / CASCO evaluation pipelines) — all optional; an abstract
  // process declaring none of these is exactly the batch-1 form. ──

  /** IS: the one-paragraph functional summary of the abstract process. */
  summary: string;
  /**
   * IS: the role ids bound to the process's performance (YAML `roles:`).
   * Kept DISTINCT from `executor` (the typing token actor|machine):
   * multi-role processes exist, so the binding list never collapses into
   * the executor token. Resolve against the role register at check time
   * (C121).
   */
  roles: string[];
  /** IS: the governance_organ ids acting in the process (C121). */
  organs: string[];
  /** IS: the participant_kind ids acting in the process (C121). */
  participantKinds: string[];
  /** HAS: the evidence-record slots the process's run must produce. */
  evidence: EvidenceEntry[];
  /** IS: the decision facet — the framework decision_rule applied. */
  decision: ProcessDecision | null;
  /** IS: the declaration facet — the Declaration signed/updated. */
  declaration: ProcessDeclaration | null;
  /** The declaration_gate this process discharges ('' = none; C121). */
  dischargesGate: string;
  /** The concrete processes realizing this abstract one (documentary). */
  realizedBy: string[];
  /** The approvals authorizing the process's outcome (documentary). */
  approvedBy: string[];
  /** HAS: the calendar windows constraining the process's records. */
  windows: ProcessWindow[];

  /**
   * Clause-URN provenance (the same facet requirement/provision carry):
   * `source { doc "urn:…" clause "…" [fragment "…"] }`. null = undeclared.
   */
  source: SourceRef | null;
  /**
   * Repeated `source { … }` blocks collect here (TODO.roadmap/24);
   * `source` stays the first entry for back-compatibility.
   */
  sourceRefs?: SourceRef[];
  /** The unified typed references (docs/primmel/18) — semantic
   *  predicates stay here; citation kinds fold onto source/referenceIds. */
  refs?: import('./Ref').Ref[];
  /** The correspondence annotations (MN 114 v3.1, clause 19.4). */
  correspondences?: import('./Correspondence').Correspondence[];
}

export type ResolvableProcess = Resolvable<
  Process,
  'actor' | 'output' | 'input' | 'provision' | 'page'
>;
