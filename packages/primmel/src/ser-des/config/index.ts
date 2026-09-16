// ─────────────────────────────────────────────────────────────────────
// Construct registration.
//
// Adding a new MMEL/Primmel construct used to require three separate
// registry edits (PARSER_CONFIG + RESOLVER_CONFIG + DUMPER_CONFIG), each
// with its own boilerplate. `defineConstruct` collapses those into one
// declaration per construct: the three registries are derived from a
// single CONSTRUCTS array.
//
// To add `regulation`:
//   1. Add the field to Standard + ParseContext (types only — TS won't
//      let us infer these from a runtime call).
//   2. Add the field to the ctx initializer in ser-des/parse.ts (the
//      hard-coded ParseContext object — TS enforces this, but a cast or
//      a stale edit here silently breaks every parse).
//   3. Append one `defineConstruct(...)` entry to CONSTRUCTS below.
// Nothing else.
//
// Special cases (root, metadata) stay inline in PARSER_CONFIG because
// they don't fit the keyword/field/parse/resolve/dump shape — root is
// a string ID, metadata is a singleton.
// ─────────────────────────────────────────────────────────────────────

import type {
  DumperConfiguration,
  Parser,
  ParserConfiguration,
  Resolver,
  ResolverConfiguration,
} from '../types';
import type { ParseContext } from '../types';
import type Standard from '../../types/Standard';

import { dumpApproval, parseApproval, resolveApproval } from './approval';
import {
  dumpDataClass,
  dumpEnum,
  dumpRegistry,
  dumpVariable,
  parseDataClass,
  parseEnum,
  parseRegistry,
  parseVariable,
  resolveDataClass,
  resolveRegistry,
} from './data';
import {
  dumpEvent,
  parseEndEvent,
  parseSignalCatchEvent,
  parseStartEvent,
  parseTimerEvent,
} from './event';
import { dumpGateway, parseExclusiveGate } from './gateway';

import { parseMetadata } from './metadata';
import { dumpProcess, parseProcess, resolveProcess } from './process';
import { dumpProcessModel, parseProcessModel } from './processModel';
import { dumpProvision, parseProvision, resolveProvision } from './provision';
import { dumpReference, parseReference } from './reference';
import { dumpRole, parseRole } from './role';
import { dumpSubprocess, parseSubprocess, resolveSubprocess } from './flow';

// MMEL 0.1 spec-parity parsers/dumpers
import { dumpNote, parseNote, resolveNote } from './note';
import { dumpTable, parseTable } from './table';
import { dumpFigure, parseFigure } from './figure';
import { dumpLink, parseLink } from './link';
import { dumpComment, parseComment, resolveComment } from './comment';
import { dumpMapProfile, parseMapProfile } from './mapProfile';
import { dumpViewProfile, parseViewProfile } from './viewProfile';

// Primmel extension parsers/dumpers (MN 113-6 to 113-10)
import { dumpForm, parseForm } from './form';
import { dumpSubformType as dumpSubform, parseSubform } from './subform';
import { dumpSymbol, parseSymbol, resolveSymbol } from './symbol';
import { dumpFormulaNote, parseFormulaNote } from './formulaNote';
import {
  dumpCalculation,
  parseCalculation,
  resolveCalculation,
} from './calculation';
import { dumpStateMachine, parseStateMachine } from './stateMachine';
import { dumpConformanceTest, parseConformanceTest } from './conformanceTest';
import { dumpTerm, parseTerm } from './term';
import { dumpVerdict, parseVerdict } from './verdict';
import {
  dumpReferenceMaterial,
  parseReferenceMaterial,
} from './referenceMaterial';
import { dumpCompetenceKind, parseCompetenceKind } from './competenceKind';
import {
  dumpSchemeActivityKind,
  dumpSchemeType,
  parseSchemeActivityKind,
  parseSchemeType,
} from './schemeType';
import { dumpPredicate, parsePredicate } from './predicate';
import { dumpConstraint, parseConstraint } from './constraint';
import {
  dumpDiscrepancyRecord,
  parseDiscrepancyRecord,
} from './discrepancyRecord';
import { dumpTestPointSet, parseTestPointSet } from './testPointSet';
import {
  dumpCommonTestCondition,
  parseCommonTestCondition,
} from './commonTestCondition';
import { requirementConstruct, requirementClassConstruct } from './requirement';
import { parsePackage } from './packageManifest';
import { conformanceClassConstruct } from './conformanceClass';
import {
  instrumentConstruct,
  attributeDefinitionConstruct,
  capabilityConstruct,
  behaviorConstruct,
  conditionSetConstruct,
  subjectConstruct,
} from './subject';
import { instanceConstruct } from './instance';
import { dumpIdentitySlot, parseIdentitySlot } from './identitySlot';
import { dumpAspect, parseAspect } from './aspect';
import { dumpPromiseSet, parsePromiseSet } from './promiseSet';
import {
  dumpApplicationDeclaration,
  parseApplicationDeclaration,
} from './applicationDeclaration';
import {
  artifactDefinitionConstruct,
  artifactInstanceConstruct,
} from './artifact';
import { connectorProfileConstruct } from './twin';
import { monitorConstruct } from './monitor';
import { passportConstruct } from './passport';
import { invariantConstruct } from './invariant';
import { testSequenceConstruct } from './testSequence';
import { formulasUsedConstruct } from './formulasUsed';
import { parseText, dumpText } from './text';
import { quantityRegisterConstruct } from './quantityRegister';
import { dualConstruct } from './dual';
import { dataspaceConstruct } from './dataspace';
import { policyConstruct } from './policy';
import { dimensionConstruct } from './dimension';
import {
  dumpActivityArchetype,
  parseActivityArchetype,
} from './activityArchetype';
import { dumpParticipantKind, parseParticipantKind } from './participantKind';
import { dumpGovernanceOrgan, parseGovernanceOrgan } from './governanceOrgan';
import {
  dumpDeclarationGate,
  dumpDeclarationKind,
  dumpDeclarationStatus,
  parseDeclarationGate,
  parseDeclarationKind,
  parseDeclarationStatus,
} from './declaration';
import {
  dumpSchemeDefinition,
  dumpSchemeLifecycle,
  parseSchemeDefinition,
  parseSchemeLifecycle,
} from './scheme';
import {
  dumpAutoInclusion,
  dumpDocumentPrecedence,
  dumpFrameworkDocument,
  parseAutoInclusion,
  parseDocumentPrecedence,
  parseFrameworkDocument,
} from './frameworkDocument';
import { dumpDecisionRule, parseDecisionRule } from './decisionRule';
import { dumpDocumentModule, parseDocumentModule } from './documentModule';
import {
  dumpInformativeAnnex,
  parseInformativeAnnex,
} from './informativeAnnex';
import { dumpPartAnnex, parsePartAnnex } from './partAnnex';
import {
  dumpDemoWorld,
  dumpStoryline,
  parseDemoWorld,
  parseStoryline,
} from './storyline';

export interface ConstructDefinition {
  /** Primary keyword that triggers this parser (e.g. `role`, `process`). */
  keyword: string;
  /** Additional keywords that map to the same parser (e.g. event aliases). */
  aliases?: string[];
  /** ParseContext (and Standard) field name this construct populates. */
  field?: keyof ParseContext & keyof Standard;
  /** Parser function — receives (id, data) or (data) depending on takesID. */
  parse: Parser;
  /** Whether the keyword consumes an ID token before its payload. */
  takesID?: true;
  /** Optional resolver for constructs with cross-references. */
  resolve?: Resolver<unknown, unknown>;
  /** Per-item dumper. */
  dump: (item: never) => string;
}

/** Identity helper — exists so call sites read as declarations, not data. */
export function defineConstruct(def: ConstructDefinition): ConstructDefinition {
  return def;
}

// Order here is the order constructs appear in PARSER_CONFIG and
// DUMPER_CONFIG output. RESOLVER_CONFIG order is not load-bearing —
// resolveFromContext is pure (see ser-des/resolve.ts).
const CONSTRUCTS: ConstructDefinition[] = [
  defineConstruct({
    keyword: 'role',
    field: 'roles',
    takesID: true,
    parse: parseRole,
    dump: dumpRole as never,
  }),
  defineConstruct({
    keyword: 'provision',
    field: 'provisions',
    takesID: true,
    parse: parseProvision,
    resolve: resolveProvision as never,
    dump: dumpProvision as never,
  }),
  defineConstruct({
    keyword: 'process',
    field: 'processes',
    takesID: true,
    parse: parseProcess,
    resolve: resolveProcess as never,
    dump: dumpProcess as never,
  }),
  // The abstract-process model's file-level home (smart TODO.roadmap/40
  // batch 2): the pipeline sequence + the participant/expert registers.
  defineConstruct({
    keyword: 'process_model',
    field: 'processModels',
    takesID: true,
    parse: parseProcessModel,
    dump: dumpProcessModel as never,
  }),
  defineConstruct({
    keyword: 'approval',
    field: 'approvals',
    takesID: true,
    parse: parseApproval,
    resolve: resolveApproval as never,
    dump: dumpApproval as never,
  }),
  defineConstruct({
    keyword: 'class',
    field: 'dataclasses',
    takesID: true,
    parse: parseDataClass,
    resolve: resolveDataClass as never,
    dump: dumpDataClass as never,
  }),
  defineConstruct({
    keyword: 'enum',
    field: 'enums',
    takesID: true,
    parse: parseEnum,
    dump: dumpEnum as never,
  }),
  defineConstruct({
    keyword: 'data_registry',
    field: 'regs',
    takesID: true,
    parse: parseRegistry,
    resolve: resolveRegistry as never,
    dump: dumpRegistry as never,
  }),
  defineConstruct({
    keyword: 'variable',
    field: 'variables',
    takesID: true,
    parse: parseVariable,
    dump: dumpVariable as never,
  }),
  // `measurement` is the spec's canonical keyword (MN 113 §2.3); `variable`
  // is kept as the legacy alias — both feed ctx.variables (W1a).
  defineConstruct({
    keyword: 'measurement',
    field: 'variables',
    takesID: true,
    parse: parseVariable,
    dump: dumpVariable as never,
  }),
  defineConstruct({
    keyword: 'exclusive_gateway',
    field: 'gateways',
    takesID: true,
    parse: parseExclusiveGate,
    dump: dumpGateway as never,
  }),
  // Events: short (start/end) and full (start_event/end_event) keyword
  // forms both map to the same parser family.
  defineConstruct({
    keyword: 'start',
    aliases: ['start_event'],
    field: 'events',
    takesID: true,
    parse: parseStartEvent,
    dump: dumpEvent as never,
  }),
  defineConstruct({
    keyword: 'end',
    aliases: ['end_event'],
    field: 'events',
    takesID: true,
    parse: parseEndEvent,
    dump: dumpEvent as never,
  }),
  defineConstruct({
    keyword: 'signalcatch',
    aliases: ['signal_catch_event'],
    field: 'events',
    takesID: true,
    parse: parseSignalCatchEvent,
    dump: dumpEvent as never,
  }),
  defineConstruct({
    keyword: 'timer',
    aliases: ['timer_event'],
    field: 'events',
    takesID: true,
    parse: parseTimerEvent,
    dump: dumpEvent as never,
  }),
  defineConstruct({
    keyword: 'reference',
    field: 'references',
    takesID: true,
    parse: parseReference,
    dump: dumpReference as never,
  }),
  defineConstruct({
    keyword: 'canvas',
    aliases: ['subprocess'],
    field: 'pages',
    takesID: true,
    parse: parseSubprocess,
    resolve: resolveSubprocess as never,
    dump: dumpSubprocess as never,
  }),
  defineConstruct({
    keyword: 'note',
    field: 'notes',
    takesID: true,
    parse: parseNote,
    resolve: resolveNote as never,
    dump: dumpNote as never,
  }),
  defineConstruct({
    keyword: 'table',
    field: 'tables',
    takesID: true,
    parse: parseTable,
    dump: dumpTable as never,
  }),
  defineConstruct({
    keyword: 'figure',
    field: 'figures',
    takesID: true,
    parse: parseFigure,
    dump: dumpFigure as never,
  }),
  defineConstruct({
    keyword: 'link',
    field: 'links',
    takesID: true,
    parse: parseLink,
    dump: dumpLink as never,
  }),
  defineConstruct({
    keyword: 'comment',
    field: 'comments',
    takesID: true,
    parse: parseComment,
    resolve: resolveComment as never,
    dump: dumpComment as never,
  }),
  defineConstruct({
    keyword: 'map_profile',
    field: 'mapProfiles',
    takesID: true,
    parse: parseMapProfile,
    dump: dumpMapProfile as never,
  }),
  defineConstruct({
    keyword: 'view_profile',
    // `view` is the legacy (MMEL v2) spelling of the view-profile block.
    aliases: ['view'],
    field: 'viewProfiles',
    takesID: true,
    parse: parseViewProfile,
    dump: dumpViewProfile as never,
  }),
  // Primmel extensions (MN 113-6 to 113-10)
  defineConstruct({
    keyword: 'term',
    field: 'terms',
    takesID: true,
    parse: parseTerm,
    dump: dumpTerm as never,
  }),
  defineConstruct({
    keyword: 'form',
    field: 'forms',
    takesID: true,
    parse: parseForm,
    dump: dumpForm as never,
  }),
  defineConstruct({
    keyword: 'subform',
    field: 'subforms',
    takesID: true,
    parse: parseSubform,
    dump: dumpSubform as never,
  }),
  defineConstruct({
    keyword: 'symbol',
    field: 'symbols',
    takesID: true,
    parse: parseSymbol,
    resolve: resolveSymbol as never,
    dump: dumpSymbol as never,
  }),
  // The symbol-annotation register (smart TODO.roadmap/40 batch 4) —
  // one note text applying to many symbols; rides right after the
  // symbols in the dump order.
  defineConstruct({
    keyword: 'formula_note',
    field: 'formulaNotes',
    takesID: true,
    parse: parseFormulaNote,
    dump: dumpFormulaNote as never,
  }),
  defineConstruct({
    keyword: 'calculation',
    field: 'calculations',
    takesID: true,
    parse: parseCalculation,
    resolve: resolveCalculation as never,
    dump: dumpCalculation as never,
  }),
  defineConstruct({
    keyword: 'verdict',
    field: 'verdicts',
    takesID: true,
    parse: parseVerdict,
    dump: dumpVerdict as never,
  }),
  defineConstruct({
    keyword: 'reference_material',
    field: 'referenceMaterials',
    takesID: true,
    parse: parseReferenceMaterial,
    dump: dumpReferenceMaterial as never,
  }),
  defineConstruct({
    keyword: 'test_point_set',
    field: 'testPointSets',
    takesID: true,
    parse: parseTestPointSet,
    dump: dumpTestPointSet as never,
  }),
  // The model-wide common test-conditions register (smart
  // TODO.roadmap/40 batch 4) — one entry per condition; the citation
  // string stays free (the linker owns the citation semantics).
  defineConstruct({
    keyword: 'common_test_condition',
    field: 'commonTestConditions',
    takesID: true,
    parse: parseCommonTestCondition,
    dump: dumpCommonTestCondition as never,
  }),
  defineConstruct({
    keyword: 'competence_kind',
    field: 'competenceKinds',
    takesID: true,
    parse: parseCompetenceKind,
    dump: dumpCompetenceKind as never,
  }),
  // The ISO/IEC 17067 scheme-type register (smart TODO.roadmap/40 batch
  // 2): the Table-1 activity menus + the scheme types.
  defineConstruct({
    keyword: 'scheme_activity_kind',
    field: 'schemeActivityKinds',
    takesID: true,
    parse: parseSchemeActivityKind,
    dump: dumpSchemeActivityKind as never,
  }),
  defineConstruct({
    keyword: 'scheme_type',
    field: 'schemeTypes',
    takesID: true,
    parse: parseSchemeType,
    dump: dumpSchemeType as never,
  }),
  // The relation registry (docs/primmel/18): declared ref predicates.
  defineConstruct({
    keyword: 'predicate',
    field: 'predicates',
    takesID: true,
    parse: parsePredicate,
    dump: dumpPredicate as never,
  }),
  // Primmel v3 domain constraints (TODO.roadmap/51 — BUG.R60-SSOT gap 7)
  defineConstruct({
    keyword: 'constraint',
    field: 'constraints',
    takesID: true,
    parse: parseConstraint,
    dump: dumpConstraint as never,
  }),
  // Corpus-level source-discrepancy records (TODO.roadmap/54 — gap 13's
  // corpus-level extension of the source_discrepancy facet)
  defineConstruct({
    keyword: 'discrepancy_record',
    field: 'discrepancyRecords',
    takesID: true,
    parse: parseDiscrepancyRecord,
    dump: dumpDiscrepancyRecord as never,
  }),
  defineConstruct({
    keyword: 'state_machine',
    field: 'stateMachines',
    takesID: true,
    parse: parseStateMachine,
    dump: dumpStateMachine as never,
  }),
  // Primmel v2 requirements (G3)
  requirementConstruct as ConstructDefinition,
  requirementClassConstruct as ConstructDefinition,
  // Primmel v2 subject chain (G1)
  instrumentConstruct as ConstructDefinition,
  attributeDefinitionConstruct as ConstructDefinition,
  capabilityConstruct as ConstructDefinition,
  behaviorConstruct as ConstructDefinition,
  conditionSetConstruct as ConstructDefinition,
  conformanceClassConstruct as ConstructDefinition,
  defineConstruct({
    keyword: 'conformance_test',
    field: 'conformanceTests',
    takesID: true,
    parse: parseConformanceTest,
    dump: dumpConformanceTest as never,
  }),
  // Primmel v3 subject anatomy (is/has/does — TODO.roadmap/01)
  subjectConstruct as ConstructDefinition,
  // The documentary identity slots + the qualitative aspect register
  // (smart TODO.roadmap/40 batch 3; smart TODO.roadmap/47) — subject
  // anatomy beside the subjects they enrich.
  defineConstruct({
    keyword: 'identity_slot',
    field: 'identitySlots',
    takesID: true,
    parse: parseIdentitySlot,
    dump: dumpIdentitySlot as never,
  }),
  defineConstruct({
    keyword: 'aspect',
    field: 'aspects',
    takesID: true,
    parse: parseAspect,
    dump: dumpAspect as never,
  }),
  // The rec promise register (smart TODO.roadmap/40 batch 3) — the
  // file-grade home of the subject-promise sub-grammar (a subject's
  // is.promises cannot span files); the set id binds the owning subject.
  defineConstruct({
    keyword: 'promise_set',
    field: 'promiseSets',
    takesID: true,
    parse: parsePromiseSet,
    dump: dumpPromiseSet as never,
  }),
  // The applicant-facing documentation register (smart TODO.roadmap/40
  // batch 3) — singleton per rec; form-adjacent (the declaration_form
  // binds a form), NOT the Batch-1 CS participant-declaration machinery.
  defineConstruct({
    keyword: 'application_declaration',
    field: 'applicationDeclarations',
    takesID: true,
    parse: parseApplicationDeclaration,
    dump: dumpApplicationDeclaration as never,
  }),
  // Primmel v3 instantiation (instance-of, INV-10 — TODO.roadmap/03)
  instanceConstruct as ConstructDefinition,
  // Primmel v3 artifacts (TODO.roadmap/09)
  artifactDefinitionConstruct as ConstructDefinition,
  artifactInstanceConstruct as ConstructDefinition,
  // Primmel v3 quantities/time/duality (TODO.roadmap/06)
  quantityRegisterConstruct as ConstructDefinition,
  dualConstruct as ConstructDefinition,
  // Primmel v3 ISO/IEC 17000 activity taxonomy (TODO.roadmap/39)
  defineConstruct({
    keyword: 'activity_archetype',
    field: 'activityArchetypes',
    takesID: true,
    parse: parseActivityArchetype,
    dump: dumpActivityArchetype as never,
  }),
  // Primmel v3 certification-framework model (smart TODO.roadmap/40; the
  // packages-as-SSOT epic): the participant-kind register + the organs.
  defineConstruct({
    keyword: 'participant_kind',
    field: 'participantKinds',
    takesID: true,
    parse: parseParticipantKind,
    dump: dumpParticipantKind as never,
  }),
  defineConstruct({
    keyword: 'governance_organ',
    field: 'governanceOrgans',
    takesID: true,
    parse: parseGovernanceOrgan,
    dump: dumpGovernanceOrgan as never,
  }),
  // The framework's Declaration machinery (B 18:2025 §5.5–5.6; PD-08).
  defineConstruct({
    keyword: 'declaration_kind',
    field: 'declarationKinds',
    takesID: true,
    parse: parseDeclarationKind,
    dump: dumpDeclarationKind as never,
  }),
  defineConstruct({
    keyword: 'declaration_status',
    field: 'declarationStatuses',
    takesID: true,
    parse: parseDeclarationStatus,
    dump: dumpDeclarationStatus as never,
  }),
  defineConstruct({
    keyword: 'declaration_gate',
    field: 'declarationGates',
    takesID: true,
    parse: parseDeclarationGate,
    dump: dumpDeclarationGate as never,
  }),
  // The two-Scheme architecture (B 18:2025 3.37/3.38, §5.4) + the
  // per-category lifecycle machines (clause 15).
  defineConstruct({
    keyword: 'scheme_definition',
    field: 'schemeDefinitions',
    takesID: true,
    parse: parseSchemeDefinition,
    dump: dumpSchemeDefinition as never,
  }),
  defineConstruct({
    keyword: 'scheme_lifecycle',
    field: 'schemeLifecycles',
    takesID: true,
    parse: parseSchemeLifecycle,
    dump: dumpSchemeLifecycle as never,
  }),
  // The governing-document hierarchy (clause 6) + precedence + the §4.2
  // auto-inclusion blocks.
  defineConstruct({
    keyword: 'framework_document',
    field: 'frameworkDocuments',
    takesID: true,
    parse: parseFrameworkDocument,
    dump: dumpFrameworkDocument as never,
  }),
  defineConstruct({
    keyword: 'document_precedence',
    field: 'documentPrecedences',
    takesID: true,
    parse: parseDocumentPrecedence,
    dump: dumpDocumentPrecedence as never,
  }),
  defineConstruct({
    keyword: 'auto_inclusion',
    field: 'autoInclusions',
    takesID: true,
    parse: parseAutoInclusion,
    dump: dumpAutoInclusion as never,
  }),
  // The organs' decision rules (clauses 9–16).
  defineConstruct({
    keyword: 'decision_rule',
    field: 'decisionRules',
    takesID: true,
    parse: parseDecisionRule,
    dump: dumpDecisionRule as never,
  }),
  // The per-document content modules + the informative annexes (smart
  // TODO.roadmap/40 batch 2) — first-class what the directory convention
  // carried; the declared namespace pin C119 prefers.
  defineConstruct({
    keyword: 'document_module',
    field: 'documentModules',
    takesID: true,
    parse: parseDocumentModule,
    dump: dumpDocumentModule as never,
  }),
  defineConstruct({
    keyword: 'informative_annex',
    field: 'informativeAnnexes',
    takesID: true,
    parse: parseInformativeAnnex,
    dump: dumpInformativeAnnex as never,
  }),
  // The rec's own annex-volume index (smart TODO.roadmap/40 batch 4) —
  // NOT the external-guidance informative_annex; the normative/
  // informative obligation mark is the register's point.
  defineConstruct({
    keyword: 'part_annex',
    field: 'partAnnexes',
    takesID: true,
    parse: parsePartAnnex,
    dump: dumpPartAnnex as never,
  }),
  // The demo seeds (smart TODO.roadmap/40 batch 4) — one demo_world per
  // package (file-level metadata + the OPEN participants registry) and
  // one storyline per flow; the record-value sub-grammar follows the
  // quantity.ts dumpScalarToken conventions.
  defineConstruct({
    keyword: 'demo_world',
    field: 'demoWorlds',
    takesID: true,
    parse: parseDemoWorld,
    dump: dumpDemoWorld as never,
  }),
  defineConstruct({
    keyword: 'storyline',
    field: 'storylines',
    takesID: true,
    parse: parseStoryline,
    dump: dumpStoryline as never,
  }),
  // Primmel v3 twin interface (TODO.roadmap/32 — doctrine ch. 14 §14.4):
  // the connector-profile registry. Endpoints and serve bindings are NOT
  // top-level constructs — they are subject anatomy slots (is.endpoints /
  // has.serves), parsed and dumped by the subject ser-des (config/subject.ts
  // + config/twin.ts).
  connectorProfileConstruct as ConstructDefinition,
  // Primmel v3 continuous compliance (TODO.roadmap/34 — doctrine ch. 14
  // §14.5): the monitor — triggers, evaluation refs, evidence sinks,
  // escalation over a subject set.
  monitorConstruct as ConstructDefinition,
  // Primmel v3 model-native DPP (TODO.roadmap/35 — doctrine ch. 14 §14.6,
  // ch. 15 §15.6): the passport — a named, access-classed projection of
  // the product model + live instance state, on product reference
  // packages.
  passportConstruct as ConstructDefinition,
  // The architecture invariants (smart gap-close E9,
  // analysis/architecture-gaps-2026-07.md): the first-class replacement
  // for the note-family encoding — named platform invariants with
  // severity + enforcement claims, a sibling collection of `notes`.
  invariantConstruct as ConstructDefinition,
  // The required test orderings (smart gap-close E10,
  // analysis/architecture-gaps-2026-07.md): the first-class replacement
  // for the hand-authored supplemental test-sequences.yaml — ordered
  // steps of conformance tests and environment-program phases with
  // depends_on chaining, a sibling collection of `invariants`.
  testSequenceConstruct as ConstructDefinition,
  // The per-test evaluation-formula traces (smart gap-close E11,
  // analysis/architecture-gaps-2026-07.md): the first-class replacement
  // for the hand-authored supplemental formulas-used.yaml — a registry
  // block keyed by the conformance-test reference, a sibling collection
  // of `testSequences`.
  formulasUsedConstruct as ConstructDefinition,
  // Primmel v3 ISO 24229 multilinguality (TODO.roadmap/25 — doctrine
  // ch. 10): the text block — per-spelling alternate values of one prose
  // field, addressed `<element-id>.<field>`.
  defineConstruct({
    keyword: 'text',
    field: 'texts',
    takesID: true,
    parse: parseText,
    dump: dumpText as never,
  }),
  // Primmel v3.1 dataspace + trust (TODO.primmel/10; MN 114 clause 19):
  // the dataspace definition as a model object, and the usage-policy set
  // in Primmel's own policy grammar (ODRL is a codec output, never an
  // import). The trust_ref form and the corresponds facet are shared
  // sub-structures (config/trustRef.ts, config/correspondence.ts), not
  // top-level constructs.
  dataspaceConstruct as ConstructDefinition,
  policyConstruct as ConstructDefinition,
  // Primmel v3.2 consumption constructs (TODO.primmel/11; MN 114 clause
  // 10.6): the top-level applicability dimension (one grammar with the
  // instrument's inline dimension blocks, two placements).
  dimensionConstruct as ConstructDefinition,
];

function buildParserConfig(
  constructs: ConstructDefinition[],
): ParserConfiguration {
  const out: ParserConfiguration = {};
  for (const c of constructs) {
    if (!c.field) {
      continue;
    }
    const entry = { takesID: c.takesID, parse: c.parse, field: c.field };
    out[c.keyword] = entry;
    for (const alias of c.aliases ?? []) {
      out[alias] = entry;
    }
  }
  return out;
}

function buildResolverConfig(
  constructs: ConstructDefinition[],
): ResolverConfiguration {
  const out: ResolverConfiguration = {};
  for (const c of constructs) {
    if (!c.field) {
      continue;
    }
    out[c.field] = {
      resolve: c.resolve ?? (((_ctx: unknown, item: unknown) => item) as never),
    };
  }
  return out;
}

function buildDumperConfig(
  constructs: ConstructDefinition[],
): DumperConfiguration {
  const out: Record<string, (item: never) => string> = {};
  for (const c of constructs) {
    if (!c.field) {
      continue;
    }
    out[c.field] = c.dump;
  }
  return out as DumperConfiguration;
}

// Special cases that don't fit the keyword/field shape — `root` is a
// single ID reference, `metadata` is a singleton block.
const SPECIAL_PARSERS: ParserConfiguration = {
  package: {
    parse: parsePackage,
  },
  root: {
    parse: token => ctx => {
      ctx.root = token.trim();
      return ctx;
    },
  },
  metadata: {
    parse: parseMetadata,
  },
  // The `version "…"` line (MMEL's model-version declaration): accepted
  // (strict mode must not reject a valid document; previously the line
  // was silently skipped in lenient mode). Not recorded — Metadata has
  // no version field; carrying it is a deliberate type-level change
  // (with dump support) for a later wave.
  version: {
    parse: () => ctx => ctx,
  },
};

export const PARSER_CONFIG: ParserConfiguration = {
  ...SPECIAL_PARSERS,
  ...buildParserConfig(CONSTRUCTS),
};

// RESOLVER_CONFIG insertion order is not load-bearing — resolveFromContext
// is pure and resolvers may read any ctx table at any time without
// observing partial state. Order here is kept logical (dependencies first)
// for readability only.
export const RESOLVER_CONFIG: ResolverConfiguration =
  buildResolverConfig(CONSTRUCTS);

export const DUMPER_CONFIG: DumperConfiguration = buildDumperConfig(CONSTRUCTS);
