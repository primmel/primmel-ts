import { Resolvable } from './Resolvable';
import { Registry } from './data';
import { Subprocess } from './flow';
import Provision from './Provision';
import Role from './Role';

export default interface Process {
  // extends Node?
  id: string;
  name: string;
  modality: string;
  actor: Role | null;
  output: Registry[];
  input: Registry[];
  provision: Provision[];
  page: Subprocess | null;
  measure: string[];
}

export type ResolvableProcess = Resolvable<
  Process,
  'actor' | 'output' | 'input' | 'provision' | 'page'
>;
