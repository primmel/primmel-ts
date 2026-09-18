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
// `primmel-retrieval/2`.
//
// The contract (the guarantees the issue asks for):
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
//   3. THE FLAT RETRIEVAL FACET. Every unit carries `facet` — one flat
//      scalar map (string values only), versioned as
//      `retrieval-facet/1` on the document's `facet_version`: the
//      document fields (identifier, doc number, doctype, edition,
//      language), the clause anchor, the unit kind, the applicability
//      dimensions (`app_<dim>` keys), and the currency keys (unit_id,
//      unit_hash, model_version). Retrieval indexes accept only scalar
//      metadata per vector; the facet is the canonical pre-flattened
//      form so a consumer's ingestion is a MAPPING, never a
//      re-derivation. The facet is a derived projection of the unit's
//      authored content, so it is EXCLUDED from the content_hash input
//      (identity and currency ride the authored fields; the facet
//      re-derives from them deterministically).
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
//   7. LANGUAGE-TAGGED VARIANTS. Every unit carries `language` — the
//      package's default spelling, the ISO 24229 tag of the INLINE
//      prose values — and, when the package ships `text` blocks,
//      `variants`: the alternate spellings resolved onto the unit by
//      the C89 address rule (the longest registered dot-boundary
//      prefix; the kernel element id, not the namespaced unit id),
//      keyed by the addressed field path, each entry
//      `{ spelling, via?, value }`. Both are authored content and
//      participate in the content_hash; a text block addressed at an
//      element the projection does not ship is counted
//      (droppedTextBlocks), never silently lost.
//   8. THE STRUCTURED ACCEPTANCE (primmel/primmel-ts#84 — the
//      normalize_unit retirement). The acceptance facet carries its
//      structure as JSON, never as a string a consumer re-parses:
//      `acceptance_criteria` is the authored block STRUCTURED (the
//      requirement's raw YAML read by the subset parser in
//      yaml-lite.ts; the conformance test's kernel-typed criteria
//      assembled onto the cc.yaml shape — the items' `pass_if` /
//      `accepts` OCL first-class), `accepts` is the verdict triple
//      `{ verdict, op, limit }` (the limit predicate an OCL field, no
//      longer a `"verdict op limit"` string to split), and `acceptance`
//      is the acceptance DECISION object (rule, guard band, uncertainty
//      budget, criterion taxonomy, statistics). The violation semantics
//      surface top-level too: a constraint's `check` OCL,
//      `violation_meaning`, and `on_violation`; a test's
//      `preconditions` with their run-validity `check` OCL and
//      `on_violation` — out of the `payload` grab bag. The passport
//      keeps its compact acceptance SUMMARY string (v1 shape
//      unchanged), composed from the structured fields.
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
// The diff-as-data API (the issue's ask 5) is the model diff
// (src/model-diff.ts), whose id keying this projection shares.
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
import type { SpellingEntry } from '../types/Text';
import type AcceptanceDecision from '../types/Acceptance';
import type {
  AttributeDefinition,
  Behavior,
  ClassificationDimension,
} from '../types/Subject';
import { loadPackageWithIssues } from '../ser-des/package';
import { parseYamlBlock } from './yaml-lite';

/**
 * The projection shape version (semver'd by the document, not the
 * package): a shape change — a field renamed, removed, or re-typed —
 * bumps the version and is a re-index signal for every consumer;
 * additive fields within a version are legal (consumers ignore what
 * they do not read).
 */
export const RETRIEVAL_PROJECTION = 'primmel-retrieval/2';

/**
 * The facet shape version (ask 3 — the pre-flattened retrieval facet):
 * semver'd independently of the projection — a facet key renamed,
 * removed, or re-typed bumps it (a re-index signal); additive keys
 * within a version are legal (indexes ignore what they do not read).
 */
export const RETRIEVAL_FACET_VERSION = 'retrieval-facet/1';

/**
 * The facet (ask 3): one FLAT scalar map per unit — string values only,
 * no nesting — the metadata a retrieval index accepts per vector. The
 * key set is documented in docs/retrieval-export.md and congruent with
 * the deployed consumer's chunk wire schema where the two overlap.
 */
export type RetrievalFacet = Record<string, string>;

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
 * The structured acceptance binding (the verdict triple, TODO.refactor/04's
 * derive-once discipline): a requirement's `limit.accepts`, and the same
 * shape per conformance-test criterion item. The limit predicate is an
 * OCL FIELD — never the `"verdict op limit"` string a consumer had to
 * split (the string the /1 projection emitted as `acceptance`).
 */
export interface RetrievalAccepts {
  /** The verdict-registry id whose derived value the decision reads. */
  verdict: string;
  /** The comparison applied between the derived value and the limit. */
  op: string;
  /** The limit predicate (OCL) the comparison runs against. */
  limit: string;
}

/**
 * The structured acceptance decision rule (the shared AcceptanceDecision
 * block — data/schemas/{rc,cc,verdicts}.yaml $defs/acceptanceDecision,
 * OIML G 1-106 / R 91-2): how a limit comparison decides conformity.
 * The /1 projection emitted only the rule token as a string; the full
 * authored rule was dropped. Field names follow the wire schema.
 */
export interface RetrievalAcceptanceDecision {
  /** shared_risk | guarded — absent when the package declares no rule
   *  (the consumer's schema defaults it to shared_risk). */
  rule?: string;
  /** The guard band narrowing the effective limit (guarded rule). */
  guard_band?: { kind: string; value: number };
  /** The reference-uncertainty budget (U:MPE ratio cap). */
  uncertainty?: { max_ratio_to_mpe: number };
  /** The verdict criterion taxonomy (R 91-2, 6.1). */
  criterion?: string;
  /** The statistical-justification variant (R 91-2, 4.4). */
  statistics?: { method: string; on_basis_of: string; permits: string };
}

/**
 * One criterion item of a conformance test's structured acceptance
 * block (the cc.yaml testCriterion shape, kernel-typed — these never
 * ride a raw string). `pass_if` and `accepts.limit` are the item's OCL,
 * first-class; a criterion carries EITHER, never both.
 */
export interface RetrievalAcceptanceCriteriaItem {
  /** The criterion's authored name. */
  name: string;
  /** The requirement id this criterion traces to. */
  target?: string;
  /** The verdict criterion taxonomy (I/MPE | D/NSFa | D/NSFd | n/a). */
  criterion?: string;
  /** The OCL boolean expression the item passes on. */
  pass_if?: string;
  /** The canonical verdict-registry binding (instead of pass_if). */
  accepts?: RetrievalAccepts;
  /** True for an optional criterion (never blocks the verdict). */
  optional?: boolean;
  description?: string;
  /** The item's source-reference URN. */
  reference?: string;
}

/**
 * The structured acceptance block. For a REQUIREMENT it is the authored
 * `acceptance_criteria { … }` block read structured (the raw content is
 * YAML, migrated 1:1 — parsed by the subset reader in yaml-lite.ts onto
 * the rc.yaml acceptanceCriteria shape: `type`, `description`, `limit`
 * `{ expression, operator, threshold_expression, unit }`, `tiers`, …).
 * For a CONFORMANCE TEST it is the kernel-typed criteria assembled onto
 * the cc.yaml shape. A requirement block that walks off the subset
 * (free text, a keyword-form block) stays the RAW STRING — honest prose,
 * never a failed parse dressed as structure.
 */
export type RetrievalAcceptanceCriteria = Record<string, unknown> | string;

/**
 * One run-validity precondition (cc.yaml): evaluated BEFORE the
 * acceptance limit — a violation VOIDS the run (`invalid`), never a
 * fail. First-class (primmel-ts#84): out of the `payload` grab bag,
 * the `check` OCL and the violation outcome as fields.
 */
export interface RetrievalPrecondition {
  id: string;
  /** The OCL run-validity check expression. */
  check: string;
  description?: string;
  /** The verdict outcome when the check is violated (`invalid`). */
  on_violation?: string;
  /** Escalation when the check's inputs are unresolvable. */
  on_unresolvable?: string;
}

/**
 * One typed retrieval unit — the atom a RAG consumer indexes. Fields
 * are omitted when the unit declares nothing for them (the canonical
 * JSON stays tight); `id`, `kind`, `content_hash`, `passport`, and
 * `facet` are always present.
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
  /** The verification method + description (requirements). */
  verification?: { method: string; description: string };
  /** The channel dimension a requirement is verified per value of. */
  channel?: string;
  /** Requirement/test ids this unit depends on. */
  dependencies?: string[];
  /**
   * The structured acceptance decision rule (ask 8 — primmel-ts#84):
   * the shared AcceptanceDecision block as authored, on a requirement
   * (limit.acceptance), a conformance test, or a characteristic. The
   * /1 projection's `acceptance` STRING carried only the rule token
   * (or, for requirements, the accepts triple flattened — now
   * `accepts`); the compact summary still rides the passport.
   */
  acceptance?: RetrievalAcceptanceDecision;
  /**
   * The structured verdict-registry binding `{ verdict, op, limit }`
   * (ask 8) — a requirement's limit.accepts. The limit predicate is an
   * OCL field; the /1 projection flattened the triple into the
   * `acceptance` string a consumer had to split.
   */
  accepts?: RetrievalAccepts;
  /**
   * The structured acceptance criteria (ask 8): the requirement's raw
   * `acceptance_criteria` block read structured (the YAML-subset
   * reader; the raw string itself when the block walks off the
   * subset), the conformance test's kernel-typed criteria assembled.
   * The /1 projection emitted the requirement's block as a raw YAML
   * string inside the JSON — the consumer-side re-parse this field
   * exists to eliminate.
   */
  acceptance_criteria?: RetrievalAcceptanceCriteria;
  /**
   * The constraint's OCL invariant (the construct's own `check`
   * keyword, first-class per ask 8). Also carried as `expression` —
   * the generic machine-expression slot the passport and the
   * consumer's grounding text read.
   */
  check?: string;
  /** The constraint's violation meaning — the construct's own words
   *  for what a violation IS. Also carried as `statement` (the generic
   *  prose slot). */
  violation_meaning?: string;
  /**
   * The declared violation outcome (ask 8, first-class — out of
   * `payload`): the constraint's `invalid | indeterminate`.
   */
  on_violation?: string;
  /**
   * The run-validity preconditions (ask 8, first-class — out of
   * `payload`), each with its OCL `check` and violation outcome.
   */
  preconditions?: RetrievalPrecondition[];
  /**
   * The base prose value's spelling — the package's `default_spelling`
   * (ISO 24229; ask 7). The default spelling's values live inline (the
   * `name`/`statement`/`definition` fields above); this is their tag.
   * Omitted when the package declares no default spelling.
   */
  language?: string;
  /**
   * The ISO 24229 alternate spellings of the unit's prose fields
   * (ask 7), resolved from the package's `text` blocks: keyed by the
   * addressed field path relative to the element (`statement`, or the
   * nested `<path…>.<field>` form of gap-close E13), values in authored
   * order. AUTHORED content — a translation change moves the
   * content_hash like any other content change.
   */
  variants?: Record<string, SpellingEntry[]>;
  /** Kind-specific payload (typed IO, table columns, sequence steps…). */
  payload?: Record<string, unknown>;
  /** The primary provenance edge (the first of `clauses`). */
  clause?: RetrievalClause;
  /** Every provenance edge, in authored order, de-duplicated by URN. */
  clauses?: RetrievalClause[];
  /**
   * sha256 over the unit's canonical JSON content (every field above,
   * content_hash, passport and facet excluded): the currency signal.
   * Identity is the id; the digest says whether the CONTENT moved.
   */
  content_hash: string;
  /** The machine passport (ask 6) — the compact verifiable digest. */
  passport: UnitPassport;
  /**
   * The flat retrieval facet (ask 3) — the pre-flattened scalar metadata
   * map, derived from the unit's authored content plus the package's
   * document block. A DERIVED projection: excluded from the content_hash
   * input (the digest covers authored content; the facet re-derives
   * from it deterministically). Attached by the export, after the
   * digest.
   */
  facet: RetrievalFacet;
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
  /** The facet shape version every unit's `facet` map follows (ask 3). */
  facet_version: typeof RETRIEVAL_FACET_VERSION;
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
  /**
   * Units carrying at least one language-tagged variant field (ask 7).
   */
  withVariants: number;
  /**
   * `text` blocks whose variants reached no unit: the address resolves
   * to an element the projection does not ship as a unit (a form, a
   * subject, an instrument), or resolves to nothing at all (a C89-red
   * package). Counted, never silently dropped.
   */
  droppedTextBlocks: number;
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
    acceptance: acceptanceSummary(unit),
    provenance: (unit.clauses ?? []).map(c => c.urn),
    content_hash: unit.content_hash,
  };
}

// ── the structured acceptance (ask 8, primmel-ts#84) ─────────────────

/** The authored decision block → the structured decision object. */
export function acceptanceDecisionOf(
  a: AcceptanceDecision | null | undefined,
): RetrievalAcceptanceDecision | undefined {
  if (!a) {
    return undefined;
  }
  const out: RetrievalAcceptanceDecision = {
    ...(present(a.rule) ? { rule: a.rule } : {}),
  };
  if (a.guardBand) {
    out.guard_band = { kind: a.guardBand.kind, value: a.guardBand.value };
  }
  if (a.uncertainty) {
    out.uncertainty = { max_ratio_to_mpe: a.uncertainty.maxRatioToMpe };
  }
  if (present(a.criterion)) {
    out.criterion = a.criterion;
  }
  if (a.statistics) {
    out.statistics = {
      method: a.statistics.method,
      on_basis_of: a.statistics.onBasisOf,
      permits: a.statistics.permits,
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** The typed criterion of a conformance test → the wire-shape item. */
function criteriaItemOf(
  c: ConformanceTest['acceptanceCriteria'][number],
): RetrievalAcceptanceCriteriaItem {
  const item: RetrievalAcceptanceCriteriaItem = { name: c.item };
  if (present(c.requirementId)) {
    item.target = c.requirementId;
  }
  if (present(c.criterion)) {
    item.criterion = c.criterion;
  }
  if (present(c.passIf)) {
    item.pass_if = c.passIf;
  }
  if (c.accepts) {
    item.accepts = {
      verdict: c.accepts.verdict,
      op: c.accepts.op,
      limit: c.accepts.limit,
    };
  }
  if (c.optional) {
    item.optional = true;
  }
  if (present(c.description)) {
    item.description = c.description;
  }
  if (present(c.reference)) {
    item.reference = c.reference;
  }
  return item;
}

/**
 * The conformance test's typed criteria → the structured block (the
 * cc.yaml shape): block-level `type` / `description` / `pass_if`, the
 * criteria as `items`. Undefined when the test declares none of it.
 */
function testAcceptanceCriteriaOf(t: ConformanceTest):
  | {
      type?: string;
      description?: string;
      pass_if?: string;
      items?: RetrievalAcceptanceCriteriaItem[];
    }
  | undefined {
  const out: {
    type?: string;
    description?: string;
    pass_if?: string;
    items?: RetrievalAcceptanceCriteriaItem[];
  } = {
    ...(present(t.acceptanceCriteriaType)
      ? { type: t.acceptanceCriteriaType }
      : {}),
    ...(present(t.acceptanceCriteriaDescription)
      ? { description: t.acceptanceCriteriaDescription }
      : {}),
    ...(present(t.acceptancePassIf) ? { pass_if: t.acceptancePassIf } : {}),
    ...(presentList(t.acceptanceCriteria)
      ? { items: t.acceptanceCriteria.map(criteriaItemOf) }
      : {}),
  };
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * The passport's acceptance summary — the compact string form of the
 * structured fields, composed to the same bytes the /1 projection
 * emitted (the passport v1 shape and its strings never move).
 */
function acceptanceSummary(unit: Omit<RetrievalUnit, 'passport'>): string {
  if (unit.accepts) {
    return `${unit.accepts.verdict} ${unit.accepts.op} ${unit.accepts.limit}`;
  }
  const criteria = unit.acceptance_criteria;
  if (criteria && typeof criteria === 'object') {
    const passIf = criteria['pass_if'];
    if (present(passIf as string)) {
      return passIf as string;
    }
    const description = criteria['description'];
    if (present(description as string)) {
      return description as string;
    }
  }
  if (unit.acceptance?.rule) {
    return unit.acceptance.rule;
  }
  return '';
}

// ── the flat retrieval facet (ask 3) ─────────────────────────────────

/**
 * The document-URN parts the facet flattens per unit, parsed with the
 * deployed consumer's grammar (`urn:oiml:pub:<type>:<number>[:<year>]`,
 * type ∈ r/d/b/g/e) extended with the part suffix the publication URNs
 * carry (`60-1`); a non-matching base URN yields empty parts, never an
 * invented value (the register mapping stays consumer-side).
 */
export interface RetrievalDocParts {
  /** The lower-case publication-type letter (`r`, `d`, `b`, `g`, `e`). */
  doctype: string;
  /** The document number, part suffix included (`60`, `60-1`). */
  doc_number: string;
  /** The URN's publication year ('' when the URN carries none). */
  year: string;
  /** The display label (`OIML R 60:2021`; '' when unparseable). */
  label: string;
}

const BASE_URN_PARTS = /^urn:oiml:pub:([rdbge]):(\d[\d-]*)(?::(\d{4}))?$/i;

export function retrievalDocParts(baseUrn: string): RetrievalDocParts {
  const m = BASE_URN_PARTS.exec(baseUrn);
  if (!m) {
    return { doctype: '', doc_number: '', year: '', label: '' };
  }
  const doctype = (m[1] ?? '').toLowerCase();
  const docNumber = m[2] ?? '';
  const year = m[3] ?? '';
  return {
    doctype,
    doc_number: docNumber,
    year,
    label: `OIML ${doctype.toUpperCase()} ${docNumber}${year ? `:${year}` : ''}`,
  };
}

/**
 * Build the unit's flat facet (ask 3): the document fields every vector
 * of this package carries, the unit's kind + currency keys, its primary
 * clause anchor, and its applicability dimensions flattened to
 * `app_<dim>` keys (values sorted, `|`-joined; a non-`any` match mode
 * rides beside as `app_<dim>_match`).
 *
 * Key congruence with the deployed consumer's chunk wire schema
 * (ChunkMetaModel): `doc_id`, `docidentifier`, `doctype`, `doc_number`,
 * `edition`, `language`, `clause_anchor`, `clause_title`, `status`,
 * `unit_id`, `block`, `unit_hash` carry the same names and semantics.
 * The lane constants the schema also carries (`tier`, `corpus`,
 * `producer`, `text_ref`, `superseded_by`) are DEPLOYMENT stamps, not
 * package content — the consumer's adapter sets them per lane; the
 * facet never invents them. Three deliberate value choices:
 *
 *   - `language` is the package's authored default spelling (the
 *     ISO 24229 code, e.g. `eng-Latn`) — the consumer lanes stamp a
 *     constant two-letter code today; the facet carries the authored
 *     truth and the adapter maps.
 *   - `clause_anchor` is the primary edge's document clause number, ''
 *     when the unit names no clause (never a producer UUID — ask 1
 *     already demoted those to `anchor`). The consumer's "model"
 *     fallback for clause-less model units is its lane marker, applied
 *     at its adapter.
 *   - `edition` is the package block's canonical edition (ask 2), not
 *     a re-parse of the base URN — the two coincide on URN-carrying
 *     packages, and the package block is authoritative when they drift.
 */
export function retrievalFacet(
  unit: RetrievalUnit,
  pkg: RetrievalPackage,
): RetrievalFacet {
  const parts = retrievalDocParts(pkg.base_urn);
  const facet: RetrievalFacet = {
    unit_id: unit.id,
    unit_hash: unit.content_hash,
    block: unit.kind,
    doc_id: pkg.id,
    docidentifier: parts.label || pkg.title,
    doctype: parts.doctype,
    doc_number: parts.doc_number,
    edition: pkg.edition,
    model_version: pkg.model_version,
    language: pkg.default_spelling,
    clause_anchor: unit.clause?.clause ?? '',
    clause_title: unit.name ?? unit.id,
    ...(present(pkg.status) ? { status: pkg.status! } : {}),
  };
  const valuesByDim = new Map<string, Set<string>>();
  const matchByDim = new Map<string, string>();
  for (const entry of unit.applicability ?? []) {
    const values =
      entry.values.length > 0 ? entry.values : Object.keys(entry.mapping ?? {});
    const set = valuesByDim.get(entry.dimension) ?? new Set<string>();
    for (const v of values) {
      set.add(v);
    }
    valuesByDim.set(entry.dimension, set);
    if (
      entry.match &&
      entry.match !== 'any' &&
      !matchByDim.has(entry.dimension)
    ) {
      matchByDim.set(entry.dimension, entry.match);
    }
  }
  for (const dim of [...valuesByDim.keys()].sort()) {
    facet[`app_${dim}`] = [...valuesByDim.get(dim)!].sort().join('|');
    const match = matchByDim.get(dim);
    if (match) {
      facet[`app_${dim}_match`] = match;
    }
  }
  return facet;
}

// ── language-tagged variants (ask 7) ─────────────────────────────────

/**
 * Resolve a `text` block's address onto its element: the LONGEST
 * dot-boundary prefix registered in the package (element ids may
 * themselves carry dots — `r144-3/sec-3.4`); the rest is the path into
 * the element's structure, the terminal segment the prose field. The
 * same rule the C89 linter resolves with (check.ts) — the projection
 * and the linter never disagree about which element a text block
 * addresses.
 */
export function resolveTextAddress(
  address: string,
  elementIds: ReadonlySet<string>,
): { elementId: string; path: string } | null {
  const segments = address.split('.');
  if (segments.length < 2 || segments.some(s => s === '')) {
    return null;
  }
  for (let i = segments.length - 1; i >= 1; i--) {
    const candidate = segments.slice(0, i).join('.');
    if (elementIds.has(candidate)) {
      return { elementId: candidate, path: segments.slice(i).join('.') };
    }
  }
  return null;
}

/**
 * The id-keyed collections a text block may address — the mirror of the
 * C89 linter's element registry (check.ts). Resolution runs against the
 * FULL registry (not only the projected kinds): an address whose
 * longest registered prefix is an unprojected element (a form, an
 * instrument) must NOT fall through to a shorter projected prefix —
 * that misattribution is worse than a drop, and the drop is counted.
 */
const TEXT_ADDRESS_COLLECTIONS: (keyof Standard)[] = [
  'requirements',
  'requirementClasses',
  'conformanceTests',
  'conformanceClasses',
  'terms',
  'forms',
  'subforms',
  'symbols',
  'tables',
  'calculations',
  'notes',
  'provisions',
  'processes',
  'instruments',
  'attributeDefinitions',
  'capabilities',
  'behaviors',
  'conditionSets',
  'subjects',
  'referenceMaterials',
  'artifactDefinitions',
  'monitors',
  'passports',
  'invariants',
  'testSequences',
  'formulasUsed',
  'stateMachines',
  'figures',
  'links',
];

/**
 * Attach the language tag and the variants to the built unit contents
 * (pre-digest — both are authored content): `language` is the package's
 * default spelling on every unit; `variants` resolves each `text` block
 * onto its unit (by the KERNEL element id — a term's text block
 * addresses `frobnicator`, not `/term/frobnicator`) and keys the
 * entries by the addressed field path. Returns the count of text blocks
 * whose variants reached no unit (the droppedTextBlocks honesty tally).
 */
function attachVariants(
  built: { content: UnitContent; elementId: string }[],
  standard: Standard,
  pkg: RetrievalPackage,
): number {
  if (present(pkg.default_spelling)) {
    for (const b of built) {
      b.content.language = pkg.default_spelling;
    }
  }
  const texts = standard.texts ?? [];
  if (texts.length === 0) {
    return 0;
  }
  const registry = new Set<string>();
  for (const field of TEXT_ADDRESS_COLLECTIONS) {
    for (const item of (standard[field] as { id?: string }[]) ?? []) {
      if (item?.id) {
        registry.add(item.id);
      }
    }
  }
  const unitByElement = new Map(built.map(b => [b.elementId, b.content]));
  let dropped = 0;
  for (const t of texts) {
    const resolved = resolveTextAddress(t.id, registry);
    const content = resolved
      ? unitByElement.get(resolved.elementId)
      : undefined;
    if (!resolved || !content) {
      dropped++;
      continue;
    }
    const variants = (content.variants ??= {});
    variants[resolved.path] = [
      ...(variants[resolved.path] ?? []),
      ...t.entries,
    ];
  }
  return dropped;
}

// ── unit construction ────────────────────────────────────────────────

/**
 * The fields that participate in a unit's content digest: everything
 * the consumer indexes — the projected content, the normalized
 * provenance, the language tag and variants (authored content) — minus
 * the digest, the passport, and the facet (the derived projections of
 * the authored content, never inputs to it).
 */
type UnitContent = Omit<RetrievalUnit, 'content_hash' | 'passport' | 'facet'>;

/**
 * Attach the provenance edges to a built unit content. The digest,
 * passport and facet arrive later (`completeUnit`) — the language tag
 * and variants (ask 7) attach between assembly and digestion, so they
 * participate in the content_hash like any authored field.
 */
function assemble(
  content: UnitContent,
  clauses: RetrievalClause[],
): UnitContent {
  if (clauses.length > 0) {
    content.clause = clauses[0];
    content.clauses = clauses;
  }
  return content;
}

/**
 * Complete an assembled unit content into the shipped unit: the content
 * digest (over the authored fields — language and variants included),
 * then the derived projections (passport, facet) that read it.
 */
function completeUnit(
  content: UnitContent,
  pkg: RetrievalPackage,
): RetrievalUnit {
  const hash = retrievalDigest(content);
  const unit: RetrievalUnit = {
    ...content,
    content_hash: hash,
  } as RetrievalUnit;
  unit.passport = passportOf(unit);
  // The facet attaches last (a derived projection of the digested
  // content — the unit_hash key reads the computed content_hash).
  unit.facet = retrievalFacet(unit, pkg);
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

function requirementUnit(r: Requirement): UnitContent {
  const decision = acceptanceDecisionOf(r.limit?.acceptance);
  const criteria = present(r.acceptanceCriteria)
    ? (parseYamlBlock(r.acceptanceCriteria) ?? r.acceptanceCriteria)
    : undefined;
  return assemble(
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
            accepts: {
              verdict: r.limit.accepts.verdict,
              op: r.limit.accepts.op,
              limit: r.limit.accepts.limit,
            },
          }
        : {}),
      ...(decision ? { acceptance: decision } : {}),
      ...(criteria !== undefined ? { acceptance_criteria: criteria } : {}),
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

function conformanceTestUnit(t: ConformanceTest): UnitContent {
  const payload: Record<string, unknown> = {
    ...(present(t.kind) ? { test_kind: t.kind } : {}),
    ...(present(t.methodRef) ? { method_ref: t.methodRef } : {}),
  };
  const decision = acceptanceDecisionOf(t.acceptance);
  const criteria = testAcceptanceCriteriaOf(t);
  return assemble(
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
      ...(decision ? { acceptance: decision } : {}),
      ...(criteria ? { acceptance_criteria: criteria } : {}),
      ...(presentList(t.preconditions)
        ? {
            preconditions: t.preconditions.map(p => ({
              id: p.id,
              check: p.check,
              ...(present(p.description) ? { description: p.description } : {}),
              ...(present(p.onViolation)
                ? { on_violation: p.onViolation }
                : {}),
              ...(present(p.onUnresolvable)
                ? { on_unresolvable: p.onUnresolvable }
                : {}),
            })),
          }
        : {}),
      ...(presentList(t.dependencies) ? { dependencies: t.dependencies } : {}),
      ...(Object.keys(payload).length > 0 ? { payload } : {}),
    },
    collectClauses(t),
  );
}

function termUnit(t: Term, baseUrn: string): UnitContent {
  const payload: Record<string, unknown> = {
    ...(present(t.section) ? { section: t.section } : {}),
    ...(present(t.language) ? { language: t.language } : {}),
    ...(t.vocabRef ? { vocab_ref: t.vocabRef } : {}),
    // The alias family (MN 114 v3.2, clause 13.10.1): the parser folds
    // the v2 `alt` spelling into the canonical aliases channel; the
    // payload keeps the deployed `alt` key (contract stability) and adds
    // the v3.2 facets.
    ...(presentList(t.aliases ?? t.alt) ? { alt: (t.aliases ?? t.alt)! } : {}),
    ...(presentList(t.colloquial) ? { colloquial: t.colloquial } : {}),
    ...(t.aliasSpellings && Object.keys(t.aliasSpellings).length > 0
      ? { alias_spellings: t.aliasSpellings }
      : {}),
    ...(presentList(t.abbreviations) ? { abbreviations: t.abbreviations } : {}),
    ...(presentList(t.seeAlso) ? { see_also: t.seeAlso } : {}),
  };
  return assemble(
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

function attributeUnit(a: AttributeDefinition): UnitContent {
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
  return assemble(
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

function behaviorUnit(b: Behavior): UnitContent {
  const payload: Record<string, unknown> = {
    ...(present(b.kind) ? { behavior_kind: b.kind } : {}),
    ...(present(b.stimulus) ? { stimulus: b.stimulus } : {}),
  };
  return assemble(
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

function calculationUnit(c: Calculation): UnitContent {
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
  return assemble(
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

function symbolUnit(s: Symbol): UnitContent {
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
  return assemble(
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

function constraintUnit(c: Constraint): UnitContent {
  return assemble(
    {
      id: `/constraint/${c.id}`,
      kind: 'constraint',
      ...(present(c.name) ? { name: c.name } : {}),
      ...(present(c.violationMeaning) ? { statement: c.violationMeaning } : {}),
      ...(present(c.check) ? { expression: c.check } : {}),
      // The violation semantics first-class (ask 8) — the construct's
      // own keyword vocabulary, out of the payload grab bag. `statement`
      // and `expression` stay: the generic prose/expression slots the
      // passport and the consumer's grounding text read.
      ...(present(c.check) ? { check: c.check } : {}),
      ...(present(c.violationMeaning)
        ? { violation_meaning: c.violationMeaning }
        : {}),
      ...(present(c.onViolation) ? { on_violation: c.onViolation } : {}),
      payload: {
        ...(present(c.stereotype) ? { stereotype: c.stereotype } : {}),
      },
    },
    collectClauses(c),
  );
}

function characteristicUnit(v: Verdict): UnitContent {
  // The deployed plane's `characteristic` kind: the canonical verdict
  // quantity (derive once, reference everywhere).
  const units = present(v.unit) && v.unit !== '1' ? [v.unit] : undefined;
  const payload: Record<string, unknown> = {
    ...(present(v.behavior) ? { behavior: v.behavior } : {}),
    ...(present(v.quantityKind) ? { quantity_kind: v.quantityKind } : {}),
    ...(v.seriesReduction ? { series_reduction: v.seriesReduction } : {}),
  };
  return assemble(
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
      ...(acceptanceDecisionOf(v.acceptance)
        ? { acceptance: acceptanceDecisionOf(v.acceptance) }
        : {}),
      ...(Object.keys(payload).length > 0 ? { payload } : {}),
    },
    collectClauses(v),
  );
}

function tableUnit(t: Table): UnitContent {
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
  return assemble(
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

function sequenceUnit(s: TestSequence): UnitContent {
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
  return assemble(
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

function noteUnit(n: Note): UnitContent {
  return assemble(
    {
      id: `/note/${n.id}`,
      kind: 'note',
      name: n.type,
      ...(present(n.message) ? { statement: n.message } : {}),
    },
    [],
  );
}

function stateMachineUnit(m: StateMachine): UnitContent {
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
  return assemble(
    {
      id: `/state-machine/${id}`,
      kind: 'state_machine',
      name: id,
      ...(Object.keys(payload).length > 0 ? { payload } : {}),
    },
    [],
  );
}

function dimensionUnit(d: ClassificationDimension): UnitContent {
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
  return assemble(
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
  // Build the unit contents paired with the KERNEL element id — the
  // address a `text` block targets (a term's variants address
  // `frobnicator`, not the namespaced unit id `/term/frobnicator`).
  const built: { content: UnitContent; elementId: string }[] = [];
  const push = (content: UnitContent, elementId: string): void => {
    built.push({ content, elementId });
  };
  for (const r of standard.requirements ?? []) {
    push(requirementUnit(r), r.id);
  }
  for (const t of standard.conformanceTests ?? []) {
    push(conformanceTestUnit(t), t.id);
  }
  for (const t of standard.terms ?? []) {
    push(termUnit(t, pkg.base_urn), t.id);
  }
  for (const a of standard.attributeDefinitions ?? []) {
    push(attributeUnit(a), a.id);
  }
  for (const b of standard.behaviors ?? []) {
    push(behaviorUnit(b), b.id);
  }
  for (const c of standard.calculations ?? []) {
    // The kernel element id is the construct id (`calculation frobIndex`),
    // never the declared `identifier` path the unit id prefers.
    push(calculationUnit(c), c.id);
  }
  for (const s of standard.symbols ?? []) {
    push(symbolUnit(s), s.id);
  }
  for (const c of standard.constraints ?? []) {
    push(constraintUnit(c), c.id);
  }
  for (const v of standard.verdicts ?? []) {
    push(characteristicUnit(v), v.id);
  }
  for (const t of standard.tables ?? []) {
    push(tableUnit(t), t.id);
  }
  for (const s of standard.testSequences ?? []) {
    push(sequenceUnit(s), s.id);
  }
  for (const n of standard.notes ?? []) {
    push(noteUnit(n), n.id);
  }
  for (const m of standard.stateMachines ?? []) {
    // The construct declares no id (the unit keys by the bound entity's
    // name) — C89 registers nothing, so no text block can address it.
    push(stateMachineUnit(m), m.entityName);
  }
  for (const i of standard.instruments ?? []) {
    for (const d of i.dimensions ?? []) {
      // Dimensions nest under the instrument in the C89 registry — a
      // text block addresses them by path through the instrument, which
      // the projection does not ship as a unit: those blocks count as
      // dropped, never misattached.
      push(dimensionUnit(d), d.id);
    }
  }

  // The language tag + variants attach pre-digest (authored content —
  // they move the content_hash like any authored field).
  const droppedTextBlocks = attachVariants(built, standard, pkg);
  const units = built.map(b => completeUnit(b.content, pkg));

  const byKind: Partial<Record<RetrievalUnitKind, number>> = {};
  let withClause = 0;
  let anchorOnlyProvenance = 0;
  let nonUrnDocRefs = 0;
  let withoutProvenance = 0;
  let withVariants = 0;
  for (const u of units) {
    byKind[u.kind] = (byKind[u.kind] ?? 0) + 1;
    if (u.variants && Object.keys(u.variants).length > 0) {
      withVariants++;
    }
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
    facet_version: RETRIEVAL_FACET_VERSION,
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
      withVariants,
      droppedTextBlocks,
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
