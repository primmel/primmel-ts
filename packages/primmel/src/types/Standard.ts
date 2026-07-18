import type Approval from './Approval';
import type Calculation from './Calculation';
import type ConformanceTest from './ConformanceTest';
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
import type {
  AttributeDefinition,
  Behavior,
  Capability,
  ConditionSet,
  Instrument,
} from './Subject';
import type { Requirement, RequirementClass } from './Requirement';
import type { ConformanceClass } from './ConformanceClass';
import type { PackageManifest } from './Package';
import type Subform from './Subform';
import type Symbol from './Symbol';
import type Table from './Table';
import type Term from './Term';
import type ViewProfile from './ViewProfile';

export default interface Standard {
  meta: Metadata;
  /** v2 package manifest — present when loaded from a package (loadPackage). */
  packageManifest?: PackageManifest | null;

  roles: Role[];
  provisions: Provision[];
  pages: Subprocess[];
  processes: Process[];
  dataclasses: DataClass[];
  regs: Registry[];
  events: EventNode[];
  gateways: Gateway[];
  references: Reference[];
  approvals: Approval[];
  enums: Enum[];
  variables: Variable[];

  // MMEL 0.1 constructs missing from earlier parser versions
  notes: Note[];
  tables: Table[];
  figures: Figure[];
  links: Link[];
  mapProfiles: MapProfile[];
  viewProfiles: ViewProfile[];

  // Primmel extensions (MN 113-6 to 113-10)
  terms: Term[];
  forms: Form[];
  subforms: Subform[];
  symbols: Symbol[];
  calculations: Calculation[];
  stateMachines: StateMachine[];
  conformanceTests: ConformanceTest[];
  conformanceClasses: ConformanceClass[];

  // Primmel v2 requirements (MN v2 §Requirement)
  requirements: Requirement[];
  requirementClasses: RequirementClass[];

  // Primmel v2 subject chain (MN v2 §Subject)
  instruments: Instrument[];
  attributeDefinitions: AttributeDefinition[];
  capabilities: Capability[];
  behaviors: Behavior[];
  conditionSets: ConditionSet[];

  root: Subprocess | null;
}
