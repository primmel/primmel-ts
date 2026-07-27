import type Approval from './Approval';
import type Calculation from './Calculation';
import type CompetenceKind from './CompetenceKind';
import type ConformanceTest from './ConformanceTest';
import type Constraint from './Constraint';
import type DiscrepancyRecord from './DiscrepancyRecord';
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
  Subject,
} from './Subject';
import type { ArtifactDefinition, ArtifactInstance } from './Artifact';
import type { ConnectorProfile } from './Twin';
import type { Monitor } from './Monitor';
import type { Passport } from './Passport';
import type { Invariant } from './Invariant';
import type ActivityArchetype from './ActivityArchetype';
import type { Instance } from './Instance';
import type { Dual, QuantityRegister } from './Quantity';
import type ReferenceMaterial from './ReferenceMaterial';
import type { Requirement, RequirementClass } from './Requirement';
import type { ConformanceClass } from './ConformanceClass';
import type { PackageManifest } from './Package';
import type Subform from './Subform';
import type Symbol from './Symbol';
import type Table from './Table';
import type Term from './Term';
import type TestPointSet from './TestPointSet';
import type TextContent from './Text';
import type Verdict from './Verdict';
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
  /** Canonical verdict quantities (derive once, reference everywhere). */
  verdicts: Verdict[];
  /** Certified reference materials with machine-checked constraints. */
  referenceMaterials: ReferenceMaterial[];
  /** Named shared test-point sets referenced by conformance tests. */
  testPointSets: TestPointSet[];
  /** Laboratory testing-competence kind registry (TODO.roadmap/48) — the
   *  vocabulary of conformance-test required_competence and laboratory
   *  accreditation_scope entries. */
  competenceKinds: CompetenceKind[];
  /** Domain constraints (TODO.roadmap/51 — BUG.R60-SSOT gap 7): the
   *  subject's own intrinsic validity rules (stereotype «inv») — the
   *  Recommendation-level counterpart of the metamodel invariants. */
  constraints: Constraint[];
  /** Corpus-level source-discrepancy records (TODO.roadmap/54 — gap 13's
   *  corpus-level extension of the source_discrepancy facet): conflicts
   *  between source fragments that no model node owns (document-vs-
   *  document) — the corpus's errata memory. */
  discrepancyRecords: DiscrepancyRecord[];
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

  // Primmel v3 subject anatomy (is/has/does — TODO.roadmap/01)
  subjects: Subject[];

  // Primmel v3 instantiation (TODO.roadmap/03): the instance plane —
  // instances of subject definitions, chained family → group → model →
  // sample with INV-10 delegation semantics (src/instance-resolution.ts).
  instances: Instance[];

  // Primmel v3 artifacts (TODO.roadmap/09): required output artifacts of
  // the subject — definitions (IS: content contract + produced-when) and
  // produced instances (HAS/evidence, checked against the contract).
  artifactDefinitions: ArtifactDefinition[];
  artifactInstances: ArtifactInstance[];

  // Primmel v3 quantities/time/duality (TODO.roadmap/06): typed
  // unit/quantity-kind registers and IS↔HAS dual pairs.
  quantityRegisters: QuantityRegister[];
  duals: Dual[];

  // Primmel v3 ISO/IEC 17000 activity taxonomy (TODO.roadmap/39): the
  // classifiable activity-kind register a process's `activity_kind`
  // classification facet resolves against (C58).
  activityArchetypes: ActivityArchetype[];

  // Primmel v3 twin interface (TODO.roadmap/32 — doctrine ch. 14 §14.4):
  // the OCP-extensible connector-profile registry. Endpoints and serve
  // bindings themselves live on the subject anatomy (is.endpoints /
  // has.serves, types/Subject.ts).
  connectorProfiles: ConnectorProfile[];

  // Primmel v3 continuous compliance (TODO.roadmap/34 — doctrine ch. 14
  // §14.5): the monitor constructs — triggers, evaluation refs, evidence
  // sinks, escalation — running the standard next to the live twins.
  monitors: Monitor[];

  // Primmel v3 model-native DPP (TODO.roadmap/35 — doctrine ch. 14 §14.6,
  // ch. 15 §15.6): the passport constructs — named, access-classed
  // projections of the product model + live instance state, declared on
  // product reference packages.
  passports: Passport[];

  // The architecture invariants (smart gap-close E9,
  // analysis/architecture-gaps-2026-07.md): named platform invariants
  // with severity + enforcement claims — the first-class replacement
  // for the note-family encoding, a sibling collection of `notes`.
  invariants: Invariant[];

  // Primmel v3 ISO 24229 multilinguality (TODO.roadmap/25 — doctrine
  // ch. 10): per-spelling alternate values of prose fields, addressed
  // `<element-id>.<field>`; the default spelling's value stays inline on
  // the element (the package manifest's `default_spelling`).
  texts: TextContent[];

  root: Subprocess | null;
}
