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

export interface Cascade {
  targetEntity: string;
  where: string;
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
