import Resolvable from './Resolvable';

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
  initialState: string;
  states: StateMachineState[];
  transitions: Transition[];
  referenceIds: string[];
}

export default StateMachine;

export type ResolvableStateMachine = Resolvable<StateMachine, never>;
