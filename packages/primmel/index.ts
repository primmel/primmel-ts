// Package entry point — re-exports the public API
export {
  load,
  loadFile,
  loadWithIssues,
  loadFileWithIssues,
  dump,
  validate,
  loadPackage,
  packageFiles,
  dumpPackage,
  type LoadOptions,
  type LoadResult,
  type ValidationIssue,
  type ValidationSeverity,
  type Position,
} from './src/ser-des/index';
export type { default as Standard } from './src/types/Standard';
export type { PackageManifest, PackageSource } from './src/types/Package';
export type { EditionStatus, EditionValidity } from './src/types/Package';
export type { default as Metadata } from './src/types/Metadata';
export type { default as Role } from './src/types/Role';
export type { default as Provision } from './src/types/Provision';
export type { default as Process } from './src/types/process';
export type { default as Reference } from './src/types/Reference';
export type { default as Approval } from './src/types/Approval';
export type { default as Gateway } from './src/types/Gateway';
export type { default as EventNode } from './src/types/events';
export type {
  DataClass,
  DataAttribute,
  Registry,
  Enum,
  Variable,
} from './src/types/data';
export type { default as Note, NoteType } from './src/types/Note';
export type { default as Table } from './src/types/Table';
export type { default as Figure } from './src/types/Figure';
export type { default as Link } from './src/types/Link';
export type { default as MapProfile } from './src/types/MapProfile';
export type { CoverageLevel, MappingPair } from './src/types/MapProfile';
export type { default as ViewProfile } from './src/types/ViewProfile';
export {
  loadPrm,
  dumpPrm,
  prmToMapProfiles,
  mapProfilesToPrm,
  type PrmFile,
  type PrmMapSetEntry,
  type PrmPairMeta,
} from './src/ser-des/prm';
export {
  parseTargetRef,
  mappingsFromProfile,
  collectMappings,
  buildProcessTree,
  computeCoverage,
  discoverTransitive,
  repoMap,
  applyView,
  componentIds,
  type MappingRecord,
  type TargetRef,
  type ProcessTreeNode,
  type ComponentCoverage,
  type DiscoveryProposal,
  type CoverageSummary,
  type CoverageReport,
  type UnresolvedMapping,
  type ModelMappings,
  type RepoMapEdge,
  type ViewProjection,
} from './src/mapping-coverage';
export { checkPackage, type CheckIssue, type CheckOptions } from './src/check';
export {
  exportPackageReqif,
  exportStandardReqif,
  reqifModality,
  requirementClassOf,
  xmlCommentSafe,
  REQIF_MODALITY_BY_OBLIGATION,
  REQIF_NAMESPACE,
  REQIF_VERSION,
  type ReqifExport,
  type ReqifExportOptions,
  type ReqifExportStats,
} from './src/export/reqif';
export {
  exportPackageRdf,
  exportStandardRdf,
  rdfRequirementClassOf,
  rdfSlug,
  turtleEscape,
  type RdfExport,
  type RdfExportFormat,
  type RdfExportStats,
  type RdfObject,
  type RdfTriple,
} from './src/export/rdf';
export {
  RDF_PROVISION_CLASS_BY_OBLIGATION,
  rdfObligationToken,
  rdfProvisionClass,
  PRIMMEL_NS,
  SMART_NS,
} from './src/export/rdf-vocabulary';
export { RDF_EXPORT_SHAPES_TTL } from './src/export/rdf-shapes';
export {
  RDF_COMPETENCY_QUESTIONS,
  type RdfCompetencyQuestion,
} from './src/export/rdf-competency-questions';
export {
  canonical,
  clauseTextKey,
  diffStandards,
  elementIndex,
  formatDiffReport,
  normalizeSourceRef,
  TIER_BY_FIELD,
  TIER_ORDER,
  type ChangeEntry,
  type ClauseDriftKind,
  type ClauseDriftRow,
  type ClauseTextIndex,
  type CoverageDeltaEntry,
  type DiffElement,
  type DiffEntry,
  type MappingDiff,
  type MappingPairChange,
  type ModelDiff,
  type ModelDiffOptions,
  type MoveEntry,
  type NormalizedSourceRef,
  type TierName,
  type TierTally,
} from './src/model-diff';
export {
  diffPackageDirs,
  packageClauseTexts,
  packageMappings,
  type PackageDiffOptions,
  type PackageDiffResult,
} from './src/package-diff';
export {
  CHECK_RULES,
  checkRule,
  activeRuleIds,
  type CheckRule,
  type CheckFamily,
  type CheckLevel,
} from './src/check-rules';
export {
  ALLOWLIST_FILENAME,
  loadAllowlist,
  applyAllowlist,
  type AllowlistEntry,
  type PackageAllowlist,
} from './src/check-allowlist';
export type {
  default as Form,
  FormField,
  PassFail,
  ApplicabilityEntry,
} from './src/types/Form';
export type { default as Subform, ParameterDecl } from './src/types/Subform';
export type { default as Symbol, SymbolType } from './src/types/Symbol';
export type {
  default as Calculation,
  CalculationInput,
  CalculationOutput,
} from './src/types/Calculation';
export type {
  default as StateMachine,
  StateMachineKind,
  Transition,
  Cascade,
} from './src/types/StateMachine';
export {
  StateTrajectoryError,
  evaluateStateGate,
  extractStateGates,
  foldTrajectory,
  type FiredStep,
  type StateGate,
  type StateGateOutcome,
  type StateGateResult,
  type StateGateViolation,
  type StateTrajectory,
  type StateTrajectoryEntry,
} from './src/operational-state';
export type { default as Term } from './src/types/Term';
export type {
  Instance,
  InstanceHas,
  InstanceValue,
  ChainLevel,
} from './src/types/Instance';
export type {
  ArtifactDefinition,
  ArtifactInstance,
  ArtifactContentContract,
  ArtifactField,
  ArtifactMedia,
  ProducedWhen,
} from './src/types/Artifact';
export type {
  ConnectorProfile,
  Endpoint,
  EndpointAccessScope,
  EndpointOperation,
  EndpointOperationKind,
  EndpointPayload,
  ServeBinding,
} from './src/types/Twin';
export {
  BUILTIN_CONNECTOR_PROFILES,
  ENDPOINT_ACCESS_SCOPES,
  ENDPOINT_OPERATION_KINDS,
} from './src/types/Twin';
export type {
  Passport,
  PassportCarrier,
  PassportContentEntry,
  PassportUpi,
  PassportAccessClass,
  PassportContentClass,
  PassportUpiLevel,
} from './src/types/Passport';
export {
  PASSPORT_ACCESS_CLASSES,
  PASSPORT_CONTENT_CLASSES,
  PASSPORT_UPI_LEVELS,
} from './src/types/Passport';
export {
  InstanceResolutionError,
  instanceChain,
  parseInstancePath,
  resolveInstanceAttributes,
  resolveInstanceClassification,
  resolveInstanceValue,
  type InstanceArea,
  type InstancePath,
  type ResolutionErrorKind,
} from './src/instance-resolution';
export type {
  QuantityValue,
  QuantityKindDef,
  UnitDef,
  QuantityRegister,
  Dual,
} from './src/types/Quantity';
export type {
  IsoDate,
  IsoDateTime,
  IsoDuration,
  IsoPeriod,
  ValidityWindow,
  EditionPin,
} from './src/types/Time';
export {
  isDate,
  isDateTime,
  isDuration,
  isPeriod,
  isValidTimeValue,
  checkValidityWindow,
  editionPins,
  parseFreshnessWindow,
  timeInstantMs,
} from './src/time';
export {
  parseTypeExpression,
  isWellFormedMapType,
  PRIMITIVE_TYPES,
  type TypeExpr,
} from './src/type-expr';
