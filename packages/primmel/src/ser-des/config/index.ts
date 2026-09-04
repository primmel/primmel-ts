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
import { dumpPredicate, parsePredicate } from './predicate';
import { dumpConstraint, parseConstraint } from './constraint';
import {
  dumpDiscrepancyRecord,
  parseDiscrepancyRecord,
} from './discrepancyRecord';
import { dumpTestPointSet, parseTestPointSet } from './testPointSet';
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
  defineConstruct({
    keyword: 'competence_kind',
    field: 'competenceKinds',
    takesID: true,
    parse: parseCompetenceKind,
    dump: dumpCompetenceKind as never,
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
