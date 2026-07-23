import type Calculation from '../types/Calculation';
import type ConformanceTest from '../types/ConformanceTest';
import type { DataClass, Enum, Registry, Variable } from '../types/data';
import EventNode from '../types/events';
import type Figure from '../types/Figure';
import type Form from '../types/Form';
import type Gateway from '../types/Gateway';
import type Link from '../types/Link';
import type MapProfile from '../types/MapProfile';
import type Metadata from '../types/Metadata';
import type { ResolvableNote } from '../types/Note';
import type { ResolvableProcess } from '../types/process';
import type { ResolvableSubprocess } from '../types/flow';
import type { ResolvableProvision } from '../types/Provision';
import type { ResolvableApproval } from '../types/Approval';
import type Reference from '../types/Reference';
import type Role from '../types/Role';
import type Standard from '../types/Standard';
import type StateMachine from '../types/StateMachine';
import type {
  AttributeDefinition,
  Behavior,
  Capability,
  ConditionSet,
  Instrument,
  Subject,
} from '../types/Subject';
import type { ArtifactDefinition, ArtifactInstance } from '../types/Artifact';
import type { ConnectorProfile } from '../types/Twin';
import type ActivityArchetype from '../types/ActivityArchetype';
import type { Instance } from '../types/Instance';
import type { Dual, QuantityRegister } from '../types/Quantity';
import type { Requirement, RequirementClass } from '../types/Requirement';
import type { ConformanceClass } from '../types/ConformanceClass';
import type { PackageManifest } from '../types/Package';
import type ReferenceMaterial from '../types/ReferenceMaterial';
import type Subform from '../types/Subform';
import type Symbol from '../types/Symbol';
import type Table from '../types/Table';
import type Term from '../types/Term';
import type TestPointSet from '../types/TestPointSet';
import type Verdict from '../types/Verdict';
import type ViewProfile from '../types/ViewProfile';
import type { ParseIssue } from '../validate';

// Configuration

/* Maps an MMEL keyword to parser function.
 *
 * `field`, when set, declares which ParseContext collection this keyword
 * writes to. Used by parse() for duplicate-ID detection.
 */
export interface ParserConfiguration {
  [keyword: string]: {
    takesID?: true;
    parse: Parser;
    field?: keyof ParseContext;
  };
}

/* Maps an item type to corresponding resolver function. */
export type ResolverConfiguration = Partial<
  Record<
    keyof ParseContext,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolve: Resolver<any, any>;
    }
  >
>;

/* Maps a standard property to its per-item dumper. `meta` and `root` are
   intentionally excluded — they are singletons, not arrays, and dump()
   handles them explicitly at the top of the output. */
export type DumperConfiguration = {
  [key in keyof Omit<Standard, 'meta' | 'root' | 'packageManifest'>]: Dumper<
    Standard[key][number]
  >;
};

// Functions

/* Parser function takes tokens and returns a function that updates parse context.
   The number of tokens depends on takesID value in its ParserConfiguration entry. */
export type Parser<C = ParseContext> = (...tokens: string[]) => (ctx: C) => C;

/* Resolver function takes finalized parse context and an incomplete object,
   and replaces any references from the incomplete object with full referenced objects. */
export type Resolver<T, R, C = ParseContext> = (
  ctx: C,
  resolvableObject: R,
) => T;

/* Dumper function takes any structure and returns a string. */
export type Dumper<T> = (obj: T) => string;

// Helper types

/* Collects the entire standard state during initial parsing.
   Is updated by keyword parser functions,
   and later is used by object resolver functions. */
export interface ParseContext {
  root: string;
  metadata: Metadata | null;
  /** v2 package manifest (singleton, from `package { ... }`). */
  packageManifest: PackageManifest | null;
  roles: Record<string, Role>;

  approvals: Record<string, ResolvableApproval>;
  provisions: Record<string, ResolvableProvision>;
  processes: Record<string, ResolvableProcess>;
  pages: Record<string, ResolvableSubprocess>;

  // XXX: Make resolvable
  regs: Record<string, Registry>;
  references: Record<string, Reference>;
  dataclasses: Record<string, DataClass>;
  events: Record<string, EventNode>;
  enums: Record<string, Enum>;
  gateways: Record<string, Gateway>;
  variables: Record<string, Variable>;

  // MMEL 0.1 constructs missing from earlier parser versions
  notes: Record<string, ResolvableNote>;
  tables: Record<string, Table>;
  figures: Record<string, Figure>;
  links: Record<string, Link>;
  mapProfiles: Record<string, MapProfile>;
  viewProfiles: Record<string, ViewProfile>;

  // Primmel extensions (MN 113-6 to 113-10)
  terms: Record<string, Term>;
  forms: Record<string, Form>;
  subforms: Record<string, Subform>;
  symbols: Record<string, Symbol>;
  calculations: Record<string, Calculation>;
  verdicts: Record<string, Verdict>;
  referenceMaterials: Record<string, ReferenceMaterial>;
  testPointSets: Record<string, TestPointSet>;
  stateMachines: Record<string, StateMachine>;
  conformanceTests: Record<string, ConformanceTest>;
  conformanceClasses: Record<string, ConformanceClass>;

  // Primmel v2 requirements
  requirements: Record<string, Requirement>;
  requirementClasses: Record<string, RequirementClass>;

  // Primmel v2 subject chain
  instruments: Record<string, Instrument>;
  attributeDefinitions: Record<string, AttributeDefinition>;
  capabilities: Record<string, Capability>;
  behaviors: Record<string, Behavior>;
  conditionSets: Record<string, ConditionSet>;

  // Primmel v3 subject anatomy (is/has/does — TODO.roadmap/01)
  subjects: Record<string, Subject>;

  // Primmel v3 instantiation (TODO.roadmap/03)
  instances: Record<string, Instance>;

  // Primmel v3 artifacts (TODO.roadmap/09)
  artifactDefinitions: Record<string, ArtifactDefinition>;
  artifactInstances: Record<string, ArtifactInstance>;

  // Primmel v3 quantities/time/duality (TODO.roadmap/06)
  quantityRegisters: Record<string, QuantityRegister>;
  duals: Record<string, Dual>;

  // Primmel v3 ISO/IEC 17000 activity taxonomy (TODO.roadmap/39)
  activityArchetypes: Record<string, ActivityArchetype>;

  // Primmel v3 twin interface (TODO.roadmap/32): connector profiles.
  // Endpoints/serve bindings live on the subject (is.endpoints/has.serves).
  connectorProfiles: Record<string, ConnectorProfile>;

  // Issues collected during parsing (duplicate IDs, etc.). NOT a model
  // collection — populated by parse() and surfaced via loadWithIssues().
  issues: ParseIssue[];
}
