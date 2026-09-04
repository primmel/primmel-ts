// ─────────────────────────────────────────────────────────────────────
// Retrieval export (primmel/primmel-ts#65 — the AI-native retrieval
// projection): the canonical, versioned serialization of a package's
// typed units for RAG and agent consumers.
//
// A Primmel package carries knowledge no document format holds — the
// machine limits, the applicability filters, the acceptance chains, the
// subject-intrinsic constraints. Retrieval consumers (the OIML SMART
// estate's model plane first among them) project every package into
// typed units and index them next to the prose corpus; today each
// consumer re-derives that projection and the re-derivation is where
// the mapping bugs live. This module is the UPSTREAM canonical form of
// that projection: one export, one contract, versioned as
// `primmel-retrieval/1`.
//
// The contract (the four guarantees the issue asks for):
//
//   1. CLAUSE URNS FIRST-CLASS, ALWAYS. Every unit's provenance is the
//      DOCUMENT's own clause numbering plus the document identifier —
//      `clause: { doc, clause, urn }` with urn = <doc>#clause-<clause>
//      (e.g. urn:oiml:pub:r:60-1:2021#clause-3.6). A producer-internal
//      anchor (a metanorma UUID, `_eb46a3a3-…` style) is NOT a clause:
//      it rides as the optional `anchor` extra, never as the clause,
//      and units whose only provenance is an anchor are counted in the
//      stats (anchorOnlyProvenance) — visible debt, never silently
//      presented as citable provenance.
//   2. CANONICAL EDITION SEMANTICS. The document block exposes two
//      distinct, stable fields: `edition` (the PUBLICATION edition the
//      model corresponds to — the manifest's newest `editions` entry,
//      the baseUrn's year segment as fallback) and `model_version`
//      (the package's own `version`). Edition steering reads the first;
//      freshness gating reads the second; neither ever borrows the
//      other's value.
//   4. STABLE UNIT IDS + CONTENT DIGESTS. Unit ids are the package's
//      OWN authored identifiers (requirement `/req/class-a/mpe`, term
//      `/term/durability`, …) — the stability tier is STABLE PUBLIC
//      IDENTIFIER: an id moves only when the package re-authors the
//      identifier, and a rename of display text (name/label/statement)
//      never moves it. Beside the id rides `content_hash` — sha256 over
//      the unit's canonical JSON content (sorted keys, compact
//      separators, UTF-8 — the form every JSON stack reproduces:
//      `json.dumps(c, sort_keys=True, separators=(",", ":"),
//      ensure_ascii=False)`). Identity = id; currency = digest. A
//      rename moves the digest, never the id.
//   6. THE MACHINE PASSPORT. Every unit carries `passport` — the
//      compact digest an agent (an MCP server) can carry and verify
//      without loading the package: kind, id, the headline text
//      (statement/definition), the machine expression (limit / check /
//      derivation), the declared units, the applicability summary, the
//      acceptance summary, the provenance URNs, and the content hash.
//      `passportCanonical` renders it as the canonical string form.
//
// Congruence with the deployed consumer (oimlsmart/smart
// derive-model-plane.ts → oimlsmart/rag model_plane.py): the unit ids,
// the clause { doc, clause, urn } shape, the sha256 currency signal,
// and the bundle-level `source_hash` (the SAME algorithm — sha256 over
// every byte of the package directory, sorted walk, path + NUL +
// file-digest + LF) are deliberately identical so the consumer's pins
// (`standard → { source_hash, node_count }`) key without translation.
// The deliberate divergences: the document block nests under `package`
// (the bundle carries label/base_urn top-level), the digest input is
// the compact-canonical JSON documented above (the consumer's D1
// content_hash uses Python's default separators — the input shapes
// differ regardless), and the kind vocabulary is the kernel's honest
// one (a calculation with a rule type is `formula`, matching the
// consumer's calculations/formulas split; a verdict is `characteristic`,
// matching the deployed plane's characteristics.yaml projection).
//
// ONE-WAY PROJECTION, NEVER THE KERNEL'S TRUTH — the same doctrine as
// the ReqIF/RDF surfaces: the package stays the single source of truth;
// the export is generated, never authored, never re-imported.
//
// The facet (a pre-flattened scalar metadata map per unit — the issue's
// ask 3) and the language-tagged variants (ask 7) layer onto this core;
// the diff-as-data API (ask 5) is the model diff's (src/model-diff.ts),
// whose id keying this projection shares.
// ─────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type Standard from '../types/Standard';
import type { PackageManifest } from '../types/Package';
import type { Requirement } from '../types/Requirement';
import type ConformanceTest from '../types/ConformanceTest';
import type Term from '../types/Term';
import type Calculation from '../types/Calculation';
import type Symbol from '../types/Symbol';
import type Constraint from '../types/Constraint';
import type Table from '../types/Table';
import type Note from '../types/Note';
import type Verdict from '../types/Verdict';
import type { TestSequence } from '../types/TestSequence';
import type StateMachine from '../types/StateMachine';
import type { ApplicabilityEntry } from '../types/Form';
import type {
  AttributeDefinition,
  Behavior,
  ClassificationDimension,
} from '../types/Subject';
import { loadPackageWithIssues } from '../ser-des/package';

/**
 * The projection shape version (semver'd by the document, not the
 * package): a shape change — a field renamed, removed, or re-typed —
 * bumps the version and is a re-index signal for every consumer;
 * additive fields within a version are legal (consumers ignore what
 * they do not read).
 */
export const RETRIEVAL_PROJECTION = 'primmel-retrieval/1';

/** The unit kind vocabulary (the consumer's tokens where deployed). */
export type RetrievalUnitKind =
  | 'requirement'
  | 'conformance_test'
  | 'term'
  | 'attribute'
  | 'behavior'
  | 'calculation'
  | 'formula'
  | 'symbol'
  | 'constraint'
  | 'characteristic'
  | 'table'
  | 'sequence'
  | 'note'
  | 'state_machine'
  | 'dimension';

/**
 * One provenance edge of a unit, normalized onto the DOCUMENT's own
 * numbering (ask 1). `clause` is always the document's clause number —
 * a producer-internal anchor (a metanorma UUID, or a non-clause
 * fragment such as a table anchor) rides as `anchor`, an optional
 * EXTRA, never the only machine reference the unit carries.
 */
export interface RetrievalClause {
  /** The document identifier (the edition-carrying publication URN). */
  doc: string;
  /** The document's own clause number ('' when the source names none). */
  clause: string;
  /**
   * The citable URN: `<doc>#clause-<clause>` when a clause is known
   * (plus the `/s<N>` sentence sub-address when carried), `<doc>#<anchor>`
   * when only a non-UUID fragment anchor is known, the bare doc otherwise.
   */
  urn: string;
  /** The producer-internal anchor the source carried — optional extra. */
  anchor?: string;
  /** The sentence sub-address (TODO.roadmap/26's fragment grammar). */
  fragment?: string;
}

/**
 * The machine passport (ask 6): the compact per-unit digest an agent
 * carries and verifies without loading the package. Every field is
 * present (empty string / empty list when the unit declares nothing) so
 * the canonical serialized form has one shape per passport version.
 */
export interface UnitPassport {
  /** The passport shape version. */
  v: 1;
  kind: RetrievalUnitKind;
  id: string;
  /** The headline prose: statement ?? definition ?? name. */
  text: string;
  /** The machine expression (limit OCL / check / derivation / formula). */
  expression: string;
  /** The declared measurement units (sorted, de-duplicated). */
  units: string[];
  /** The applicability filter, canonical-compact ('' = applies to all). */
  applicability: string;
  /** The acceptance summary ('' when the unit declares none). */
  acceptance: string;
  /** The provenance clause URNs (document-numbered form). */
  provenance: string[];
  /** The unit's content hash (the currency signal — see the unit). */
  content_hash: string;
}

/**
 * One typed retrieval unit — the atom a RAG consumer indexes. Fields
 * are omitted when the unit declares nothing for them (the canonical
 * JSON stays tight); `id`, `kind`, `content_hash`, and `passport` are
 * always present.
 */
export interface RetrievalUnit {
  /**
   * The package-authored identifier — a STABLE PUBLIC IDENTIFIER (the
   * contract's stability tier): it moves only when the package
   * re-authors the identifier; a rename of display text never moves it.
   */
  id: string;
  kind: RetrievalUnitKind;
  /** The parent class/scope id (requirements, conformance tests). */
  class?: string;
  name?: string;
  statement?: string;
  definition?: string;
  guidance?: string;
  obligation?: string;
  /** The limit modality (requirements): the declared token, shall default. */
  modality?: string;
  /** The machine expression the unit carries (limit OCL, check, derive). */
  expression?: string;
  /** The expression's declared inputs (limit uses / derivation inputs). */
  expression_inputs?: string[];
  /** The declared measurement units (sorted, de-duplicated). */
  units?: string[];
  /** The classification applicability filter (typed, as authored). */
  applicability?: ApplicabilityEntry[];
  /** Subject-chain paths the unit binds (the INV-3 discipline). */
  binds_to?: string[];
  /** Requirement ids a conformance test verifies. */
  targets?: string[];
  /** The acceptance chain, compact (accepts triple / pass_if / criteria). */
  acceptance?: string;
  /** The raw acceptance-criteria block (requirements) when authored. */
  acceptance_criteria?: string;
  /** The verification method + description (requirements). */
  verification?: { method: string; description: string };
  /** The channel dimension a requirement is verified per value of. */
  channel?: string;
  /** Requirement/test ids this unit depends on. */
  dependencies?: string[];
  /** Kind-specific payload (typed IO, table columns, sequence steps…). */
  payload?: Record<string, unknown>;
  /** The primary provenance edge (the first of `clauses`). */
  clause?: RetrievalClause;
  /** Every provenance edge, in authored order, de-duplicated by URN. */
  clauses?: RetrievalClause[];
  /**
   * sha256 over the unit's canonical JSON content (every field above,
   * content_hash and passport excluded): the currency signal. Identity
   * is the id; the digest says whether the CONTENT moved.
   */
  content_hash: string;
  /** The machine passport (ask 6) — the compact verifiable digest. */
  passport: UnitPassport;
}

/**
 * The document block (ask 2): `edition` and `model_version` are two
 * distinct, stable fields — the publication edition the model
 * corresponds to, and the package's own version. Neither ever borrows
 * the other's value.
 */
export interface RetrievalPackage {
  id: string;
  title: string;
  kind: string;
  /** The publication edition (the manifest's newest editions entry). */
  edition: string;
  /** The package's own version (the manifest `version`). */
  model_version: string;
  /** The publication-edition register, newest first. */
  editions: string[];
  base_urn: string;
  status?: string;
  /** The package's default spelling (ISO 24229 code, e.g. eng-Latn). */
  default_spelling: string;
  /** The declared spelling set (the default plus localizations). */
  spellings: string[];
  /** The earlier-edition package URNs this edition supersedes. */
  supersedes?: string[];
}

/** The retrieval document: the versioned projection of one package. */
export interface RetrievalDocument {
  projection: typeof RETRIEVAL_PROJECTION;
  package: RetrievalPackage;
  /**
   * sha256 over every byte of the package directory (the freshness
   * signal — the SAME algorithm the deployed consumer's
   * derive-model-plane.ts runs, so the pins key without translation).
   * Present when the export ran from a directory; absent on the pure
   * Standard form.
   */
  source_hash?: string;
  units: RetrievalUnit[];
}

/** Tallies + honesty bookkeeping for one export run. */
export interface RetrievalExportStats {
  units: number;
  /** Per-kind tallies (only kinds with at least one unit appear). */
  byKind: Partial<Record<RetrievalUnitKind, number>>;
  /** Units carrying at least one document-numbered clause edge. */
  withClause: number;
  /**
   * Units whose ONLY provenance is a producer-internal anchor (a UUID
   * or fragment, never a clause number) — the ask-1 debt, counted so it
   * is visible, never silently presented as citable provenance.
   */
  anchorOnlyProvenance: number;
  /**
   * Units with at least one edge whose doc is NOT a publication URN (a
   * legacy doc token like "OIML-V1") — provenance that names no document
   * identifier, the same debt class ask 1 names, counted for visibility.
   */
  nonUrnDocRefs: number;
  /** Units with no provenance at all. */
  withoutProvenance: number;
}

/** The export product: the document, its canonical JSON, and the stats. */
export interface RetrievalExport {
  document: RetrievalDocument;
  /**
   * The canonical serialization: UTF-8 JSON, object keys sorted
   * recursively, two-space indent, trailing newline — byte-deterministic
   * per package state (the deployed consumer's bundle byte format).
   */
  json: string;
  stats: RetrievalExportStats;
}

// ── canonical JSON + the content digest ──────────────────────────────

/** Recursive key sort — the digest and serialization canonicalizer. */
function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) {
    return v.map(sortDeep);
  }
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      const val = sortDeep((v as Record<string, unknown>)[k]);
      if (val !== undefined) {
        out[k] = val;
      }
    }
    return out;
  }
  return v;
}

/**
 * The canonical JSON form: sorted keys, compact separators, UTF-8 — the
 * form every JSON stack reproduces (`json.dumps(c, sort_keys=True,
 * separators=(",", ":"), ensure_ascii=False)`). The digest input.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

/** sha256 hex over the canonical JSON of a value — the currency digest. */
export function retrievalDigest(value: unknown): string {
  return createHash('sha256')
    .update(canonicalJson(value), 'utf8')
    .digest('hex');
}

/**
 * The canonical serialized form of a unit's passport (ask 6): the
 * string an agent carries and re-hashes to verify the unit.
 */
export function passportCanonical(passport: UnitPassport): string {
  return canonicalJson(passport);
}

// ── the package source hash (the bundle freshness signal) ────────────

function* walkPackage(dir: string): Generator<string> {
  for (const entry of readdirSync(dir).sort()) {
    if (entry === '.DS_Store') {
      continue;
    }
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      yield* walkPackage(p);
    } else {
      yield p;
    }
  }
}

/**
 * sha256 over every file of the package (path + bytes), deterministic —
 * the SAME algorithm the deployed consumer's derive-model-plane.ts runs
 * (sorted walk, `.DS_Store` skipped, relative path + NUL + the file's
 * own sha256 + LF), so a source_hash here and a source_hash there are
 * the same signal and the consumer's pins key without translation. ANY
 * package change — a constraint re-authored, a clause re-cited — moves
 * the hash; that byte-sensitivity is deliberate (identity rides the
 * unit ids, currency rides the digests).
 */
export function packageSourceHash(dir: string): string {
  const h = createHash('sha256');
  for (const file of walkPackage(dir)) {
    h.update(relative(dir, file));
    h.update('\0');
    h.update(createHash('sha256').update(readFileSync(file)).digest());
    h.update('\n');
  }
  return h.digest('hex');
}

// ── provenance: the clause-URN normalization (ask 1) ─────────────────

/**
 * A producer-internal anchor is never a clause: the metanorma UUID form
 * (`_eb46a3a3-…` — the shape the consumer strips at ingestion) is
 * detected exactly like the consumer detects it.
 */
const UUID_ANCHOR = /^_?[0-9a-f]{8}-[0-9a-f]{4}-/i;

const DOC_FRAGMENT = /#([^#]*)$/;

interface RawRef {
  doc?: string;
  clause?: string;
  fragment?: string;
}

/**
 * Normalize one raw provenance edge onto the document's own numbering.
 * The `doc` slot of a loaded ref may carry an embedded `#fragment` (the
 * derives-from fold's shape for non-clause anchors — ref.ts); a
 * `#clause-<n>` fragment restores the clause, any other fragment rides
 * as the `anchor` extra. A UUID-shaped clause or fragment is an anchor,
 * never a clause.
 */
export function normalizeClause(
  doc: string,
  clause: string,
  fragment = '',
): RetrievalClause {
  let rest = doc ?? '';
  let clauseOut = clause ?? '';
  let frag = fragment ?? '';
  let anchor: string | undefined;
  const hash = DOC_FRAGMENT.exec(rest);
  if (hash) {
    rest = rest.slice(0, hash.index);
    const embedded = hash[1] ?? '';
    if (!clauseOut && embedded.startsWith('clause-')) {
      const tail = embedded.slice('clause-'.length);
      const slash = tail.indexOf('/');
      if (slash >= 0) {
        clauseOut = tail.slice(0, slash);
        if (!frag) {
          frag = tail.slice(slash + 1);
        }
      } else {
        clauseOut = tail;
      }
    } else if (embedded && !frag) {
      // A non-clause fragment (a table anchor, a UUID) is an anchor,
      // never a clause number.
      anchor = embedded;
    } else if (embedded) {
      anchor = embedded;
    }
  }
  if (clauseOut && UUID_ANCHOR.test(clauseOut)) {
    // A UUID in the clause slot is a producer-internal anchor that lost
    // its way — demote it, never present it as the document's numbering.
    anchor = anchor ?? clauseOut;
    clauseOut = '';
  }
  const urn =
    rest +
    (clauseOut
      ? `#clause-${clauseOut}${frag ? `/${frag}` : ''}`
      : anchor && !UUID_ANCHOR.test(anchor)
        ? `#${anchor}`
        : '');
  const out: RetrievalClause = { doc: rest, clause: clauseOut, urn };
  if (anchor !== undefined) {
    out.anchor = anchor;
  }
  if (frag) {
    out.fragment = frag;
  }
  return out;
}

/** A ref target that is a document URN folds into provenance (the §18.4
 *  citation fold's defensive mirror — after a package load the fold has
 *  already run; a hand-built Standard may carry them unfolded). */
function refTargetClause(target: string): RawRef | null {
  const m = /^(urn:[^#]+)(?:#(.+))?$/.exec(target);
  if (!m) {
    return null;
  }
  return { doc: m[1], clause: '', fragment: m[2] ?? '' };
}

/**
 * Collect every provenance edge of an element, normalized and
 * de-duplicated by URN, in authored order: the structured channels
 * (source / sourceRef / sourceRefs), the scalar reference URN (the
 * conformance test's v2 channel), and urn-targeted refs not already
 * folded. The first edge is the unit's primary `clause`.
 */
export function collectClauses(el: {
  source?: RawRef | null;
  sourceRef?: RawRef | null;
  sourceRefs?: RawRef[] | null;
  reference?: string;
  refs?: { predicate: string; target: string }[] | null;
}): RetrievalClause[] {
  const out: RetrievalClause[] = [];
  const seen = new Set<string>();
  const push = (r: RawRef | null | undefined): void => {
    if (!r || (!r.doc && !r.clause)) {
      return;
    }
    const c = normalizeClause(r.doc ?? '', r.clause ?? '', r.fragment);
    if (!seen.has(c.urn)) {
      seen.add(c.urn);
      out.push(c);
    }
  };
  push(el.source);
  push(el.sourceRef);
  for (const r of el.sourceRefs ?? []) {
    push(r);
  }
  // The conformance test's scalar reference (v2) arrives quote-wrapped
  // from the codec's legacy path — strip before the URN test.
  const reference = (el.reference ?? '').replace(/^"|"$/g, '');
  if (reference.startsWith('urn:')) {
    push(refTargetClause(reference));
  }
  for (const r of el.refs ?? []) {
    if (r && typeof r.target === 'string' && r.target.startsWith('urn:')) {
      push(refTargetClause(r.target));
    }
  }
  return out;
}

/**
 * A term's provenance (ask 1's sharpest case): the `source` facet is a
 * plain string carrying whitespace-separated URNs (e.g. the VIML URN
 * plus the Recommendation's clause URN); each parses onto a normalized
 * edge. When no parsed edge carries a clause number and the term
 * declares a `section` (the document's own terminology clause), the
 * section becomes an edge on the package's base URN — the document's
 * own numbering, exactly as authored.
 */
export function termClauses(term: Term, baseUrn: string): RetrievalClause[] {
  const out: RetrievalClause[] = [];
  const seen = new Set<string>();
  const push = (c: RetrievalClause | null): void => {
    if (c && !seen.has(c.urn)) {
      seen.add(c.urn);
      out.push(c);
    }
  };
  for (const token of (term.source ?? '').split(/\s+/).filter(t => t)) {
    push(token.startsWith('urn:') ? normalizeClause(token, '') : null);
  }
  if (term.section && !out.some(c => c.clause)) {
    push(normalizeClause(baseUrn, term.section));
  }
  return out;
}

// ── the passport (ask 6) ─────────────────────────────────────────────

/** The canonical-compact applicability summary: `dim=v1|v2; …`, sorted. */
export function applicabilitySummary(
  entries: ApplicabilityEntry[] | undefined,
): string {
  return (entries ?? [])
    .map(e => {
      const mode = e.match && e.match !== 'any' ? `(${e.match})` : '';
      return `${e.dimension}${mode}=${[...e.values].sort().join('|')}`;
    })
    .sort()
    .join(';');
}

function passportOf(unit: Omit<RetrievalUnit, 'passport'>): UnitPassport {
  return {
    v: 1,
    kind: unit.kind,
    id: unit.id,
    text: unit.statement ?? unit.definition ?? unit.name ?? '',
    expression: unit.expression ?? '',
    units: unit.units ?? [],
    applicability: applicabilitySummary(unit.applicability),
    acceptance: unit.acceptance ?? '',
    provenance: (unit.clauses ?? []).map(c => c.urn),
    content_hash: unit.content_hash,
  };
}

// ── unit construction ────────────────────────────────────────────────

/**
 * The fields that participate in a unit's content digest: everything
 * the consumer indexes — the projected content, the normalized
 * provenance — minus the digest and passport themselves.
 */
type UnitContent = Omit<RetrievalUnit, 'content_hash' | 'passport'>;

function finalize(
  content: UnitContent,
  clauses: RetrievalClause[],
): RetrievalUnit {
  if (clauses.length > 0) {
    content.clause = clauses[0];
    content.clauses = clauses;
  }
  const hash = retrievalDigest(content);
  const unit: RetrievalUnit = {
    ...content,
    content_hash: hash,
  } as RetrievalUnit;
  unit.passport = passportOf(unit);
  return unit;
}

/** The parent class/scope id of a scoped id (`/req/a/b` → `/req/a`). */
function scopeOf(id: string): string | undefined {
  const slash = id.lastIndexOf('/');
  return slash > 0 ? id.slice(0, slash) : undefined;
}

const present = (s: string | undefined | null): s is string =>
  typeof s === 'string' && s.length > 0;

const presentList = <T>(xs: T[] | undefined | null): T[] | undefined =>
  xs && xs.length > 0 ? xs : undefined;

function requirementUnit(r: Requirement): RetrievalUnit {
  return finalize(
    {
      id: r.id,
      kind: 'requirement',
      ...(scopeOf(r.id) ? { class: scopeOf(r.id) } : {}),
      ...(present(r.name) ? { name: r.name } : {}),
      ...(present(r.statement) ? { statement: r.statement } : {}),
      ...(present(r.guidance) ? { guidance: r.guidance } : {}),
      ...(present(r.obligation) ? { obligation: r.obligation } : {}),
      modality: r.limit?.modality || 'shall',
      ...(r.limit?.expression
        ? {
            expression: r.limit.expression,
            ...(presentList(r.limit.uses)
              ? { expression_inputs: r.limit.uses }
              : {}),
          }
        : {}),
      ...(presentList(r.applicability)
        ? { applicability: r.applicability }
        : {}),
      ...(presentList(r.bindsTo) ? { binds_to: r.bindsTo } : {}),
      ...(r.limit?.accepts
        ? {
            acceptance: `${r.limit.accepts.verdict} ${r.limit.accepts.op} ${r.limit.accepts.limit}`,
          }
        : {}),
      ...(present(r.acceptanceCriteria)
        ? { acceptance_criteria: r.acceptanceCriteria }
        : {}),
      ...(present(r.verificationMethod)
        ? {
            verification: {
              method: r.verificationMethod,
              description: r.verificationDescription ?? '',
            },
          }
        : {}),
      ...(present(r.channel) ? { channel: r.channel } : {}),
      ...(presentList(r.dependencies) ? { dependencies: r.dependencies } : {}),
    },
    collectClauses(r),
  );
}

function conformanceTestUnit(t: ConformanceTest): RetrievalUnit {
  const payload: Record<string, unknown> = {
    ...(present(t.kind) ? { test_kind: t.kind } : {}),
    ...(present(t.methodRef) ? { method_ref: t.methodRef } : {}),
    ...(presentList(t.preconditions)
      ? {
          preconditions: t.preconditions.map(p => ({
            id: p.id,
            check: p.check,
            description: p.description,
            on_violation: p.onViolation,
          })),
        }
      : {}),
  };
  return finalize(
    {
      id: t.id,
      kind: 'conformance_test',
      ...(scopeOf(t.id) ? { class: scopeOf(t.id) } : {}),
      ...(present(t.name) ? { name: t.name } : {}),
      ...(present(t.purpose) ? { statement: t.purpose } : {}),
      ...(present(t.method) ? { definition: t.method } : {}),
      ...(present(t.guidance) ? { guidance: t.guidance } : {}),
      ...(present(t.obligation) ? { obligation: t.obligation } : {}),
      ...(presentList(t.applicability)
        ? { applicability: t.applicability }
        : {}),
      ...(presentList(t.targets) ? { targets: t.targets } : {}),
      ...(presentList(t.bindsTo) ? { binds_to: t.bindsTo } : {}),
      ...(present(t.acceptancePassIf)
        ? { acceptance: t.acceptancePassIf }
        : present(t.acceptanceCriteriaDescription)
          ? { acceptance: t.acceptanceCriteriaDescription }
          : {}),
      ...(presentList(t.dependencies) ? { dependencies: t.dependencies } : {}),
      ...(Object.keys(payload).length > 0 ? { payload } : {}),
    },
    collectClauses(t),
  );
}

function termUnit(t: Term, baseUrn: string): RetrievalUnit {
  const payload: Record<string, unknown> = {
    ...(present(t.section) ? { section: t.section } : {}),
    ...(present(t.language) ? { language: t.language } : {}),
    ...(t.vocabRef ? { vocab_ref: t.vocabRef } : {}),
    ...(presentList(t.alt) ? { alt: t.alt } : {}),
    ...(presentList(t.abbreviations) ? { abbreviations: t.abbreviations } : {}),
    ...(presentList(t.seeAlso) ? { see_also: t.seeAlso } : {}),
  };
  return finalize(
    {
      id: `/term/${t.id}`,
      kind: 'term',
      ...(present(t.label) ? { name: t.label } : {}),
      ...(present(t.definition) ? { definition: t.definition } : {}),
      ...(Object.keys(payload).length > 0 ? { payload } : {}),
    },
    termClauses(t, baseUrn),
  );
}

function attributeUnit(a: AttributeDefinition): RetrievalUnit {
  const payload: Record<string, unknown> = {
    ...(present(a.symbol) ? { symbol: a.symbol } : {}),
    ...(present(a.quantityKind) ? { quantity_kind: a.quantityKind } : {}),
    ...(present(a.valueType) ? { value_type: a.valueType } : {}),
    ...(present(a.origin) ? { origin: a.origin } : {}),
    ...(present(a.scope) ? { scope: a.scope } : {}),
    ...(present(a.category) ? { category: a.category } : {}),
    ...(present(a.irdi) ? { irdi: a.irdi } : {}),
    ...(presentList(a.enumValues) ? { enum_values: a.enumValues } : {}),
  };
  return finalize(
    {
      id: `/attribute/${a.id}`,
      kind: 'attribute',
      ...(present(a.name) ? { name: a.name } : {}),
      ...(present(a.definition) ? { definition: a.definition } : {}),
      ...(present(a.unit) && a.unit !== '1' ? { units: [a.unit] } : {}),
      ...(Object.keys(payload).length > 0 ? { payload } : {}),
    },
    collectClauses(a),
  );
}

function behaviorUnit(b: Behavior): RetrievalUnit {
  const payload: Record<string, unknown> = {
    ...(present(b.kind) ? { behavior_kind: b.kind } : {}),
    ...(present(b.stimulus) ? { stimulus: b.stimulus } : {}),
  };
  return finalize(
    {
      id: `/behavior/${b.id}`,
      kind: 'behavior',
      name: b.id,
      ...(present(b.response) ? { statement: b.response } : {}),
      ...(Object.keys(payload).length > 0 ? { payload } : {}),
    },
    collectClauses(b),
  );
}

function calculationUnits(c: Calculation): string[] {
  const out = new Set<string>();
  for (const i of c.inputs ?? []) {
    if (present(i.unit) && i.unit !== '1') {
      out.add(i.unit);
    }
  }
  if (c.output && present(c.output.unit) && c.output.unit !== '1') {
    out.add(c.output.unit);
  }
  return [...out].sort();
}

function calculationUnit(c: Calculation): RetrievalUnit {
  // The consumer's calculations/formulas split: a calculation carrying
  // an engine rule type projects as a `formula` unit (the operator
  // signature), the rest as `calculation` (typed IO).
  const kind: RetrievalUnitKind = present(c.ruleType)
    ? 'formula'
    : 'calculation';
  const units = calculationUnits(c);
  const payload: Record<string, unknown> = {
    name: c.name,
    ...(present(c.ruleType) ? { rule_type: c.ruleType } : {}),
    ...(present(c.category) ? { category: c.category } : {}),
    ...(presentList(c.inputs)
      ? {
          inputs: c.inputs.map(i => ({
            name: i.name,
            type: i.type,
            ...(present(i.unit) ? { unit: i.unit } : {}),
          })),
        }
      : {}),
    ...(c.output && present(c.output.type) ? { output: c.output } : {}),
    ...(c.lookup ? { lookup: c.lookup } : {}),
    ...(present(c.profile) ? { profile: c.profile } : {}),
  };
  return finalize(
    {
      id: present(c.identifier) ? c.identifier! : `/calculation/${c.id}`,
      kind,
      name: c.label || c.name || c.id,
      ...(present(c.description) ? { definition: c.description } : {}),
      ...(present(c.expression) ? { expression: c.expression } : {}),
      ...(presentList(c.params) ? { expression_inputs: c.params } : {}),
      ...(units.length > 0 ? { units } : {}),
      payload,
    },
    collectClauses({
      sourceRef: c.sourceRef,
      sourceRefs: c.sourceRefs,
      refs: c.refs,
    }),
  );
}

function symbolUnit(s: Symbol): RetrievalUnit {
  const units = present(s.unit) && s.unit !== '1' ? [s.unit] : undefined;
  const payload: Record<string, unknown> = {
    ...(present(s.type) ? { symbol_type: s.type } : {}),
    ...(present(s.kind) ? { symbol_kind: s.kind } : {}),
    ...(present(s.quantityKind) ? { quantity_kind: s.quantityKind } : {}),
    ...(present(s.origin) ? { origin: s.origin } : {}),
    ...(present(s.latex) ? { latex: s.latex } : {}),
    ...(s.formula && present(s.formula.display)
      ? { display: s.formula.display }
      : {}),
    ...(present(s.calculation) ? { calculation: s.calculation } : {}),
  };
  return finalize(
    {
      id: `/symbol/${s.id}`,
      kind: 'symbol',
      ...(present(s.name) ? { name: s.name } : {}),
      ...(present(s.definition) ? { definition: s.definition } : {}),
      ...(s.formula && present(s.formula.expression)
        ? {
            expression: s.formula.expression,
            ...(presentList(s.formula.inputs)
              ? { expression_inputs: s.formula.inputs }
              : {}),
          }
        : {}),
      ...(units ? { units } : {}),
      ...(Object.keys(payload).length > 0 ? { payload } : {}),
    },
    collectClauses({
      sourceRef: s.sourceRef,
      sourceRefs: s.sourceRefs,
      refs: s.refs,
    }),
  );
}

function constraintUnit(c: Constraint): RetrievalUnit {
  return finalize(
    {
      id: `/constraint/${c.id}`,
      kind: 'constraint',
      ...(present(c.name) ? { name: c.name } : {}),
      ...(present(c.violationMeaning) ? { statement: c.violationMeaning } : {}),
      ...(present(c.check) ? { expression: c.check } : {}),
      payload: {
        ...(present(c.stereotype) ? { stereotype: c.stereotype } : {}),
        ...(present(c.onViolation) ? { on_violation: c.onViolation } : {}),
      },
    },
    collectClauses(c),
  );
}

function characteristicUnit(v: Verdict): RetrievalUnit {
  // The deployed plane's `characteristic` kind: the canonical verdict
  // quantity (derive once, reference everywhere).
  const units = present(v.unit) && v.unit !== '1' ? [v.unit] : undefined;
  const payload: Record<string, unknown> = {
    ...(present(v.behavior) ? { behavior: v.behavior } : {}),
    ...(present(v.quantityKind) ? { quantity_kind: v.quantityKind } : {}),
    ...(v.seriesReduction ? { series_reduction: v.seriesReduction } : {}),
  };
  return finalize(
    {
      id: `/characteristic/${v.id}`,
      kind: 'characteristic',
      ...(present(v.symbol) ? { name: v.symbol } : {}),
      ...(present(v.derive)
        ? {
            expression: v.derive,
            ...(presentList(v.inputs) ? { expression_inputs: v.inputs } : {}),
          }
        : {}),
      ...(units ? { units } : {}),
      ...(v.acceptance && present(v.acceptance.rule)
        ? { acceptance: v.acceptance.rule }
        : {}),
      ...(Object.keys(payload).length > 0 ? { payload } : {}),
    },
    collectClauses(v),
  );
}

function tableUnit(t: Table): RetrievalUnit {
  const units = (t.columnDefs ?? [])
    .map(c => c.unit)
    .filter(u => present(u) && u !== '1')
    .sort();
  const payload: Record<string, unknown> = {
    ...(presentList(t.columnDefs)
      ? {
          columns: t.columnDefs!.map(c => ({
            name: c.name,
            type: c.type,
            ...(present(c.unit) ? { unit: c.unit } : {}),
          })),
        }
      : present(t.columns)
        ? { columns: t.columns }
        : {}),
    ...(presentList(t.data) ? { rows: t.data } : {}),
    ...(t.profiles ? { profiles: t.profiles } : {}),
  };
  return finalize(
    {
      id: `/table/${t.id}`,
      kind: 'table',
      ...(present(t.title) ? { name: t.title } : {}),
      ...(present(t.description) ? { definition: t.description } : {}),
      ...(units.length > 0 ? { units: [...new Set(units)] } : {}),
      ...(Object.keys(payload).length > 0 ? { payload } : {}),
    },
    collectClauses({
      sourceRef: t.sourceRef,
      sourceRefs: t.sourceRefs,
      refs: t.refs,
    }),
  );
}

function sequenceUnit(s: TestSequence): RetrievalUnit {
  const payload: Record<string, unknown> = {
    steps: s.steps.map(st => ({
      order: st.order,
      ...(present(st.test) ? { test: st.test } : {}),
      ...(present(st.phase) ? { phase: st.phase } : {}),
      ...(present(st.role) ? { role: st.role } : {}),
      ...(st.dependsOn !== null ? { depends_on: st.dependsOn } : {}),
    })),
    ...(present(s.sampleApplicability)
      ? { sample_applicability: s.sampleApplicability }
      : {}),
  };
  return finalize(
    {
      id: `/sequence/${s.id}`,
      kind: 'sequence',
      ...(present(s.name) ? { name: s.name } : {}),
      ...(present(s.description) ? { statement: s.description } : {}),
      payload,
    },
    collectClauses({ sourceRefs: s.sourceRefs, refs: s.refs }),
  );
}

function noteUnit(n: Note): RetrievalUnit {
  return finalize(
    {
      id: `/note/${n.id}`,
      kind: 'note',
      name: n.type,
      ...(present(n.message) ? { statement: n.message } : {}),
    },
    [],
  );
}

function stateMachineUnit(m: StateMachine): RetrievalUnit {
  // The state machine keys by the bound entity's name (the construct
  // declares no id — the model diff's E12 keying).
  const id = m.entityName;
  const payload: Record<string, unknown> = {
    ...(present(m.kind) ? { machine_kind: m.kind } : {}),
    ...(present(m.initialState) ? { initial: m.initialState } : {}),
    ...(presentList(m.states) ? { states: m.states.map(s => s.name) } : {}),
    ...(presentList(m.transitions)
      ? {
          transitions: m.transitions.map(t => ({
            from: t.from,
            to: t.to,
            ...(present(t.actionName) ? { action: t.actionName } : {}),
            ...(present(t.guard) ? { guard: t.guard } : {}),
          })),
        }
      : {}),
  };
  return finalize(
    {
      id: `/state-machine/${id}`,
      kind: 'state_machine',
      name: id,
      ...(Object.keys(payload).length > 0 ? { payload } : {}),
    },
    [],
  );
}

function dimensionUnit(d: ClassificationDimension): RetrievalUnit {
  const payload: Record<string, unknown> = {
    ...(present(d.scope) ? { scope: d.scope } : {}),
    ...(present(d.cardinality) ? { cardinality: d.cardinality } : {}),
    values: d.values.map(v => ({
      id: v.id,
      ...(present(v.label) ? { label: v.label } : {}),
      ...(presentList(v.implies) ? { implies: v.implies } : {}),
      ...(present(v.termRef) ? { term_ref: v.termRef } : {}),
    })),
  };
  return finalize(
    {
      id: `/dimension/${d.id}`,
      kind: 'dimension',
      ...(present(d.label) ? { name: d.label } : {}),
      ...(present(d.description) ? { definition: d.description } : {}),
      payload,
    },
    collectClauses(d),
  );
}

// ── the document block (ask 2) ───────────────────────────────────────

/**
 * The publication edition the model corresponds to: the manifest's
 * newest `editions` entry (the register is newest-first), the base
 * URN's trailing year segment as fallback. NEVER the package version —
 * the two fields answer different questions (edition steering vs
 * freshness gating) and never borrow each other's value.
 */
export function packageEdition(
  manifest: PackageManifest | null | undefined,
): string {
  const first = manifest?.editions?.[0];
  if (present(first)) {
    return first;
  }
  const tail = /:(\d{4})$/.exec(manifest?.baseUrn ?? '');
  return tail?.[1] ?? '';
}

function packageBlock(standard: Standard): RetrievalPackage {
  const m = standard.packageManifest;
  if (m) {
    return {
      id: m.id,
      title: m.title,
      kind: m.kind ?? 'rec',
      edition: packageEdition(m),
      model_version: m.version,
      editions: [...(m.editions ?? [])],
      base_urn: m.baseUrn,
      ...(present(m.status) ? { status: m.status } : {}),
      default_spelling: m.defaultSpelling ?? '',
      spellings: [
        ...(m.spellings ?? (m.defaultSpelling ? [m.defaultSpelling] : [])),
      ],
      ...(presentList(m.supersedes) ? { supersedes: [...m.supersedes!] } : {}),
    };
  }
  // A manifestless Standard (a single-file load): the metadata header
  // carries what the manifest would.
  const meta = standard.meta;
  return {
    id: meta?.namespace ?? '',
    title: meta?.title ?? '',
    kind: '',
    edition: meta?.edition ?? '',
    model_version: '',
    editions: present(meta?.edition) ? [meta!.edition] : [],
    base_urn: '',
    default_spelling: '',
    spellings: [],
  };
}

// ── the export ───────────────────────────────────────────────────────

/** Options for the pure export form. */
export interface RetrievalExportOptions {
  /**
   * A precomputed package source hash (the bundle freshness signal).
   * `exportPackageRetrieval` computes it from the directory; a caller
   * with its own hash pipeline may supply it here.
   */
  sourceHash?: string;
}

/**
 * Project a loaded Standard into the retrieval document (pure — no I/O;
 * the id projection, the clause normalization, the digests).
 */
export function exportStandardRetrieval(
  standard: Standard,
  options: RetrievalExportOptions = {},
): RetrievalExport {
  const pkg = packageBlock(standard);
  const units: RetrievalUnit[] = [];
  for (const r of standard.requirements ?? []) {
    units.push(requirementUnit(r));
  }
  for (const t of standard.conformanceTests ?? []) {
    units.push(conformanceTestUnit(t));
  }
  for (const t of standard.terms ?? []) {
    units.push(termUnit(t, pkg.base_urn));
  }
  for (const a of standard.attributeDefinitions ?? []) {
    units.push(attributeUnit(a));
  }
  for (const b of standard.behaviors ?? []) {
    units.push(behaviorUnit(b));
  }
  for (const c of standard.calculations ?? []) {
    units.push(calculationUnit(c));
  }
  for (const s of standard.symbols ?? []) {
    units.push(symbolUnit(s));
  }
  for (const c of standard.constraints ?? []) {
    units.push(constraintUnit(c));
  }
  for (const v of standard.verdicts ?? []) {
    units.push(characteristicUnit(v));
  }
  for (const t of standard.tables ?? []) {
    units.push(tableUnit(t));
  }
  for (const s of standard.testSequences ?? []) {
    units.push(sequenceUnit(s));
  }
  for (const n of standard.notes ?? []) {
    units.push(noteUnit(n));
  }
  for (const m of standard.stateMachines ?? []) {
    units.push(stateMachineUnit(m));
  }
  for (const i of standard.instruments ?? []) {
    for (const d of i.dimensions ?? []) {
      units.push(dimensionUnit(d));
    }
  }

  const byKind: Partial<Record<RetrievalUnitKind, number>> = {};
  let withClause = 0;
  let anchorOnlyProvenance = 0;
  let nonUrnDocRefs = 0;
  let withoutProvenance = 0;
  for (const u of units) {
    byKind[u.kind] = (byKind[u.kind] ?? 0) + 1;
    const clauses = u.clauses ?? [];
    if (clauses.some(c => c.clause)) {
      withClause++;
    } else if (clauses.length > 0) {
      anchorOnlyProvenance++;
    } else {
      withoutProvenance++;
    }
    if (clauses.some(c => c.doc && !c.doc.startsWith('urn:'))) {
      nonUrnDocRefs++;
    }
  }

  const document: RetrievalDocument = {
    projection: RETRIEVAL_PROJECTION,
    package: pkg,
    ...(options.sourceHash !== undefined
      ? { source_hash: options.sourceHash }
      : {}),
    units,
  };
  return {
    document,
    json: JSON.stringify(sortDeep(document), null, 2) + '\n',
    stats: {
      units: units.length,
      byKind,
      withClause,
      anchorOnlyProvenance,
      nonUrnDocRefs,
      withoutProvenance,
    },
  };
}

/**
 * Export a package directory: load, hash the package bytes (the bundle
 * freshness signal — the deployed consumer's exact algorithm), project.
 */
export function exportPackageRetrieval(dir: string): RetrievalExport {
  const { standard } = loadPackageWithIssues(dir);
  return exportStandardRetrieval(standard, {
    sourceHash: packageSourceHash(dir),
  });
}
