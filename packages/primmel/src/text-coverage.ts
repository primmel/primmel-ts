// ─────────────────────────────────────────────────────────────────────
// TODO.roadmap/26 — the normative-text coverage metric (concept doc
// §11.6, layer 5 of the validation stack):
//
//   every normative sentence of the source maps to at least one model
//   element (target 100 %), and no two elements are semantic duplicates
//   (target 0).
//
// The inputs ship INSIDE the package (JSON — primmel-ts stays YAML-free),
// generated from the YAML single source of truth by the OIML SMART build
// (browser/scripts/build-prl-package.ts):
//
//   sources-prd/<part>.sentences.json — the sentence decomposition of one
//     source document: every prose sentence with its address
//     (<fragment-path>/s<N>), fragment, kind, fragment-level normativity,
//     the modality classifier's verdict (only NORMATIVE sentences gate —
//     shall/should/may/must + negatives, context rules first), and text.
//     Table/figure fragments carry no sentences (tables are data, never
//     text — their coverage is the clause-level congruence gate's).
//   sources-prd/coverage.json — the per-package declarations:
//     allowances (deliberate exclusions, sentence-PINNED so a new
//     normative sentence in an allowed fragment is still a finding — the
//     pair-pinned discipline of the congruence gate's order exceptions)
//     and duplicate_adjudications (the human verdicts on flagged
//     near-duplicate pairs; the metric REPORTS pairs, never auto-fails —
//     acceptance is 0 UNRESOLVED pairs).
//
// The rules (check-rules.ts):
//   C71 text-coverage-sentence-uncovered (AUDIT, warning) — a normative
//       sentence bound by no model element and excluded by no allowance;
//       budgeted by the package's text_coverage_budget (the C51/C52
//       pattern — regressions fail the gate);
//   C72 text-coverage-budget (AUDIT) — the budget caps C71 warnings
//       (exceeded: error; slack: warning — the allowance only shrinks);
//   C73 text-coverage-config — malformed/stale declarations: an
//       allowance matching no normative sentence (drifted address, a pin
//       on a sentence that stopped existing or being normative), a
//       mis-sorted or silent adjudication, a STALE adjudication whose
//       pair is no longer flagged. Runs whenever a manifest ships.
//
// Duplicate detection (the methodology's "0 semantic-equivalent elements"
// rule, machine-assisted): over the elements carrying bound text
// (requirement statements, term definitions) that bind ≥1 fragment of a
// manifest document, flag pairs whose normalized token-multiset
// containment similarity reaches DUPLICATE_SIMILARITY_THRESHOLD — two
// requirements interpreting the same sentence differently is worse than
// a gap, because both will compute verdicts (§11.6).
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type Standard from './types/Standard';
import type { CheckIssue } from './check';

// ── shipped JSON shapes ──────────────────────────────────────────────

export interface SentenceRecord {
  /** `<fragment-path>/s<N>` — the coverage address. */
  address: string;
  fragment: string;
  clause?: string;
  kind: string;
  fragment_normative: boolean;
  /** The classifier's verdict — only normative sentences gate. */
  modality: 'normative' | 'informative';
  text: string;
}

export interface SentencesManifest {
  prd_sentences: string;
  document: { urn: string; short?: string; part?: string };
  sentences: SentenceRecord[];
}

export interface CoverageAllowance {
  address: string;
  sentences?: string[];
  reason?: string;
  since?: string;
  task?: string;
}

export interface DuplicateAdjudication {
  elements: [string, string];
  verdict: string;
  reason?: string;
  since?: string;
  task?: string;
}

export interface CoverageConfigJson {
  prd_coverage: string;
  allowances?: CoverageAllowance[];
  duplicate_adjudications?: DuplicateAdjudication[];
}

const SENTENCES_FORMAT = '0.1.0';
const COVERAGE_FORMAT = '0.1.0';

/** Load the text-coverage payloads of a package (<dir>/sources-prd/).
 * Absent directory → empty (the metric is silent). Malformed payloads are
 * C73 errors. */
export function loadTextCoverageData(dir: string): {
  manifests: SentencesManifest[];
  config: CoverageConfigJson | null;
  issues: CheckIssue[];
} {
  const issues: CheckIssue[] = [];
  const manifests: SentencesManifest[] = [];
  let config: CoverageConfigJson | null = null;
  const prdDir = join(dir, 'sources-prd');
  if (!existsSync(prdDir)) {
    return { manifests, config, issues };
  }
  for (const f of readdirSync(prdDir).sort()) {
    if (!f.endsWith('.sentences.json')) {
      continue;
    }
    const rel = `sources-prd/${f}`;
    let raw: SentencesManifest;
    try {
      raw = JSON.parse(readFileSync(join(prdDir, f), 'utf8'));
    } catch (e) {
      issues.push({
        check: 'C73',
        severity: 'error',
        message: `${rel}: not parseable JSON — ${(e as Error).message} (text-coverage-config)`,
      });
      continue;
    }
    if (
      raw.prd_sentences !== SENTENCES_FORMAT ||
      typeof raw.document?.urn !== 'string' ||
      !Array.isArray(raw.sentences) ||
      raw.sentences.some(
        s =>
          typeof s?.address !== 'string' ||
          typeof s?.fragment !== 'string' ||
          (s?.modality !== 'normative' && s?.modality !== 'informative') ||
          typeof s?.text !== 'string',
      )
    ) {
      issues.push({
        check: 'C73',
        severity: 'error',
        message: `${rel}: not a prd_sentences ${SENTENCES_FORMAT} manifest (document.urn + sentences[{address, fragment, modality, text}]) — regenerate the package (text-coverage-config)`,
      });
      continue;
    }
    manifests.push(raw);
  }
  const configPath = join(prdDir, 'coverage.json');
  if (existsSync(configPath)) {
    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf8'));
      if (raw.prd_coverage !== COVERAGE_FORMAT) {
        throw new Error(`prd_coverage must be "${COVERAGE_FORMAT}"`);
      }
      config = raw as CoverageConfigJson;
    } catch (e) {
      issues.push({
        check: 'C73',
        severity: 'error',
        message: `sources-prd/coverage.json: ${(e as Error).message} — regenerate the package (text-coverage-config)`,
      });
    }
  }
  return { manifests, config, issues };
}

// ── provenance collection (the PRL binding surface) ──────────────────

/** One provenance binding harvested from the composed package. */
export interface ProvenanceBinding {
  /** Nearest id-bearing ancestor (requirement id, term id, …). */
  element: string;
  /** The Standard collection the element was found under. */
  kind: string;
  doc: string;
  /** Fragment path (clause-5.2.1) or sentence address (clause-2.2/s1). */
  fragmentPath: string;
  /** Bound text for duplicate detection (statement | definition). */
  text?: string;
}

const URN_ADDRESS = /^(urn:oiml:pub:[a-z0-9:-]+)#([A-Za-z0-9./-]+)$/;
const FRAGMENT_WORD = /^(clause|table|figure|front)-/;

/** Normalize one binding to {doc, fragmentPath}: a doc may carry the
 * glued `#fragment` form (doc "urn:…#table-4"), a bare clause number gets
 * the clause- prefix, an existing address word passes through, and the
 * optional sentence sub-address appends `/s<N>` (TODO.roadmap/26). */
export function normalizeBinding(
  doc: string,
  clause: string,
  fragment?: string,
): { doc: string; fragmentPath: string } | null {
  let d = doc.trim();
  let path = '';
  const hash = d.indexOf('#');
  if (hash >= 0) {
    path = d.slice(hash + 1);
    d = d.slice(0, hash);
  }
  if (path === '') {
    const c = clause.trim();
    if (c === '') {
      return null;
    }
    path = FRAGMENT_WORD.test(c) ? c : `clause-${c}`;
  }
  if (fragment && fragment.trim() !== '') {
    path += `/${fragment.trim()}`;
  }
  return { doc: d, fragmentPath: path };
}

function* urnStringBindings(
  value: string,
): Generator<{ doc: string; fragmentPath: string }> {
  for (const token of value.trim().split(/\s+/)) {
    const m = URN_ADDRESS.exec(token);
    if (m) {
      yield { doc: m[1], fragmentPath: m[2] };
    }
  }
}

interface SourceRefLike {
  doc?: unknown;
  clause?: unknown;
  fragment?: unknown;
}

function isSourceRefLike(v: unknown): v is SourceRefLike {
  return (
    typeof v === 'object' &&
    v !== null &&
    (typeof (v as SourceRefLike).doc === 'string' ||
      typeof (v as SourceRefLike).clause === 'string')
  );
}

/** Harvest every provenance binding of the composed package: sourceRefs/
 * sourceRef blocks, `source { doc clause fragment? }` blocks, term-style
 * `source "urn …"` strings, `reference "urn#fragment"` strings and
 * references[].urn lists — on ANY id-bearing element (the generic walk is
 * construct-agnostic; non-URN strings never match the address grammar). */
export function collectProvenanceBindings(
  standard: Standard,
): ProvenanceBinding[] {
  const out: ProvenanceBinding[] = [];
  const seen = new Set<string>();
  const push = (
    element: string,
    kind: string,
    text: string | undefined,
    norm: { doc: string; fragmentPath: string } | null,
  ) => {
    if (!norm || norm.fragmentPath === '') {
      return;
    }
    const key = `${element}${norm.doc}#${norm.fragmentPath}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push({
      element,
      kind,
      doc: norm.doc,
      fragmentPath: norm.fragmentPath,
      ...(text !== undefined ? { text } : {}),
    });
  };
  const harvestFields = (
    node: Record<string, unknown>,
    element: string,
    kind: string,
    text: string | undefined,
  ) => {
    const fromRef = (s: SourceRefLike) =>
      normalizeBinding(
        typeof s.doc === 'string' ? s.doc : '',
        typeof s.clause === 'string' ? s.clause : '',
        typeof s.fragment === 'string' ? s.fragment : undefined,
      );
    if (Array.isArray(node.sourceRefs)) {
      for (const s of node.sourceRefs) {
        if (isSourceRefLike(s)) {
          push(element, kind, text, fromRef(s));
        }
      }
    }
    // condition sets collect repeated source blocks into `sources` (plural)
    if (Array.isArray(node.sources)) {
      for (const s of node.sources) {
        if (isSourceRefLike(s)) {
          push(element, kind, text, fromRef(s));
        }
      }
    }
    if (isSourceRefLike(node.sourceRef)) {
      push(element, kind, text, fromRef(node.sourceRef));
    }
    if (isSourceRefLike(node.source)) {
      push(element, kind, text, fromRef(node.source));
    } else if (typeof node.source === 'string') {
      for (const u of urnStringBindings(node.source)) {
        push(element, kind, text, u);
      }
    }
    if (typeof node.reference === 'string') {
      for (const u of urnStringBindings(node.reference)) {
        push(element, kind, text, u);
      }
    }
    if (Array.isArray(node.references)) {
      for (const r of node.references) {
        const urn = (r as { urn?: unknown })?.urn;
        if (typeof urn === 'string') {
          for (const u of urnStringBindings(urn)) {
            push(element, kind, text, u);
          }
        }
      }
    }
    // Form reference blocks (RoleReference { urn, role } — form-level
    // formReferences, field-level fieldReferences)
    for (const key of ['formReferences', 'fieldReferences'] as const) {
      if (Array.isArray(node[key])) {
        for (const r of node[key]) {
          const urn = (r as { urn?: unknown })?.urn;
          if (typeof urn === 'string') {
            for (const u of urnStringBindings(urn)) {
              push(element, kind, text, u);
            }
          }
        }
      }
    }
  };
  const walk = (
    node: unknown,
    kind: string,
    element: string | null,
    text: string | undefined,
    depth: number,
  ) => {
    if (depth > 12 || typeof node !== 'object' || node === null) {
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, kind, element, text, depth + 1);
      }
      return;
    }
    const rec = node as Record<string, unknown>;
    let el = element;
    let tx = text;
    if (typeof rec.id === 'string' && rec.id !== '') {
      el = rec.id;
      tx =
        typeof rec.statement === 'string'
          ? rec.statement
          : typeof rec.definition === 'string'
            ? rec.definition
            : undefined;
    }
    if (el !== null) {
      harvestFields(rec, el, kind, tx);
    }
    for (const v of Object.values(rec)) {
      if (typeof v === 'object' && v !== null) {
        walk(v, kind, el, tx, depth + 1);
      }
    }
  };
  for (const [field, value] of Object.entries(standard)) {
    if (Array.isArray(value)) {
      walk(value, field, null, undefined, 0);
    }
  }
  return out;
}

// ── allowance matching (lockstep with the smart repo's prd-coverage.ts) ──

/** True when sentence address A is covered by allowance address P: exact,
 * or P a boundary prefix of A ('.' descends the clause tree, '/' a
 * sub-address). */
export function allowanceAddressMatches(
  allowance: string,
  sentence: string,
): boolean {
  if (sentence === allowance) {
    return true;
  }
  if (!sentence.startsWith(allowance)) {
    return false;
  }
  const next = sentence.charAt(allowance.length);
  return next === '.' || next === '/';
}

/** The sentences of one document an allowance discharges (pins first —
 * exactly the pinned sentences of the addressed fragment; otherwise every
 * sentence the address boundary-matches). */
export function allowanceMatches(
  allowance: CoverageAllowance,
  sentences: SentenceRecord[],
  urn: string,
): SentenceRecord[] {
  const hash = allowance.address.indexOf('#');
  const fragment = allowance.address.slice(hash + 1);
  if (allowance.sentences) {
    const pins = new Set(
      allowance.sentences.map(p => `${urn}#${fragment}/${p}`),
    );
    return sentences.filter(s => pins.has(`${urn}#${s.address}`));
  }
  return sentences.filter(s =>
    allowanceAddressMatches(allowance.address, `${urn}#${s.address}`),
  );
}

// ── duplicate detection ──────────────────────────────────────────────

/** The pinned similarity threshold (token-multiset containment:
 * Σ min(cA, cB) / min(|A|, |B|) over normalized tokens). 0.8 flags
 * near-duplicates while per-class specializations differing only in
 * their class values still surface for adjudication; pairs sharing
 * fewer than DUPLICATE_MIN_TOKENS tokens on either side never flag
 * (short texts produce noise, not signal). */
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.8;
export const DUPLICATE_MIN_TOKENS = 6;

/** Normalize bound text for similarity: lowercase, punctuation folded to
 * space, whitespace collapsed (the wording axis, not the symbols'). */
export function normalizeForSimilarity(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(t => t !== '');
}

/** Multiset containment similarity of two token lists (1 = one side's
 * wording is fully contained in the other's). */
export function containmentSimilarity(a: string[], b: string[]): number {
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) {
      m.set(x, (m.get(x) ?? 0) + 1);
    }
    return m;
  };
  const ca = count(a);
  const cb = count(b);
  let inter = 0;
  for (const [t, n] of ca) {
    inter += Math.min(n, cb.get(t) ?? 0);
  }
  const denom = Math.min(a.length, b.length);
  return denom === 0 ? 0 : inter / denom;
}

export interface FlaggedPair {
  a: string;
  b: string;
  similarity: number;
  /** The adjudication record when the pair carries one (sorted ids). */
  adjudication?: DuplicateAdjudication;
}

/** The element kinds whose text counts as BOUND text for duplicate
 * detection (the methodology's "elements" are the model's provisions):
 * requirement statements, term definitions, and instrument/variant
 * definitions. Attribute/symbol/characteristic definitions are parameter
 * semantics — formulaic by design ("maximum load that can be applied"),
 * not source provisions; the congruence gate watches their provenance. */
export const DUPLICATE_TEXT_KINDS = new Set([
  'requirements',
  'terms',
  'instruments',
]);

/** Flag near-duplicate pairs over the bound-text elements (see the module
 * header). Deterministic: pairs sorted by (a, b). */
export function flagDuplicatePairs(
  bindings: ProvenanceBinding[],
  manifestUrns: Set<string>,
  adjudications: DuplicateAdjudication[],
): FlaggedPair[] {
  const textByElement = new Map<string, string>();
  for (const b of bindings) {
    if (b.text === undefined || !manifestUrns.has(b.doc)) {
      continue;
    }
    if (!DUPLICATE_TEXT_KINDS.has(b.kind)) {
      continue;
    }
    if (!textByElement.has(b.element)) {
      textByElement.set(b.element, b.text);
    }
  }
  const elements = [...textByElement.keys()].sort();
  const tokens = new Map(
    elements.map(e => [e, normalizeForSimilarity(textByElement.get(e)!)]),
  );
  const adjudicationByPair = new Map(
    adjudications.map(d => [[...d.elements].sort().join(''), d]),
  );
  const pairs: FlaggedPair[] = [];
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const ta = tokens.get(elements[i])!;
      const tb = tokens.get(elements[j])!;
      if (Math.min(ta.length, tb.length) < DUPLICATE_MIN_TOKENS) {
        continue;
      }
      const sim = containmentSimilarity(ta, tb);
      if (sim >= DUPLICATE_SIMILARITY_THRESHOLD) {
        const key = [elements[i], elements[j]].join('');
        const adj = adjudicationByPair.get(key);
        pairs.push({
          a: elements[i],
          b: elements[j],
          similarity: Math.round(sim * 1000) / 1000,
          ...(adj ? { adjudication: adj } : {}),
        });
      }
    }
  }
  return pairs;
}

// ── the metric ───────────────────────────────────────────────────────

export interface DocumentCoverage {
  urn: string;
  short?: string;
  part?: string;
  /** Prose sentences of the document. */
  total: number;
  /** Normative-classified sentences (the gate's universe). */
  normative: number;
  /** Normative sentences bound by ≥1 model element. */
  covered: number;
  /** Normative, unbound, discharged by an allowance (reported, not gated). */
  allowed: number;
  /** Normative, unbound, NOT allowed — each is a C71 warning at --audit. */
  uncoveredCounted: SentenceRecord[];
  /** Normative, unbound, allowed — with the discharging allowance. */
  uncoveredAllowed: Array<{
    sentence: SentenceRecord;
    allowance: CoverageAllowance;
  }>;
  /** Informative, unbound (reported, never gated). */
  informativeUncovered: number;
  /** covered / normative (the without-allowances ratio). */
  ratio: number;
  /** covered / (normative − allowed) — the gated ratio (target 1.0). */
  ratioGated: number;
}

export interface TextCoverageReport {
  documents: DocumentCoverage[];
  flaggedPairs: FlaggedPair[];
  /** Flagged pairs with no adjudication (the acceptance counts these). */
  unresolvedPairs: FlaggedPair[];
  /** C73 config findings (stale allowances/adjudications). */
  configIssues: CheckIssue[];
}

const SENTENCE_ADDRESS = /\/s[1-9][0-9]*$/;

/** Compute the text-coverage metric over the composed package. */
export function computeTextCoverage(
  standard: Standard,
  manifests: SentencesManifest[],
  config: CoverageConfigJson | null,
): TextCoverageReport {
  const configIssues: CheckIssue[] = [];
  const bindings = collectProvenanceBindings(standard);
  const manifestUrns = new Set(manifests.map(m => m.document.urn));
  const allowances = config?.allowances ?? [];
  const adjudications = config?.duplicate_adjudications ?? [];

  const boundFragments = new Set<string>();
  const boundSentences = new Set<string>();
  for (const b of bindings) {
    if (!manifestUrns.has(b.doc)) {
      continue;
    }
    const key = `${b.doc}#${b.fragmentPath}`;
    if (SENTENCE_ADDRESS.test(b.fragmentPath)) {
      boundSentences.add(key);
    } else {
      boundFragments.add(key);
    }
  }

  const documents: DocumentCoverage[] = [];
  const matchedAllowanceSentences = new Map<
    CoverageAllowance,
    SentenceRecord[]
  >();

  for (const manifest of manifests) {
    const urn = manifest.document.urn;
    const sentences = manifest.sentences;
    const sentenceCovered = (s: SentenceRecord): boolean =>
      boundFragments.has(`${urn}#${s.fragment}`) ||
      boundSentences.has(`${urn}#${s.address}`);

    // First pass: allowance matches (per document).
    const allowanceOf = new Map<string, CoverageAllowance>();
    for (const a of allowances) {
      const hash = a.address.indexOf('#');
      if (a.address.slice(0, hash) !== urn) {
        continue;
      }
      const matched = allowanceMatches(a, sentences, urn);
      const arr = matchedAllowanceSentences.get(a) ?? [];
      arr.push(...matched);
      matchedAllowanceSentences.set(a, arr);
      for (const s of matched) {
        if (s.modality === 'normative' && !sentenceCovered(s)) {
          allowanceOf.set(s.address, a);
        }
      }
    }

    const uncoveredCounted: SentenceRecord[] = [];
    const uncoveredAllowed: Array<{
      sentence: SentenceRecord;
      allowance: CoverageAllowance;
    }> = [];
    let normative = 0;
    let covered = 0;
    let informativeUncovered = 0;
    for (const s of sentences) {
      if (s.modality !== 'normative') {
        if (!sentenceCovered(s)) {
          informativeUncovered++;
        }
        continue;
      }
      normative++;
      if (sentenceCovered(s)) {
        covered++;
        continue;
      }
      const allowance = allowanceOf.get(s.address);
      if (allowance) {
        uncoveredAllowed.push({ sentence: s, allowance });
      } else {
        uncoveredCounted.push(s);
      }
    }
    const allowed = uncoveredAllowed.length;
    documents.push({
      urn,
      ...(manifest.document.short !== undefined
        ? { short: manifest.document.short }
        : {}),
      ...(manifest.document.part !== undefined
        ? { part: manifest.document.part }
        : {}),
      total: sentences.length,
      normative,
      covered,
      allowed,
      uncoveredCounted,
      uncoveredAllowed,
      informativeUncovered,
      ratio: normative === 0 ? 1 : covered / normative,
      ratioGated:
        normative - allowed === 0 ? 1 : covered / (normative - allowed),
    });
  }

  // C73 — declaration hygiene (the KNOWN/STALE spirit): an allowance
  // matching no sentence, or no NORMATIVE sentence, or pinning an
  // informative-classified sentence is stale; silent declarations fail.
  // So is a DEAD allowance — one whose matched normative sentences have
  // all since been bound by model elements: it discharges nothing, so the
  // declaration outlived the condition that justified it.
  for (const a of allowances) {
    const label = `coverage allowance '${a.address}'${a.sentences ? ` pins {${a.sentences.join(' ')}}` : ''}`;
    const urn = a.address.slice(0, a.address.indexOf('#'));
    if (!manifestUrns.has(urn)) {
      configIssues.push({
        check: 'C73',
        severity: 'error',
        message: `${label}: not a document of the shipped manifests (stale or mistyped address) (text-coverage-config)`,
      });
      continue;
    }
    const matched = matchedAllowanceSentences.get(a) ?? [];
    const normative = matched.filter(s => s.modality === 'normative');
    if (matched.length === 0) {
      configIssues.push({
        check: 'C73',
        severity: 'error',
        message: `${label}: matches no sentence of the decomposition (stale — remove the entry or fix the address/pins) (text-coverage-config)`,
      });
    } else if (normative.length === 0) {
      configIssues.push({
        check: 'C73',
        severity: 'error',
        message: `${label}: every matched sentence is informative — informative sentences need no allowance (stale — remove the entry) (text-coverage-config)`,
      });
    } else if (a.sentences) {
      const informativePins = matched
        .filter(s => s.modality !== 'normative')
        .map(s => s.address);
      if (informativePins.length > 0) {
        configIssues.push({
          check: 'C73',
          severity: 'error',
          message: `${label}: pinned sentence(s) ${informativePins.join(', ')} are informative-classified — the pin is stale (text-coverage-config)`,
        });
      }
    }
    if (normative.length > 0) {
      const bound = (s: SentenceRecord): boolean =>
        boundFragments.has(`${urn}#${s.fragment}`) ||
        boundSentences.has(`${urn}#${s.address}`);
      if (normative.every(bound)) {
        configIssues.push({
          check: 'C73',
          severity: 'error',
          message: `${label}: every matched normative sentence is now bound by a model element — the allowance discharges nothing (stale — remove the entry; the bindings carry the coverage) (text-coverage-config)`,
        });
      }
    }
    if (!a.reason) {
      configIssues.push({
        check: 'C73',
        severity: 'error',
        message: `${label}: missing reason (allowances are deliberate, never silent) (text-coverage-config)`,
      });
    }
  }

  const flaggedPairs = flagDuplicatePairs(
    bindings,
    manifestUrns,
    adjudications,
  );
  const unresolvedPairs = flaggedPairs.filter(p => !p.adjudication);

  // C73 — adjudication hygiene: sorted distinct ids, a reason, and the
  // pair still flagged (a pair that dropped below the threshold makes
  // its adjudication STALE — the declaration must die with the condition
  // that justified it).
  const flaggedKeys = new Set(
    flaggedPairs.map(p => [p.a, p.b].sort().join('')),
  );
  for (const d of adjudications) {
    const label = `duplicate adjudication {${(d.elements ?? []).join(', ')}}`;
    if (!Array.isArray(d.elements) || d.elements.length !== 2) {
      configIssues.push({
        check: 'C73',
        severity: 'error',
        message: `${label}: exactly two element ids make a pair (text-coverage-config)`,
      });
      continue;
    }
    if (d.elements[0] === d.elements[1]) {
      configIssues.push({
        check: 'C73',
        severity: 'error',
        message: `${label}: the pair names the same element twice (text-coverage-config)`,
      });
    }
    if (d.elements[0] > d.elements[1]) {
      configIssues.push({
        check: 'C73',
        severity: 'error',
        message: `${label}: element ids must be sorted (the pair key is order-free) (text-coverage-config)`,
      });
    }
    if (!d.reason) {
      configIssues.push({
        check: 'C73',
        severity: 'error',
        message: `${label}: missing reason (adjudications are deliberate, never silent) (text-coverage-config)`,
      });
    }
    if (!flaggedKeys.has([...d.elements].sort().join(''))) {
      configIssues.push({
        check: 'C73',
        severity: 'error',
        message: `${label}: the pair is not currently flagged (similarity below ${DUPLICATE_SIMILARITY_THRESHOLD} or an element unbound/renamed) — the adjudication is STALE (text-coverage-config)`,
      });
    }
  }

  return { documents, flaggedPairs, unresolvedPairs, configIssues };
}

/** The C71 finding text of one uncovered counted sentence. */
export function uncoveredSentenceMessage(
  urn: string,
  s: SentenceRecord,
): string {
  const text = s.text.length > 100 ? `${s.text.slice(0, 97)}…` : s.text;
  return `sentence ${urn}#${s.address} (normative, ${s.kind}): bound by no model element and excluded by no allowance — "${text}" (text-coverage-sentence-uncovered)`;
}

/** Load the package at `dir` and compute its text-coverage report (the
 * `primmel check --coverage` path — null when the package ships no
 * sentence manifests). Package-load failures propagate as the loader's
 * diagnostics (checkPackage reports them as issues in the same run). */
export function packageTextCoverageReport(
  dir: string,
  loadPackage: (dir: string) => { standard: Standard },
): TextCoverageReport | null {
  const { manifests, config, issues } = loadTextCoverageData(dir);
  if (manifests.length === 0) {
    return null;
  }
  const { standard } = loadPackage(dir);
  const report = computeTextCoverage(standard, manifests, config);
  report.configIssues.unshift(...issues);
  return report;
}

/** The human-readable --coverage report (per-document tables with and
 * without allowances, the uncovered lists, and the duplicate-pair
 * adjudication status). */
export function formatTextCoverageReport(report: TextCoverageReport): string {
  const lines: string[] = [];
  lines.push(
    '── normative-text coverage (TODO.roadmap/26, concept doc §11.6) ──',
  );
  lines.push('');
  lines.push(
    `  ${'document'.padEnd(26)} ${'sentences'.padStart(9)} ${'normative'.padStart(9)} ${'covered'.padStart(8)} ${'allowed'.padStart(8)} ${'uncovered'.padStart(9)} ${'coverage'.padStart(10)} gated`,
  );
  for (const d of report.documents) {
    const label = (d.short ?? d.urn).padEnd(26);
    const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
    lines.push(
      `  ${label} ${String(d.total).padStart(9)} ${String(d.normative).padStart(9)} ${String(d.covered).padStart(8)} ${String(d.allowed).padStart(8)} ${String(d.uncoveredCounted.length).padStart(9)} ${pct(d.ratio).padStart(10)} ${pct(d.ratioGated)}`,
    );
  }
  lines.push('');
  lines.push(
    '  coverage = covered / normative (without allowances); gated = covered / (normative − allowed) — the 100 % target.',
  );
  for (const d of report.documents) {
    if (d.uncoveredCounted.length > 0) {
      lines.push('');
      lines.push(
        `  UNCOVERED normative sentences (${d.short ?? d.urn}) — each is a C71 finding:`,
      );
      for (const s of d.uncoveredCounted) {
        lines.push(`    ✗ ${d.urn}#${s.address}  "${truncate(s.text, 90)}"`);
      }
    }
    if (d.uncoveredAllowed.length > 0) {
      lines.push('');
      lines.push(
        `  Allowed exclusions (${d.short ?? d.urn}) — reported, not gated:`,
      );
      for (const { sentence, allowance } of d.uncoveredAllowed) {
        lines.push(
          `    ◦ ${d.urn}#${sentence.address}  "${truncate(sentence.text, 70)}"`,
        );
        lines.push(`      allowance: ${allowance.reason ?? '(no reason)'}`);
      }
    }
    lines.push('');
    lines.push(
      `  informative uncovered (${d.short ?? d.urn}): ${d.informativeUncovered} (reported, never gated)`,
    );
  }
  lines.push('');
  const adjudicated =
    report.flaggedPairs.length - report.unresolvedPairs.length;
  lines.push(
    `  duplicate pairs: ${report.flaggedPairs.length} flagged, ${adjudicated} adjudicated, ${report.unresolvedPairs.length} unresolved (target 0 unresolved — pairs are REPORTED, never auto-failed)`,
  );
  for (const p of report.flaggedPairs) {
    const status = p.adjudication ? `${p.adjudication.verdict}` : 'UNRESOLVED';
    lines.push(
      `    ${p.adjudication ? '◦' : '?'} ${p.a} × ${p.b} — similarity ${p.similarity} [${status}]${p.adjudication ? ` — ${p.adjudication.reason ?? ''}` : ''}`,
    );
  }
  return lines.join('\n');
}

function truncate(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}
