import Resolvable from './Resolvable';

/**
 * The two state-machine families (TODO.roadmap/07, doctrine ch. 04 §4.5):
 *   - lifecycle — the workflow family: machines bound to workflow ENTITIES
 *     (an application's draft → submitted → under_review → … chain). This
 *     is the v2 default; a machine without a `kind` line is lifecycle.
 *   - operational — the instrument family: the subject's HAS state (the
 *     off → warming → ready → measuring → fault chain), bound to a subject
 *     via `has.state` and operated on by process steps via `fires`.
 * The families are strictly disjoint: the linter (C38
 * state-family-separation) rejects every cross-reference between them.
 */
export type StateMachineKind = 'lifecycle' | 'operational';

export interface StateMachineState {
  name: string;
}

export interface CascadeSet {
  field: string;
  value: string;
}

/**
 * The closed workflow side-effect vocabulary (smart repo task 52,
 * BUG.R60-SSOT.md gap 12): a cascade carrying an `action` is a SEMANTIC
 * side-effect — the runtime dispatches it to a named handler. The
 * vocabulary is deliberately small and closed: new actions are new
 * handlers, not branches (OCP). A cascade without an `action` is the
 * mechanical v2-G10 form (set/create field updates).
 */
export type CascadeAction = 'lock' | 'submit' | 'notify' | 'record';

export const CASCADE_ACTIONS: readonly CascadeAction[] = [
  'lock',
  'submit',
  'notify',
  'record',
];

export interface Cascade {
  /** Semantic side-effect action (task 52); null for the mechanical form. */
  action: CascadeAction | null;
  targetEntity: string;
  where: string;
  /**
   * The machine-routing facet (smart gap-close E12,
   * analysis/cascade-machine-routing-design.md §4): the transition action
   * of the TARGET entity's machine the status write routes through.
   * Required on a status-writing step (a mechanical `set` containing
   * `status`, or a semantic `submit`/`lock`) whose target declares a
   * machine — self-steps excepted; forbidden everywhere else (C95
   * cascade-transition-resolve owns the contract). '' when absent.
   */
  via: string;
  /** Action-cascade parameters (the `with { … }` block). */
  with: Record<string, string>;
  set: CascadeSet[];
  /** Create-a-record cascade (v2 G10); null for plain set cascades. */
  create: Record<string, string> | null;
}

export interface Transition {
  from: string;
  to: string;
  actionName: string;
  guard: string;
  cascades: Cascade[];
  referenceIds: string[];
}

/**
 * A state machine describes the lifecycle of an entity: states, transitions
 * between them, and declarative side-effects (cascades) that fire on
 * transitions.
 *
 * See Primmel spec MN 113-10 §2 (State machine syntax).
 */
interface StateMachine {
  // Matches the entity (data class) name this machine is bound to
  entityName: string;
  /**
   * The machine family (TODO.roadmap/07): 'lifecycle' (default — workflow
   * entities) or 'operational' (a subject's HAS state machine).
   */
  kind: StateMachineKind;
  initialState: string;
  states: StateMachineState[];
  transitions: Transition[];
  referenceIds: string[];
}

export default StateMachine;

export type ResolvableStateMachine = Resolvable<StateMachine, never>;
