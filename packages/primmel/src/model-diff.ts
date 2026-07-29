// ─────────────────────────────────────────────────────────────────────
// Model diff (TODO.roadmap/28; doctrine ch. 13 §13.2–§13.3): the ONE
// structural diff the core owes lifecycle management. Not a text diff of
// PRL files — a diff of MODEL ELEMENTS, keyed by stable id (never file
// position), classified by tier, powering three consumers:
//
//   1. edition comparison  — "what changed between R 60:2017 and
//      R 60:2021?" answered in model terms (formatDiffReport);
//   2. change audit        — the diff between any two states of one
//      package is the audit trail (working tree vs baseline, baseline vs
//      baseline — the CLI takes two directories);
//   3. clause-drift detection — the provenance edges of shared elements
//      whose source clause moved between editions light up as a table
//      (the R 60:2017→2021 renumbering made machine-visible).
//
// Two properties make the diff trustworthy (§13.2):
//   - id-keyed, not position-keyed: renaming a file or reordering the
//     declaration list is not a model change;
//   - tier-annotated: every change reports its tier (chapter 1), so an
//     edition review reads "secondary: 3 requirements changed limits"
//     instead of "47 files touched".
//
// The change kinds (§13.2): added / removed / changed (classified by
// WHAT changed: anchor / statement / binding / limit / applicability /
// structure / provenance) / moved (same id, ONLY the anchor changed — a
// re-anchored binds_to, e.g. model.parameters → model.software). The
// anchor aspect holds ONLY location fields (bindsTo / parent / targets);
// binding-surface CONTENT (a calculation's input/output signature, a
// requirement's subjects/channel) classifies as `changed — binding`,
// never moved — §13.2's moved is "same id, different anchor or
// location", and a signature is neither. The four sets partition the
// element space (§13.7): an id is added, removed, or shared; a shared id
// is unchanged, moved, or changed.
//
// Provenance is edition-normalized: a source ref
// `urn:oiml:pub:r:60-2:2021 # clause-2.10.4` compares on its doc BASIS
// (the URN with the edition segment stripped) + clause, so the expected
// edition re-citation (2017 → 2021 at an unchanged clause) is NOT a
// model change, while a clause move IS — and feeds the clause-drift
// table.
//
// The mapping diff is first-class (mappings are first-class, ch. 5):
// pairs added/removed, description/justification changes, and the
// coverage delta — a reference component dropping from full to partial
// cover is a COMPUTED finding (the coverage calculus), never an authored
// one (§13.7).
//
// Pure module: no fs. Loading package directories (plus their .prm files
// and sources-prd payloads) lives in package-diff.ts; the CLI in
// scripts/check.mts (`primmel diff`) wires both.
// ─────────────────────────────────────────────────────────────────────

import type Standard from './types/Standard';
import type { PackageManifest } from './types/Package';
import type { CoverageLevel } from './types/MapProfile';
import {
  buildProcessTree,
  collectMappings,
  computeCoverage,
  type MappingRecord,
  type ProcessTreeNode,
} from './mapping-coverage';

// ── tiers (chapter 1) ────────────────────────────────────────────────

export type TierName =
  'foundations' | 'primary' | 'secondary' | 'tertiary' | 'cross-cutting';

export const TIER_ORDER: TierName[] = [
  'foundations',
  'primary',
  'secondary',
  'tertiary',
  'cross-cutting',
];

/**
 * The tier of every diffable Standard collection (chapter 1's table):
 * foundations = what everything references (vocabulary, parties, units,
 * registers); primary = the subject and its aspects (the instrument
 * chain, attributes, behaviors, conditions, instances, duals, artifacts);
 * secondary = models ANCHORED to primary aspect paths (requirements,
 * tests, forms, verdict quantities, tables of limits); tertiary =
 * execution and judgment (processes, entities, registries, state
 * machines, approvals, monitors, passports); cross-cutting = annotation
 * and traceability furniture (notes, invariants, test sequences,
 * formulas-used traces, links).
 *
 * mapProfiles are deliberately ABSENT: mappings are not tiered elements
 * — the mapping diff owns them (pairs + coverage delta).
 */
export const TIER_BY_FIELD: Record<string, TierName> = {
  terms: 'foundations',
  references: 'foundations',
  roles: 'foundations',
  quantityRegisters: 'foundations',
  enums: 'foundations',
  variables: 'foundations',
  figures: 'foundations',
  activityArchetypes: 'foundations',
  connectorProfiles: 'foundations',
  subjects: 'primary',
  instruments: 'primary',
  attributeDefinitions: 'primary',
  capabilities: 'primary',
  behaviors: 'primary',
  conditionSets: 'primary',
  instances: 'primary',
  duals: 'primary',
  artifactDefinitions: 'primary',
  artifactInstances: 'primary',
  requirements: 'secondary',
  requirementClasses: 'secondary',
  conformanceTests: 'secondary',
  conformanceClasses: 'secondary',
  forms: 'secondary',
  subforms: 'secondary',
  symbols: 'secondary',
  calculations: 'secondary',
  verdicts: 'secondary',
  tables: 'secondary',
  testPointSets: 'secondary',
  referenceMaterials: 'secondary',
  processes: 'tertiary',
  pages: 'tertiary',
  dataclasses: 'tertiary',
  regs: 'tertiary',
  gateways: 'tertiary',
  events: 'tertiary',
  approvals: 'tertiary',
  stateMachines: 'tertiary',
  monitors: 'tertiary',
  // Passports (TODO.roadmap/35) are tertiary beside monitors: the
  // twin-wave serving machinery — a monitor is continuous judgment, a
  // passport is continuous serving (§14.6: "served by the endpoint,
  // verified through the engine").
  passports: 'tertiary',
  viewProfiles: 'tertiary',
  provisions: 'tertiary',
  notes: 'cross-cutting',
  // Invariants (smart gap-close E9) are cross-cutting beside notes: the
  // typed replacement for the note-family encoding — doctrine about the
  // model, not machinery inside it (the enforcement claims point at the
  // gates/linker rules that execute; the invariant itself declares).
  invariants: 'cross-cutting',
  // Test sequences (smart gap-close E10) are cross-cutting beside
  // invariants: a required ordering is doctrine about how the
  // conformance tests must run on a sample, not a test itself — the
  // steps reference the tests; the sequence itself declares.
  testSequences: 'cross-cutting',
  // Formulas-used traces (smart gap-close E11) are cross-cutting beside
  // test sequences: a trace is doctrine about which registry formulas a
  // conformance test's evaluation invokes, not a test itself — the
  // entry references the test and the formulas; the trace itself
  // declares.
  formulasUsed: 'cross-cutting',
  links: 'cross-cutting',
  // Text content sets (TODO.roadmap/25 + smart gap-close E13; TODO.v2/12)
  // are cross-cutting beside notes: an alternate spelling is annotation
  // — a translation never changes what the model demands. The id is the
  // full nested address (<element-id>.<path…>.<field>); the diff matches
  // on it whole.
  texts: 'cross-cutting',
};

// ── canonical content ────────────────────────────────────────────────

/**
 * Deterministic serialization: sorted object keys, arrays in declared
 * order (within-element order is significant — procedure steps and
 * applicability entries are meaningful sequences), `_`-prefixed keys
 * (resolver internals) dropped, shared resolved references guarded
 * against cycles.
 */
export function canonical(value: unknown): string {
  const stack: unknown[] = [];
  const ser = (v: unknown): string => {
    if (v === undefined) {
      return 'null';
    }
    if (v === null || typeof v !== 'object') {
      return JSON.stringify(v) ?? 'null';
    }
    if (Array.isArray(v)) {
      return '[' + v.map(ser).join(',') + ']';
    }
    if (stack.includes(v)) {
      return '"[Circular]"';
    }
    stack.push(v);
    const keys = Object.keys(v as Record<string, unknown>)
      .filter(k => !k.startsWith('_'))
      .sort();
    const out =
      '{' +
      keys
        .map(
          k => JSON.stringify(k) + ':' + ser((v as Record<string, unknown>)[k]),
        )
        .join(',') +
      '}';
    stack.pop();
    return out;
  };
  return ser(value);
}

// ── provenance (edition-normalized) ──────────────────────────────────

/** A source ref normalized for cross-edition comparison. */
export interface NormalizedSourceRef {
  /** Doc URN with the trailing edition segment stripped. */
  basis: string;
  /** The stripped edition (e.g. "2021"; '' when the URN carries none). */
  edition: string;
  clause: string;
  fragment: string;
}

const DOC_FRAGMENT = /#([^#]*)$/;

/**
 * Normalize a source ref onto its doc basis: `urn:oiml:pub:r:60-2:2021`
 * → basis `urn:oiml:pub:r:60-2`, edition `2021`. A `#fragment` suffix on
 * the doc moves into the fragment slot. The trailing segment counts as an
 * edition when it is all digits (the OIML URN convention
 * `urn:oiml:pub:<doc>:<year>`); other URNs compare whole.
 */
export function normalizeSourceRef(
  doc: string,
  clause: string,
  fragment = '',
): NormalizedSourceRef {
  let rest = doc ?? '';
  let frag = fragment ?? '';
  const hash = DOC_FRAGMENT.exec(rest);
  if (hash) {
    rest = rest.slice(0, hash.index);
    if (!frag) {
      frag = hash[1];
    }
  }
  const colon = rest.lastIndexOf(':');
  let basis = rest;
  let edition = '';
  if (colon >= 0) {
    const tail = rest.slice(colon + 1);
    if (/^\d+$/.test(tail)) {
      basis = rest.slice(0, colon);
      edition = tail;
    }
  }
  return { basis, edition, clause: clause ?? '', fragment: frag };
}

// ── the element index ────────────────────────────────────────────────

/** One diffable model element, normalized out of its Standard collection. */
export interface DiffElement {
  /** `${field}:${id}` — the primary key (ids alone may collide across kinds). */
  key: string;
  id: string;
  /** The Standard collection field (requirements, conformanceTests, …). */
  kind: string;
  tier: TierName;
  /** Aspect name → canonical content (only aspects with content present). */
  aspects: Record<string, string>;
  /** Edition-normalized provenance edges (empty when the element cites none). */
  provenance: NormalizedSourceRef[];
}

const PROVENANCE_FIELDS = ['source', 'sourceRef', 'sourceRefs'];

/**
 * Aspect classification per kind: which fields answer "WHAT changed".
 * The ANCHOR aspect holds only location fields — a change to nothing
 * but these is a MOVE (§13.2: "same id, different anchor or location").
 * The BINDING aspect holds binding-surface CONTENT (a calculation's
 * input/output signature, a requirement's subject slots and channel) —
 * a change there is `changed — binding`, never moved. Kinds without a
 * spec use the generic scheme — statement (the narrative fields
 * present), anchor (the anchor fields present), provenance, structure
 * (everything else). Text content sets are the one per-ENTRY scheme
 * (TODO.v2/12): one aspect per spelling code (`spelling:<code>`), so a
 * spelling added/removed or a value changed names its entry, never the
 * whole set.
 */
const ASPECT_SPECS: Record<
  string,
  {
    statement?: string[];
    anchor?: string[];
    binding?: string[];
    limit?: string[];
    applicability?: string[];
  }
> = {
  requirements: {
    statement: ['name', 'statement', 'guidance'],
    anchor: ['bindsTo'],
    binding: ['subjects', 'channel'],
    limit: ['limit', 'acceptanceCriteria'],
    applicability: ['applicability'],
  },
  conformanceTests: {
    statement: ['name', 'purpose', 'method', 'guidance'],
    anchor: ['targets', 'bindsTo'],
    binding: ['testSubject', 'conditionsToEnforce'],
    limit: [
      'acceptanceCriteria',
      'acceptanceCriteriaType',
      'acceptanceCriteriaDescription',
      'acceptancePassIf',
      'acceptance',
      'preconditions',
    ],
    applicability: ['applicability'],
  },
  calculations: {
    statement: ['name', 'label', 'description'],
    // inputs/output/params are the SIGNATURE (§13.2 `changed` territory)
    // — a calculation has no anchor, so it can never report moved.
    binding: ['inputs', 'output', 'params'],
    limit: ['expression', 'ruleType', 'lookup', 'profile'],
  },
};

/** Generic statement fields (first present wins the aspect). */
const GENERIC_STATEMENT = [
  'name',
  'label',
  'title',
  'description',
  'definition',
  'statement',
  'purpose',
  'text',
];
/**
 * Generic anchor fields — a change to one of these, and ONLY these,
 * classifies the element as MOVED (re-anchored / relocated), not changed.
 */
const GENERIC_ANCHOR = [
  'parent',
  'bindsTo',
  'targets',
  'conformanceProcessId',
  'conformanceProcessIds',
];

interface RawSourceRef {
  doc?: string;
  clause?: string;
  fragment?: string;
}

function provenanceOf(el: Record<string, unknown>): NormalizedSourceRef[] {
  const out: NormalizedSourceRef[] = [];
  const push = (r: RawSourceRef | null | undefined): void => {
    if (r && typeof r === 'object' && (r.doc || r.clause)) {
      out.push(normalizeSourceRef(r.doc ?? '', r.clause ?? '', r.fragment));
    }
  };
  push(el.source as RawSourceRef);
  push(el.sourceRef as RawSourceRef);
  for (const r of (el.sourceRefs as RawSourceRef[]) ?? []) {
    push(r);
  }
  // A conformance test's `reference` field holds the raw doc URN of its
  // structured reference block (v2) — edition and all. It duplicates the
  // structured edge; treat it as provenance so the expected edition
  // re-citation stays invisible (the legacy free-string form — not
  // urn-shaped — stays in structure, where it diffs as content).
  const refString = el.reference;
  if (typeof refString === 'string' && refString.startsWith('urn:')) {
    push({ doc: refString, clause: '' });
  }
  // De-duplicate identical edges ON THE COMPARABLE FORM (edition-stripped
  // — the YAML→PRL emission repeats the headline `reference:` as a source
  // entry; one edge, not two).
  const seen = new Set<string>();
  return out.filter(r => {
    const k = provenanceEdgeKey(r);
    if (seen.has(k)) {
      return false;
    }
    seen.add(k);
    return true;
  });
}

/**
 * The comparable form of a provenance edge: basis + clause + fragment,
 * EDITION-STRIPPED. The expected edition re-citation (2017 → 2021 at an
 * unchanged clause) is not a model change; a clause move is.
 */
function provenanceEdgeKey(r: NormalizedSourceRef): string {
  return canonical({ basis: r.basis, clause: r.clause, fragment: r.fragment });
}

function elementOf(field: string, el: Record<string, unknown>): DiffElement {
  // `id` everywhere except the state machines, which key by the bound
  // entity's name (the construct declares entityName, no id).
  const id = String(el.id ?? el.entityName ?? '');
  const tier = TIER_BY_FIELD[field] ?? 'cross-cutting';
  const provenance = provenanceOf(el);
  const consumed = new Set<string>(PROVENANCE_FIELDS);
  // The urn-shaped `reference` string was lifted into provenance — do not
  // diff its raw (edition-carrying) form again in structure.
  if (typeof el.reference === 'string' && el.reference.startsWith('urn:')) {
    consumed.add('reference');
  }
  const aspects: Record<string, string> = {};
  const spec = ASPECT_SPECS[field];
  const pick = (fields: string[]): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      if (el[f] !== undefined) {
        out[f] = el[f];
        consumed.add(f);
      }
    }
    return out;
  };
  if (spec) {
    for (const [aspect, fields] of Object.entries(spec)) {
      const picked = pick(fields ?? []);
      if (Object.keys(picked).length > 0) {
        aspects[aspect] = canonical(picked);
      }
    }
  } else if (field === 'texts') {
    // Content sets diff PER SPELLING ENTRY (TODO.v2/12): one aspect per
    // spelling code — a spelling added/removed or a value changed names
    // its entry (`spelling:<code>`), never the whole set. The value AND
    // the conversion provenance (`via`) are the entry's content. A
    // duplicate code within one set is a data error (C89 owns it): the
    // last entry wins the aspect, like a duplicate element id wins its
    // slot.
    consumed.add('entries');
    const entries =
      (el.entries as { spelling?: string; value?: string; via?: string }[]) ??
      [];
    for (const e of entries) {
      if (e && typeof e.spelling === 'string') {
        aspects[`spelling:${e.spelling}`] = canonical({
          value: e.value,
          via: e.via,
        });
      }
    }
  } else {
    const statement = pick(GENERIC_STATEMENT);
    if (Object.keys(statement).length > 0) {
      aspects.statement = canonical(statement);
    }
    const anchor = pick(GENERIC_ANCHOR);
    if (Object.keys(anchor).length > 0) {
      aspects.anchor = canonical(anchor);
    }
  }
  if (provenance.length > 0) {
    // The provenance ASPECT compares edges edition-stripped (the expected
    // edition re-citation is invisible to the structural diff); clause
    // moves show up here AND feed the clause-drift table.
    aspects.provenance = canonical(
      provenance.map(r => ({
        basis: r.basis,
        clause: r.clause,
        fragment: r.fragment,
      })),
    );
  }
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(el)) {
    if (!consumed.has(k) && k !== 'id') {
      rest[k] = v;
    }
  }
  aspects.structure = canonical(rest);
  return { key: `${field}:${id}`, id, kind: field, tier, aspects, provenance };
}

/**
 * The id-keyed element index of a Standard — the diff's normalized input.
 * Renaming a file or reordering declarations leaves the index untouched.
 * A duplicate `kind:id` key is a DATA ERROR (the duplicate-id linter owns
 * it): the last declaration wins the slot, so a diff over an unlinted
 * package with duplicates under-reports. Keys of overwritten duplicates
 * are collected into `duplicates` when given — the caller surfaces them
 * as warnings (diffStandards does).
 */
export function elementIndex(
  standard: Standard,
  duplicates?: string[],
): Map<string, DiffElement> {
  const out = new Map<string, DiffElement>();
  for (const field of Object.keys(TIER_BY_FIELD)) {
    const items = (standard as unknown as Record<string, unknown[]>)[field];
    if (!Array.isArray(items)) {
      continue;
    }
    for (const el of items) {
      // The element id is `id` for every diffable collection except the
      // state machines, whose key is the bound entity's name
      // (`entityName` — the state_machine construct declares no `id`;
      // without this the machines were silently invisible to the diff,
      // cascades and all — smart gap-close E12).
      if (el && typeof el === 'object' && ('id' in el || 'entityName' in el)) {
        const d = elementOf(field, el as Record<string, unknown>);
        if (out.has(d.key)) {
          duplicates?.push(d.key);
        }
        out.set(d.key, d);
      }
    }
  }
  return out;
}

// ── the diff report shape ────────────────────────────────────────────

export interface DiffEntry {
  key: string;
  id: string;
  kind: string;
  tier: TierName;
}

/** A shared id whose content differs — with the classified aspects. */
export interface ChangeEntry extends DiffEntry {
  aspects: string[];
}

/**
 * A shared id whose ONLY change is the anchor — re-anchored (§13.2).
 * from/to are the canonical ANCHOR aspect (location fields only), never
 * the whole binding surface.
 */
export interface MoveEntry extends DiffEntry {
  from: string;
  to: string;
}

/** A mapping pair present in both versions with changed metadata. */
export interface MappingPairChange {
  source: string;
  sourceModel: string;
  target: string;
  /** Which of description / justification changed. */
  aspects: string[];
}

/** A computed coverage-level change for one reference component. */
export interface CoverageDeltaEntry {
  namespace: string;
  component: string;
  from: CoverageLevel | 'absent';
  to: CoverageLevel | 'absent';
}

/** The mapping diff: pairs + the computed coverage delta (§13.2). */
export interface MappingDiff {
  added: MappingRecord[];
  removed: MappingRecord[];
  changed: MappingPairChange[];
  coverageDelta: CoverageDeltaEntry[];
  /** Target namespaces with no process tree on either side (delta silent). */
  namespacesSkipped: string[];
}

export type ClauseDriftKind = 'renumbered' | 'recited' | 'decited';

/** One clause-drift table row, aggregated across the citing elements. */
export interface ClauseDriftRow {
  /** Doc basis (edition-stripped URN) both editions share. */
  doc: string;
  /** The clause the old edition cited ('' for a recited clause). */
  from: string;
  /** The clause the new edition cites ('' for a de-cited clause). */
  to: string;
  kind: ClauseDriftKind;
  /**
   * Clause-text comparison across the editions (sources-prd payloads):
   * 'same' (a pure renumbering), 'differed' (renumbered AND reworded),
   * 'unavailable' (payloads missing on either side — structural only).
   */
  text: 'same' | 'differed' | 'unavailable';
  citedBy: DiffEntry[];
}

export interface TierTally {
  added: number;
  removed: number;
  changed: number;
  moved: number;
  unchanged: number;
}

export interface ModelDiff {
  aLabel: string;
  bLabel: string;
  /** True when both sides are the same package id at different versions. */
  editionComparison: boolean;
  aVersion: string;
  bVersion: string;
  added: DiffEntry[];
  removed: DiffEntry[];
  changed: ChangeEntry[];
  moved: MoveEntry[];
  unchanged: number;
  byTier: Record<TierName, TierTally>;
  mappings: MappingDiff;
  clauseDrift: ClauseDriftRow[];
  /**
   * Data-quality warnings surfaced while indexing (duplicate kind:id
   * keys — the last declaration wins the slot). A warning is not a model
   * change: it never affects `empty`.
   */
  warnings: string[];
  empty: boolean;
}

// ── clause text (sources-prd payloads) ───────────────────────────────

/**
 * Clause → concatenated sentence text, keyed by doc basis — the
 * rewording detector's input (built from `<part>.sentences.json`
 * payloads by package-diff.ts).
 */
export type ClauseTextIndex = Map<string, string>;

export function clauseTextKey(basis: string, clause: string): string {
  return `${basis}#${clause}`;
}

// ── the diff ─────────────────────────────────────────────────────────

export interface ModelDiffOptions {
  aLabel?: string;
  bLabel?: string;
  /** Mapping records overriding collectMappings() (e.g. with .prm files). */
  mappingsA?: MappingRecord[];
  mappingsB?: MappingRecord[];
  /**
   * Reference process trees per target namespace for the coverage delta;
   * falls back to each side's own `Namespace#…` alias forest (the C23
   * fallback), then to silence (namespacesSkipped).
   */
  references?: Record<string, Standard | ProcessTreeNode[]>;
  /** Clause-text indexes for the rewording classification. */
  sentencesA?: ClauseTextIndex;
  sentencesB?: ClauseTextIndex;
}

function packageVersion(m: PackageManifest | null | undefined): string {
  return m?.version ?? '';
}

/** Fold dot-descendants: drop clause c when the set also holds a parent. */
function foldClauses(clauses: string[]): string[] {
  const sorted = [...new Set(clauses)].sort();
  return sorted.filter(
    c => !sorted.some(p => p !== c && c.startsWith(p + '.')),
  );
}

function diffMappings(
  a: Standard,
  b: Standard,
  options: ModelDiffOptions,
): MappingDiff {
  const recordsA = options.mappingsA ?? collectMappings(a);
  const recordsB = options.mappingsB ?? collectMappings(b);
  const keyOf = (m: MappingRecord): string =>
    `${m.sourceModel}#${m.source}⇒${m.target}`;
  const mapA = new Map(recordsA.map(m => [keyOf(m), m]));
  const mapB = new Map(recordsB.map(m => [keyOf(m), m]));
  const added: MappingRecord[] = [];
  const removed: MappingRecord[] = [];
  const changed: MappingPairChange[] = [];
  for (const [k, m] of mapB) {
    if (!mapA.has(k)) {
      added.push(m);
    }
  }
  for (const [k, m] of mapA) {
    const other = mapB.get(k);
    if (!other) {
      removed.push(m);
      continue;
    }
    const aspects: string[] = [];
    if (m.description !== other.description) {
      aspects.push('description');
    }
    if (m.justification !== other.justification) {
      aspects.push('justification');
    }
    if (aspects.length > 0) {
      changed.push({
        source: m.source,
        sourceModel: m.sourceModel,
        target: m.target,
        aspects,
      });
    }
  }

  // Coverage delta — COMPUTED per target namespace on both sides, never
  // authored (§13.7). The tree is the caller's reference, else the side's
  // own alias forest; a namespace with no tree either side is silent.
  const namespaces = new Set<string>([
    ...recordsA.map(m => m.targetModel),
    ...recordsB.map(m => m.targetModel),
  ]);
  const coverageDelta: CoverageDeltaEntry[] = [];
  const namespacesSkipped: string[] = [];
  for (const ns of [...namespaces].sort()) {
    const forestOf = (std: Standard): ProcessTreeNode[] | Standard | null => {
      const ref = options.references?.[ns];
      if (ref) {
        return ref;
      }
      const forest = buildProcessTree(std, { idPrefix: `${ns}#` });
      return forest.length > 0 ? forest : null;
    };
    const treeA = forestOf(a);
    const treeB = forestOf(b);
    if (!treeA && !treeB) {
      namespacesSkipped.push(ns);
      continue;
    }
    const levels = new Map<
      string,
      { from?: CoverageLevel; to?: CoverageLevel }
    >();
    if (treeA) {
      const report = computeCoverage(a, treeA, recordsA, ns);
      for (const c of report.components) {
        levels.set(c.id, { from: c.coverage });
      }
    }
    if (treeB) {
      const report = computeCoverage(b, treeB, recordsB, ns);
      for (const c of report.components) {
        const row = levels.get(c.id) ?? {};
        row.to = c.coverage;
        levels.set(c.id, row);
      }
    }
    for (const [component, row] of [...levels.entries()].sort()) {
      const from = row.from ?? 'absent';
      const to = row.to ?? 'absent';
      if (from !== to) {
        coverageDelta.push({ namespace: ns, component, from, to });
      }
    }
  }

  return { added, removed, changed, coverageDelta, namespacesSkipped };
}

function diffClauseDrift(
  shared: [DiffElement, DiffElement][],
  options: ModelDiffOptions,
): ClauseDriftRow[] {
  interface RawRow {
    doc: string;
    from: string;
    to: string;
    kind: ClauseDriftKind;
    citedBy: DiffEntry;
  }
  const raw: RawRow[] = [];
  for (const [elA, elB] of shared) {
    const bases = new Set<string>([
      ...elA.provenance.map(r => r.basis),
      ...elB.provenance.map(r => r.basis),
    ]);
    for (const basis of [...bases].sort()) {
      const clausesOf = (el: DiffElement): string[] =>
        foldClauses(
          el.provenance.filter(r => r.basis === basis).map(r => r.clause),
        ).filter(c => c.length > 0);
      const oldC = clausesOf(elA);
      const newC = clausesOf(elB);
      const removedC = oldC.filter(c => !newC.includes(c));
      const addedC = newC.filter(c => !oldC.includes(c));
      if (removedC.length === 0 && addedC.length === 0) {
        continue;
      }
      const entry: DiffEntry = {
        key: elA.key,
        id: elA.id,
        kind: elA.kind,
        tier: elA.tier,
      };
      // Deterministic pairing. A clause SPLIT (1:N — the old clause's
      // content landed in several new clauses, the R 60 humidity case)
      // pairs the one old clause with each new one; a MERGE (N:1) pairs
      // each old clause with the one new one; equal counts zip in sorted
      // order; leftovers are de-cited / re-cited rows. The N:N zip is
      // POSITIONAL: crossed multi-renumberings inside one element
      // (2.1 → 3.2 AND 2.2 → 3.1) would mis-pair — no recorded case;
      // the pairing is deterministic and documented.
      if (removedC.length === 1 && addedC.length > 1) {
        for (const c of addedC) {
          raw.push({
            doc: basis,
            from: removedC[0],
            to: c,
            kind: 'renumbered',
            citedBy: entry,
          });
        }
      } else if (addedC.length === 1 && removedC.length > 1) {
        for (const c of removedC) {
          raw.push({
            doc: basis,
            from: c,
            to: addedC[0],
            kind: 'renumbered',
            citedBy: entry,
          });
        }
      } else {
        const pairs = Math.min(removedC.length, addedC.length);
        for (let i = 0; i < pairs; i++) {
          raw.push({
            doc: basis,
            from: removedC[i],
            to: addedC[i],
            kind: 'renumbered',
            citedBy: entry,
          });
        }
        for (const c of removedC.slice(pairs)) {
          raw.push({
            doc: basis,
            from: c,
            to: '',
            kind: 'decited',
            citedBy: entry,
          });
        }
        for (const c of addedC.slice(pairs)) {
          raw.push({
            doc: basis,
            from: '',
            to: c,
            kind: 'recited',
            citedBy: entry,
          });
        }
      }
    }
  }

  // Aggregate per (doc, from, to): the drift TABLE rows with their
  // citing elements — "2.10.3 → 2.10.4, cited by 2 elements".
  const textOf = (row: RawRow): 'same' | 'differed' | 'unavailable' => {
    if (
      row.kind !== 'renumbered' ||
      !options.sentencesA ||
      !options.sentencesB
    ) {
      return 'unavailable';
    }
    const tA = options.sentencesA.get(clauseTextKey(row.doc, row.from));
    const tB = options.sentencesB.get(clauseTextKey(row.doc, row.to));
    if (tA === undefined || tB === undefined) {
      return 'unavailable';
    }
    return tA.replace(/\s+/g, ' ').trim() === tB.replace(/\s+/g, ' ').trim()
      ? 'same'
      : 'differed';
  };
  const rows = new Map<string, ClauseDriftRow>();
  for (const r of raw) {
    const text = textOf(r);
    const key = `${r.doc}|${r.from}|${r.to}|${r.kind}|${text}`;
    let row = rows.get(key);
    if (!row) {
      row = {
        doc: r.doc,
        from: r.from,
        to: r.to,
        kind: r.kind,
        text,
        citedBy: [],
      };
      rows.set(key, row);
    }
    if (!row.citedBy.some(e => e.key === r.citedBy.key)) {
      row.citedBy.push(r.citedBy);
    }
  }
  return [...rows.values()].sort((x, y) =>
    `${x.doc} ${x.from} ${x.to}`.localeCompare(`${y.doc} ${y.from} ${y.to}`),
  );
}

/**
 * The change-report label for one differing aspect. Text content sets
 * carry the per-entry scheme (TODO.v2/12 — `spelling:<code>` aspects):
 * the label names the entry-level change — a spelling added, a spelling
 * removed, a value (or its `via` provenance) changed. Every other kind
 * reports the bare aspect name.
 */
function labelAspect(elA: DiffElement, elB: DiffElement, name: string): string {
  if (elA.kind !== 'texts' || !name.startsWith('spelling:')) {
    return name;
  }
  if (!(name in elA.aspects)) {
    return `${name} (added)`;
  }
  if (!(name in elB.aspects)) {
    return `${name} (removed)`;
  }
  return `${name} (changed)`;
}

/**
 * The structural model diff between two loaded Standards (§13.2). `a` is
 * the OLD state, `b` the NEW one (edition comparison reads 2017 → 2021).
 */
export function diffStandards(
  a: Standard,
  b: Standard,
  options: ModelDiffOptions = {},
): ModelDiff {
  const duplicatesA: string[] = [];
  const duplicatesB: string[] = [];
  const indexA = elementIndex(a, duplicatesA);
  const indexB = elementIndex(b, duplicatesB);
  const added: DiffEntry[] = [];
  const removed: DiffEntry[] = [];
  const changed: ChangeEntry[] = [];
  const moved: MoveEntry[] = [];
  const shared: [DiffElement, DiffElement][] = [];
  let unchanged = 0;
  const tally: Record<TierName, TierTally> = Object.fromEntries(
    TIER_ORDER.map(t => [
      t,
      { added: 0, removed: 0, changed: 0, moved: 0, unchanged: 0 },
    ]),
  ) as Record<TierName, TierTally>;

  for (const [key, elB] of indexB) {
    if (!indexA.has(key)) {
      added.push({ key, id: elB.id, kind: elB.kind, tier: elB.tier });
      tally[elB.tier].added++;
    }
  }
  for (const [key, elA] of indexA) {
    const elB = indexB.get(key);
    if (!elB) {
      removed.push({ key, id: elA.id, kind: elA.kind, tier: elA.tier });
      tally[elA.tier].removed++;
      continue;
    }
    shared.push([elA, elB]);
    const aspects = new Set<string>([
      ...Object.keys(elA.aspects),
      ...Object.keys(elB.aspects),
    ]);
    const differing = [...aspects].filter(
      name =>
        (elA.aspects[name] ?? '<absent>') !== (elB.aspects[name] ?? '<absent>'),
    );
    if (differing.length === 0) {
      unchanged++;
      tally[elA.tier].unchanged++;
    } else if (differing.every(name => name === 'anchor')) {
      // MOVED — same id, only the anchor changed (§13.2): a requirement
      // re-anchored to a corrected aspect path, a process re-parented.
      // Binding-surface CONTENT (a signature, subject slots, a channel)
      // is `changed — binding`, never a move.
      moved.push({
        key,
        id: elA.id,
        kind: elA.kind,
        tier: elA.tier,
        from: elA.aspects.anchor ?? '',
        to: elB.aspects.anchor ?? '',
      });
      tally[elA.tier].moved++;
    } else {
      changed.push({
        key,
        id: elA.id,
        kind: elA.kind,
        tier: elA.tier,
        aspects: differing.map(name => labelAspect(elA, elB, name)).sort(),
      });
      tally[elA.tier].changed++;
    }
  }

  const mappings = diffMappings(a, b, options);
  const clauseDrift = diffClauseDrift(shared, options);
  const empty =
    added.length === 0 &&
    removed.length === 0 &&
    changed.length === 0 &&
    moved.length === 0 &&
    mappings.added.length === 0 &&
    mappings.removed.length === 0 &&
    mappings.changed.length === 0 &&
    mappings.coverageDelta.length === 0 &&
    clauseDrift.length === 0;

  const mA = a.packageManifest;
  const mB = b.packageManifest;
  const aLabel =
    options.aLabel ?? (mA?.id ? `${mA.id}@${packageVersion(mA) || '?'}` : 'a');
  const bLabel =
    options.bLabel ?? (mB?.id ? `${mB.id}@${packageVersion(mB) || '?'}` : 'b');
  const editionComparison =
    !!mA?.id && mA.id === mB?.id && packageVersion(mA) !== packageVersion(mB);
  // Duplicate kind:id keys are a data error (the duplicate-id linter owns
  // them) — but a diff over an UNLINTED package must not stay silent: the
  // last declaration won the slot, so the diff under-reports that side.
  const dupWarning = (label: string, key: string): string =>
    `${label}: duplicate element ${key} — the last declaration wins (a data error the duplicate-id linter owns); this side under-reports`;
  const warnings = [
    ...duplicatesA.map(k => dupWarning(aLabel, k)),
    ...duplicatesB.map(k => dupWarning(bLabel, k)),
  ];
  return {
    aLabel,
    bLabel,
    editionComparison,
    aVersion: packageVersion(mA),
    bVersion: packageVersion(mB),
    added: added.sort((x, y) => x.key.localeCompare(y.key)),
    removed: removed.sort((x, y) => x.key.localeCompare(y.key)),
    changed: changed.sort((x, y) => x.key.localeCompare(y.key)),
    moved: moved.sort((x, y) => x.key.localeCompare(y.key)),
    unchanged,
    byTier: tally,
    mappings,
    clauseDrift,
    warnings,
    empty,
  };
}

// ── the edition-comparison report ────────────────────────────────────

function fmtEntry(e: DiffEntry): string {
  return `[${e.tier}/${e.kind}] ${e.id}`;
}

/**
 * Compact rendering of a moved element's anchor change: one line per
 * DIFFERING anchor field (`bindsTo: ["a"] → ["b"]`), never the
 * whole-aspect JSON dump. Falls back to the raw from/to pair when the
 * aspect is not the field-object form the engine emits.
 */
function formatAnchorChange(from: string, to: string): string[] {
  try {
    const a = (from ? JSON.parse(from) : {}) as Record<string, unknown>;
    const b = (to ? JSON.parse(to) : {}) as Record<string, unknown>;
    const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    const lines = fields
      .filter(f => canonical(a[f]) !== canonical(b[f]))
      .map(f => `${f}: ${canonical(a[f])} → ${canonical(b[f])}`);
    if (lines.length > 0) {
      return lines;
    }
  } catch {
    // Not the field-object form — fall through to the raw rendering.
  }
  return [`from ${from}`, `to   ${to}`];
}

/**
 * The human-readable change summary between two package states — the
 * edition-comparison report (§13.3.1): tier-annotated tallies, the
 * added/removed/changed/moved lists with classified aspects, the mapping
 * diff with its computed coverage delta, and the clause-drift table
 * (renumbered clauses, re-cited provisions) — the R 60:2017→2021
 * renumbering made machine-visible.
 */
export function formatDiffReport(diff: ModelDiff): string {
  const lines: string[] = [];
  const heading = diff.editionComparison
    ? `edition comparison — ${diff.aLabel} → ${diff.bLabel}`
    : `model diff — ${diff.aLabel} → ${diff.bLabel}`;
  lines.push(`primmel diff: ${heading}`);
  lines.push('');
  lines.push(
    `elements: +${diff.added.length} -${diff.removed.length} ` +
      `~${diff.changed.length} >${diff.moved.length} ` +
      `(${diff.unchanged} unchanged)`,
  );
  lines.push('');
  lines.push('by tier:    added  removed  changed  moved  unchanged');
  for (const tier of TIER_ORDER) {
    const t = diff.byTier[tier];
    lines.push(
      `  ${tier.padEnd(13)} ${String(t.added).padStart(5)} ${String(t.removed).padStart(8)} ${String(t.changed).padStart(8)} ${String(t.moved).padStart(6)} ${String(t.unchanged).padStart(9)}`,
    );
  }
  if (diff.added.length > 0) {
    lines.push('', 'added:');
    for (const e of diff.added) {
      lines.push(`  + ${fmtEntry(e)}`);
    }
  }
  if (diff.removed.length > 0) {
    lines.push('', 'removed:');
    for (const e of diff.removed) {
      lines.push(`  - ${fmtEntry(e)}`);
    }
  }
  if (diff.changed.length > 0) {
    lines.push('', 'changed:');
    for (const e of diff.changed) {
      lines.push(`  ~ ${fmtEntry(e)} — ${e.aspects.join(', ')}`);
    }
  }
  if (diff.moved.length > 0) {
    lines.push('', 'moved (re-anchored):');
    for (const e of diff.moved) {
      lines.push(`  > ${fmtEntry(e)}`);
      for (const l of formatAnchorChange(e.from, e.to)) {
        lines.push(`      ${l}`);
      }
    }
  }
  if (diff.warnings.length > 0) {
    lines.push('', 'warnings:');
    for (const w of diff.warnings) {
      lines.push(`  ${w}`);
    }
  }

  const m = diff.mappings;
  lines.push('');
  lines.push(
    `mappings: +${m.added.length} -${m.removed.length} ~${m.changed.length} pairs` +
      (m.coverageDelta.length > 0
        ? `, ${m.coverageDelta.length} coverage deltas`
        : '') +
      (m.namespacesSkipped.length > 0
        ? ` (coverage silent for ${m.namespacesSkipped.join(', ')} — no reference tree)`
        : ''),
  );
  for (const r of m.added) {
    lines.push(`  + ${r.sourceModel}#${r.source} ⇒ ${r.target}`);
  }
  for (const r of m.removed) {
    lines.push(`  - ${r.sourceModel}#${r.source} ⇒ ${r.target}`);
  }
  for (const c of m.changed) {
    lines.push(
      `  ~ ${c.sourceModel}#${c.source} ⇒ ${c.target} — ${c.aspects.join(', ')}`,
    );
  }
  for (const d of m.coverageDelta) {
    lines.push(`  coverage ${d.namespace}#${d.component}: ${d.from} → ${d.to}`);
  }

  lines.push('');
  if (diff.clauseDrift.length === 0) {
    lines.push('clause drift: none');
  } else {
    lines.push('clause drift:');
    lines.push(
      `  ${'doc'.padEnd(26)} ${'clause (old)'.padEnd(13)} ${'clause (new)'.padEnd(13)} ${'kind'.padEnd(10)} ${'text'.padEnd(11)} cited by`,
    );
    for (const r of diff.clauseDrift) {
      const cited = r.citedBy.map(e => e.id).join(', ');
      lines.push(
        `  ${r.doc.padEnd(26)} ${(r.from || '—').padEnd(13)} ${(r.to || '—').padEnd(13)} ${r.kind.padEnd(10)} ${r.text.padEnd(11)} ${cited}`,
      );
    }
  }
  return lines.join('\n');
}
