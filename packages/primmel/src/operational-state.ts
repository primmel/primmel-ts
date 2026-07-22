// ─────────────────────────────────────────────────────────────────────
// Operational state machines (Primmel v3, TODO.roadmap/07) — the
// language-level executable semantics of the subject's HAS state.
//
// The instrument's operational state (off → warming → ready → measuring →
// fault) is a first-class HAS aspect: a `state_machine` typed
// `kind operational`, bound to a subject via `has.state`, driven by
// process steps via `fires`, and gated on by run-validity preconditions
// (`self.state = #ready`).
//
// Two helpers live here:
//
//   evaluateStateGate — classify a process's state-gate preconditions
//     against the machine's CURRENT node: ok | invalid. A violated state
//     gate yields `invalid`, NEVER `fail`: the gate is a run-validity
//     rule, not a conformity criterion. An unwarmed instrument has not
//     been measured against its limits at all — recording `fail` would
//     state a conformity verdict the instrument never earned, and the
//     evidence of a void run would be mistaken for a measurement (the
//     R 144 warm-up and R 91 "no measurement if image quality
//     insufficient" patterns; doctrine ch. 04 §4.5).
//
//     Conjunction boundary: ALL extracted gates are conjoined — every
//     gate must hold for the run to proceed. Multiple positive equality
//     gates on the same subject-machine (`self.state = #ready or
//     self.state = #measuring` in one check) are therefore contradictory
//     unless the machine allows simultaneous states, and classify
//     permanently invalid — silently, by verdict only. Callers wanting
//     OR semantics use one gate per process, or the negated form
//     (`self.state <> #fault`).
//
//   foldTrajectory — fold a sequence of completed steps (each possibly
//     `fires`-ing a transition) into the run's state trajectory: the
//     trace record that lands in evidence as the conditions log's
//     sibling (runtime storage is task 29's; the schema and the fold are
//     the language's).
//
// Both families share the state_machine ser-des, but the families are
// disjoint — cross-references are the linter's (C38), not this module's.
// ─────────────────────────────────────────────────────────────────────

import type StateMachine from './types/StateMachine';
import type { TestPrecondition } from './types/ConformanceTest';

// ── state gates in preconditions ─────────────────────────────────────

/** One `self.state <op> #literal` comparison found in a check expression. */
export interface StateGate {
  /** The state literal without the `#` sigil (e.g. `ready`). */
  state: string;
  /** True for `=`/`==` (current must equal), false for `<>`/`!=`. */
  positive: boolean;
}

// self.state = #ready / self.state == #ready / self.state <> #ready —
// and the mirrored `#ready = self.state` form. The comparison operators
// are ordered longest-first so `==` is never misread as two `=`.
// The mirrored NEGATED form (`#fault <> self.state`) is intentionally
// NOT extracted — write the forward form (`self.state <> #fault`).
const GATE_FORWARD =
  /\bself\.state\s*(<>|!=|==|=)\s*#([A-Za-z_][A-Za-z0-9_]*)/g;
const GATE_MIRRORED = /#([A-Za-z_][A-Za-z0-9_]*)\s*(==|=)\s*self\.state\b/g;

/**
 * Extract the state gates of a precondition check expression. Only
 * comparisons AGAINST `self.state` count — other `#literal` occurrences
 * (enum literals like `#fail` on an ordinary register) are not state
 * references and never gate.
 */
export function extractStateGates(check: string): StateGate[] {
  const gates: StateGate[] = [];
  for (const m of check.matchAll(GATE_FORWARD)) {
    gates.push({ state: m[2], positive: m[1] === '=' || m[1] === '==' });
  }
  for (const m of check.matchAll(GATE_MIRRORED)) {
    gates.push({ state: m[1], positive: true });
  }
  return gates;
}

/** A state gate the current node violates. */
export interface StateGateViolation {
  /** Id of the precondition carrying the violated gate. */
  preconditionId: string;
  /** The gated state literal (without `#`). */
  gate: string;
  /** The machine's current node at evaluation time. */
  actual: string;
  /** True when the gate was negated (`self.state <> #x`) and x matched. */
  negated: boolean;
}

/** The gate classification: the run proceeds, or it is void. */
export type StateGateOutcome = 'ok' | 'invalid';

export interface StateGateResult {
  outcome: StateGateOutcome;
  violations: StateGateViolation[];
}

/**
 * Classify a process's preconditions against the machine's current node.
 *
 * Preconditions without a `self.state` comparison are NOT state gates —
 * other engines evaluate them; they are ignored here. A gate holds by
 * node-name comparison; a current node the machine does not even DECLARE
 * is off-model (an impossible node asserts nothing), so it violates
 * every gate — positive or negated — rather than passing silently.
 *
 * Conjunction boundary: ALL extracted gates are conjoined — every gate
 * must hold. Multiple positive equality gates on the same
 * subject-machine (`self.state = #ready or self.state = #measuring` in
 * one check) are contradictory unless the machine allows simultaneous
 * states, and are therefore permanently invalid — silently, by verdict
 * only. Callers wanting OR semantics should use one gate per process,
 * or the negated form (`self.state <> #fault`).
 */
export function evaluateStateGate(
  machine: StateMachine,
  currentState: string,
  preconditions: TestPrecondition[],
): StateGateResult {
  const onModel = machine.states.some(s => s.name === currentState);
  const violations: StateGateViolation[] = [];
  for (const p of preconditions) {
    for (const g of extractStateGates(p.check)) {
      const holds =
        onModel &&
        (g.positive ? currentState === g.state : currentState !== g.state);
      if (!holds) {
        violations.push({
          preconditionId: p.id,
          gate: g.state,
          actual: currentState,
          negated: !g.positive,
        });
      }
    }
  }
  return { outcome: violations.length > 0 ? 'invalid' : 'ok', violations };
}

// ── the state trajectory ─────────────────────────────────────────────

/**
 * One entry of the state trajectory: the machine ENTERED `state` at `at`
 * because the step `firedBy` completed. The genesis entry (run start)
 * carries `firedBy: ''`.
 */
export interface StateTrajectoryEntry {
  state: string;
  /** ISO-8601 timestamp of the entry (run-trace time). */
  at: string;
  /** Id of the step whose completion fired the transition ('' = start). */
  firedBy: string;
}

/**
 * The state trajectory record of one run — the sequence of nodes the
 * machine entered, in order. Lands in the run's trace next to the
 * conditions log (doctrine ch. 04 §4.6); runtime storage is task 29's.
 */
export type StateTrajectory = StateTrajectoryEntry[];

/** A completed step, as the run trace records it for the fold. */
export interface FiredStep {
  id: string;
  /** The step's `fires` transition action (''/absent = no fire). */
  fires?: string;
  /** ISO-8601 completion timestamp. */
  at: string;
}

/**
 * Thrown when a step's `fires` cannot be taken: the machine declares no
 * transition with that action name, or none is enabled from the current
 * node. The linter (C37 state-fires-resolve) rules the first case out
 * statically; the second is a genuine run-trace inconsistency (the trace
 * claims a fire the machine could not take).
 */
export class StateTrajectoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateTrajectoryError';
  }
}

/**
 * Fold a sequence of completed steps into the run's state trajectory.
 *
 * Starts from the machine's initial node (`initial.at` = the run's start
 * timestamp — pass '' when the trace does not time the start) and takes
 * one transition per step that declares `fires`: the transition named by
 * its action, enabled when its `from` is the current node or the `*`
 * wildcard. Steps without `fires` leave the machine where it is.
 *
 * Replay semantics, three boundaries:
 *   - Transition GUARDS are not evaluated during replay: this is trace
 *     semantics — the trace asserts the fire happened, so a recorded
 *     fire is taken, not re-judged.
 *   - An explicit `initial.state` the machine does not declare is NOT
 *     validated here — the C-rules cover the declaration side; replay
 *     starts from the node as given.
 *   - Same-action ambiguity (several transitions sharing one action,
 *     enabled from the current node) resolves by FIRST match in
 *     declaration order.
 */
export function foldTrajectory(
  machine: StateMachine,
  initial: { state?: string; at: string },
  steps: FiredStep[],
): StateTrajectory {
  let current = initial.state ?? machine.initialState;
  const trajectory: StateTrajectory = [
    { state: current, at: initial.at, firedBy: '' },
  ];
  for (const step of steps) {
    if (!step.fires) {
      continue;
    }
    const candidates = machine.transitions.filter(
      t => t.actionName === step.fires,
    );
    if (candidates.length === 0) {
      throw new StateTrajectoryError(
        `step "${step.id}" fires "${step.fires}", which state machine "${machine.entityName}" does not declare as a transition action`,
      );
    }
    const enabled = candidates.find(t => t.from === current || t.from === '*');
    if (!enabled) {
      throw new StateTrajectoryError(
        `step "${step.id}" fires "${step.fires}", but state machine "${machine.entityName}" is in state "${current}" — no such transition is enabled (from: ${candidates.map(t => t.from).join(', ')})`,
      );
    }
    current = enabled.to;
    trajectory.push({ state: current, at: step.at, firedBy: step.id });
  }
  return trajectory;
}
