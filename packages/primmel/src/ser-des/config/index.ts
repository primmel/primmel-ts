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
//   2. Append one `defineConstruct(...)` entry to CONSTRUCTS below.
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
import { dumpTerm, parseTerm } from './term';

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
    keyword: 'subprocess',
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
    keyword: 'map_profile',
    field: 'mapProfiles',
    takesID: true,
    parse: parseMapProfile,
    dump: dumpMapProfile as never,
  }),
  defineConstruct({
    keyword: 'view_profile',
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
    keyword: 'state_machine',
    field: 'stateMachines',
    takesID: true,
    parse: parseStateMachine,
    dump: dumpStateMachine as never,
  }),
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
  root: {
    parse: token => ctx => {
      ctx.root = token.trim();
      return ctx;
    },
  },
  metadata: {
    parse: parseMetadata,
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
