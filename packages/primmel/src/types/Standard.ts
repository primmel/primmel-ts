import type Approval from './Approval';
import type Calculation from './Calculation';
import type { DataClass, Enum, Registry, Variable } from './data';
import EventNode from './events';
import type Figure from './Figure';
import type Form from './Form';
import type Gateway from './Gateway';
import type Link from './Link';
import type MapProfile from './MapProfile';
import type Metadata from './Metadata';
import type Note from './Note';
import type Process from './process';
import type { Subprocess } from './flow';
import type Provision from './Provision';
import type Reference from './Reference';
import type Role from './Role';
import type StateMachine from './StateMachine';
import type Subform from './Subform';
import type Symbol from './Symbol';
import type Table from './Table';
import type ViewProfile from './ViewProfile';

export default interface Standard {
  meta: Metadata;

  roles: Role[];
  provisions: Provision[];
  pages: Subprocess[];
  processes: Process[];
  dataclasses: DataClass[];
  regs: Registry[];
  events: EventNode[];
  gateways: Gateway[];
  refs: Reference[];
  approvals: Approval[];
  enums: Enum[];
  vars: Variable[];

  // MMEL 0.1 constructs missing from earlier parser versions
  notes: Note[];
  tables: Table[];
  figures: Figure[];
  links: Link[];
  mapProfiles: MapProfile[];
  viewProfiles: ViewProfile[];

  // Primmel extensions (MN 113-7 to 113-10)
  forms: Form[];
  subforms: Subform[];
  symbols: Symbol[];
  calculations: Calculation[];
  stateMachines: StateMachine[];

  root: Subprocess | null;
}
