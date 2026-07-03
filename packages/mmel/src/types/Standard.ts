import type Approval from './Approval';
import type { DataClass, Enum, Registry, Variable } from './data';
import EventNode from './events';
import type Figure from './Figure';
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

  root: Subprocess | null;
}
