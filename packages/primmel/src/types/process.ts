import { Resolvable } from './Resolvable';
import { Registry } from './data';
import { Subprocess } from './flow';
import type { TestInstances, TestPrecondition } from './ConformanceTest';
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
}

/** Process I/O signature: what the process consumes (IN) and produces (OUT). */
export interface ProcessSignature {
  inputs: ProcessParameter[];
  outputs: ProcessParameter[];
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
 * Step I/O (`reads`/`writes`/`wait`) names registers and signature
 * parameters — the linter (C12/C13) checks those names resolve and that
 * the step set realizes the process signature.
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

  /** IS: the I/O signature (null = undeclared). */
  signature: ProcessSignature | null;
  /** IS: OCL invariants over the signature and registers. */
  invariants: string[];
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
}

export type ResolvableProcess = Resolvable<
  Process,
  'actor' | 'output' | 'input' | 'provision' | 'page'
>;
