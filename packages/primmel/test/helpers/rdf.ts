// ─────────────────────────────────────────────────────────────────────
// Shared helpers for the RDF/OWL export tests (TODO.roadmap/27, surface
// 2): a minimal Turtle parser for parse-back assertions, an in-memory
// triple store with RDFS-subclass closure, and the fixture package the
// projection / SHACL / SPARQL specs run against.
//
// THE DEPENDENCY CALL (declared, per the task brief): the triple store,
// Turtle parser, SHACL validator (rdf-shacl.ts), and SPARQL evaluator
// (rdf-sparql.ts) are all PURPOSE-BUILT in this test-helpers directory —
// zero npm dependencies. node_modules is a symlink to the main checkout
// (yarn install is forbidden in the worktree), and the 27b surface set
// the doctrine: "the repo has no XML dependency and must not gain one
// for a test" (helpers/reqif.ts) — the same holds for RDF tooling. The
// footprint is the three helpers files; each documents exactly the
// subset it supports, and the exporter, shapes, and competency
// questions all stay inside those subsets.
//
// The parser handles exactly what the exporter emits plus what the
// shapes document uses: @prefix declarations, IRIREFs, prefixed names,
// `a`, string literals (with escapes, language tags, datatypes, and
// """long strings"""), integer and boolean literals, `;` / `,`, `( )`
// collections (kept structural, NOT expanded to rdf:first/rest), `[ ]`
// blank-node property lists, and `#` comments. It is NOT a
// general-purpose Turtle parser.
// ─────────────────────────────────────────────────────────────────────

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────
// The term model + triple store.
// ─────────────────────────────────────────────────────────────────────

export type RdfNode =
  | { kind: 'iri'; iri: string }
  | { kind: 'literal'; value: string; lang?: string; datatype?: string }
  | { kind: 'bnode'; id: string }
  | { kind: 'list'; items: RdfNode[] };

export interface StoreTriple {
  s: RdfNode;
  p: string; // predicates are always IRIs
  o: RdfNode;
}

export const iriNode = (iri: string): RdfNode => ({ kind: 'iri', iri });
export const literalNode = (
  value: string,
  lang?: string,
  datatype?: string,
): RdfNode => ({ kind: 'literal', value, lang, datatype });

export function nodeEquals(a: RdfNode, b: RdfNode): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === 'iri' && b.kind === 'iri') {
    return a.iri === b.iri;
  }
  if (a.kind === 'bnode' && b.kind === 'bnode') {
    return a.id === b.id;
  }
  if (a.kind === 'literal' && b.kind === 'literal') {
    return (
      a.value === b.value &&
      (a.lang ?? '') === (b.lang ?? '') &&
      (a.datatype ?? '') === (b.datatype ?? '')
    );
  }
  if (a.kind === 'list' && b.kind === 'list') {
    return (
      a.items.length === b.items.length &&
      a.items.every((x, i) => nodeEquals(x, b.items[i]))
    );
  }
  return false;
}

/** The display form of a node (Turtle-ish; for messages/assertions). */
export function nodeDisplay(n: RdfNode): string {
  if (n.kind === 'iri') {
    return `<${n.iri}>`;
  }
  if (n.kind === 'bnode') {
    return `_:${n.id}`;
  }
  if (n.kind === 'list') {
    return `( ${n.items.map(nodeDisplay).join(' ')} )`;
  }
  const lang = n.lang ? `@${n.lang}` : '';
  const dt = n.datatype ? `^^<${n.datatype}>` : '';
  return `"${n.value}"${lang}${dt}`;
}

export const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
export const RDF_LANG_STRING =
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';
export const RDFS_SUBCLASS_OF =
  'http://www.w3.org/2000/01/rdf-schema#subClassOf';
export const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';
export const XSD_INTEGER = 'http://www.w3.org/2001/XMLSchema#integer';
export const XSD_BOOLEAN = 'http://www.w3.org/2001/XMLSchema#boolean';

/** A literal's effective datatype (RDF 1.1: plain = xsd:string, lang =
 *  rdf:langString). */
export function literalDatatype(n: RdfNode): string {
  if (n.kind !== 'literal') {
    return '';
  }
  if (n.lang) {
    return RDF_LANG_STRING;
  }
  return n.datatype ?? XSD_STRING;
}

export class TripleStore {
  readonly triples: StoreTriple[] = [];
  readonly prefixes = new Map<string, string>();

  add(s: RdfNode, p: string, o: RdfNode): void {
    this.triples.push({ s, p, o });
  }

  /** The objects of (s, p); s undefined = any subject. */
  objects(s: RdfNode | undefined, p: string): RdfNode[] {
    return this.triples
      .filter(t => t.p === p && (s === undefined || nodeEquals(t.s, s)))
      .map(t => t.o);
  }

  /** All subjects of the graph (iris + bnodes, deduped). */
  subjects(): RdfNode[] {
    const out: RdfNode[] = [];
    for (const t of this.triples) {
      if (!out.some(x => nodeEquals(x, t.s))) {
        out.push(t.s);
      }
    }
    return out;
  }

  /** The declared rdf:types of a node. */
  typesOf(n: RdfNode): string[] {
    return this.objects(n, RDF_TYPE)
      .filter((o): o is Extract<RdfNode, { kind: 'iri' }> => o.kind === 'iri')
      .map(o => o.iri);
  }

  /** The transitive closure of rdfs:subClassOf below `cls` (cls itself
   *  included — the reflexive case of subClassOf*). */
  subclassesOf(cls: string): Set<string> {
    const out = new Set<string>([cls]);
    for (let grew = true; grew;) {
      grew = false;
      for (const t of this.triples) {
        if (
          t.p === RDFS_SUBCLASS_OF &&
          t.s.kind === 'iri' &&
          t.o.kind === 'iri' &&
          out.has(t.o.iri) &&
          !out.has(t.s.iri)
        ) {
          out.add(t.s.iri);
          grew = true;
        }
      }
    }
    return out;
  }

  /** Distinct subjects typed `cls` or any (transitive) subclass. */
  instancesOf(cls: string): RdfNode[] {
    const classes = this.subclassesOf(cls);
    return this.subjects().filter(s =>
      this.typesOf(s).some(ty => classes.has(ty)),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// The Turtle parser (subset — see the module header).
// ─────────────────────────────────────────────────────────────────────

export function parseTurtle(doc: string): TripleStore {
  const store = new TripleStore();
  let i = 0;
  let bnodeSeq = 0;

  const err = (m: string): never => {
    throw new Error(`Turtle parse error at offset ${i}: ${m}`);
  };
  const skipWs = (): void => {
    for (;;) {
      if (i < doc.length && /\s/.test(doc[i])) {
        i++;
      } else if (doc[i] === '#') {
        while (i < doc.length && doc[i] !== '\n') {
          i++;
        }
      } else {
        return;
      }
    }
  };
  const expect = (ch: string): void => {
    skipWs();
    if (doc[i] !== ch) {
      err(`expected '${ch}', found '${doc[i] ?? '<eof>'}'`);
    }
    i++;
  };

  const PN_CHARS = /[A-Za-z0-9_-]/;
  const parseIriRef = (): string => {
    // at '<'
    const end = doc.indexOf('>', i + 1);
    if (end < 0) {
      err('unterminated IRIREF');
    }
    const iri = doc.slice(i + 1, end);
    i = end + 1;
    return iri;
  };
  const parsePrefixedName = (): string => {
    const m = /^[A-Za-z][A-Za-z0-9_-]*:/.exec(doc.slice(i));
    if (!m) {
      err('expected a prefixed name');
    }
    const prefix = m![0].slice(0, -1);
    i += m![0].length;
    let local = '';
    while (i < doc.length && (PN_CHARS.test(doc[i]) || doc[i] === '.')) {
      local += doc[i];
      i++;
    }
    // Dots are legal INSIDE a local name but not at its end — trailing
    // dots belong to the statement terminator; hand them back.
    const trailing = local.match(/\.+$/)?.[0].length ?? 0;
    if (trailing > 0) {
      local = local.slice(0, -trailing);
      i -= trailing;
    }
    const ns = store.prefixes.get(prefix);
    if (ns === undefined) {
      throw new Error(
        `Turtle parse error at offset ${i}: unknown prefix '${prefix}:'`,
      );
    }
    if (local === '') {
      return ns; // `smart:` form — the namespace itself
    }
    return ns + local;
  };
  const parseIri = (): string => {
    skipWs();
    if (doc[i] === '<') {
      return parseIriRef();
    }
    return parsePrefixedName();
  };

  const ESCAPES: Record<string, string> = {
    t: '\t',
    b: '\b',
    n: '\n',
    r: '\r',
    f: '\f',
    '"': '"',
    "'": "'",
    '\\': '\\',
  };
  const parseString = (): string => {
    // at '"'
    if (doc.startsWith('"""', i)) {
      const end = doc.indexOf('"""', i + 3);
      if (end < 0) {
        err('unterminated long string');
      }
      // Long strings: no escape processing needed for the shapes doc
      // (its SPARQL contains no """ or backslash escapes).
      const s = doc.slice(i + 3, end);
      i = end + 3;
      return s;
    }
    i++; // opening quote
    let s = '';
    for (;;) {
      if (i >= doc.length) {
        err('unterminated string');
      }
      const ch = doc[i];
      if (ch === '"') {
        i++;
        return s;
      }
      if (ch === '\\') {
        const e = doc[i + 1];
        if (e === 'u') {
          s += String.fromCharCode(parseInt(doc.slice(i + 2, i + 6), 16));
          i += 6;
        } else if (e === 'U') {
          s += String.fromCodePoint(parseInt(doc.slice(i + 2, i + 10), 16));
          i += 10;
        } else if (e in ESCAPES) {
          s += ESCAPES[e];
          i += 2;
        } else {
          err(`bad escape \\${e}`);
        }
      } else {
        s += ch;
        i++;
      }
    }
  };

  const parseLiteral = (): RdfNode => {
    const value = parseString();
    if (doc[i] === '@') {
      i++;
      const m = /^[a-zA-Z]+(-[a-zA-Z0-9]+)*/.exec(doc.slice(i));
      if (!m) {
        err('bad language tag');
      }
      i += m![0].length;
      return literalNode(value, m![0]);
    }
    if (doc.startsWith('^^', i)) {
      i += 2;
      const dt = parseIri();
      return literalNode(value, undefined, dt);
    }
    return literalNode(value);
  };

  const parseNode = (): RdfNode => {
    skipWs();
    const ch = doc[i];
    if (ch === '<') {
      return iriNode(parseIriRef());
    }
    if (ch === '"') {
      return parseLiteral();
    }
    if (ch === '(') {
      i++;
      const items: RdfNode[] = [];
      for (;;) {
        skipWs();
        if (doc[i] === ')') {
          i++;
          return { kind: 'list', items };
        }
        items.push(parseNode());
      }
    }
    if (ch === '[') {
      return parseBnodePropertyList();
    }
    if (
      ch === 't' &&
      doc.startsWith('true', i) &&
      !PN_CHARS.test(doc[i + 4] ?? '')
    ) {
      i += 4;
      return literalNode('true', undefined, XSD_BOOLEAN);
    }
    if (
      ch === 'f' &&
      doc.startsWith('false', i) &&
      !PN_CHARS.test(doc[i + 5] ?? '')
    ) {
      i += 5;
      return literalNode('false', undefined, XSD_BOOLEAN);
    }
    if (/[0-9+-]/.test(ch)) {
      const m = /^[+-]?[0-9]+/.exec(doc.slice(i));
      if (m) {
        i += m![0].length;
        return literalNode(m![0], undefined, XSD_INTEGER);
      }
    }
    return iriNode(parsePrefixedName());
  };

  const parseBnodePropertyList = (): RdfNode => {
    expect('[');
    skipWs();
    if (doc[i] === ']') {
      i++;
      return { kind: 'bnode', id: `b${++bnodeSeq}` };
    }
    const node: RdfNode = { kind: 'bnode', id: `b${++bnodeSeq}` };
    parsePredicateObjectList(node);
    expect(']');
    return node;
  };

  const parsePredicateObjectList = (subject: RdfNode): void => {
    for (;;) {
      skipWs();
      let predicate: string;
      if (doc[i] === 'a' && /[\s<]/.test(doc[i + 1] ?? '')) {
        predicate = RDF_TYPE;
        i++;
      } else {
        predicate = parseIri();
      }
      for (;;) {
        const object = parseNode();
        store.add(subject, predicate, object);
        skipWs();
        if (doc[i] === ',') {
          i++;
          continue;
        }
        break;
      }
      skipWs();
      if (doc[i] === ';') {
        i++;
        skipWs();
        // Trailing ';' before ']' or '.'
        if (doc[i] === ']' || doc[i] === '.') {
          return;
        }
        continue;
      }
      return;
    }
  };

  for (;;) {
    skipWs();
    if (i >= doc.length) {
      return store;
    }
    if (doc.startsWith('@prefix', i)) {
      i += '@prefix'.length;
      skipWs();
      const m = /^[A-Za-z][A-Za-z0-9_-]*:/.exec(doc.slice(i));
      if (!m) {
        err('bad @prefix name');
      }
      const prefix = m![0].slice(0, -1);
      i += m![0].length;
      skipWs();
      const ns = parseIriRef();
      store.prefixes.set(prefix, ns);
      expect('.');
      continue;
    }
    const subject = parseNode();
    parsePredicateObjectList(subject);
    expect('.');
  }
}

/** Convenience: parse + collect all objects of (subject IRI, predicate IRI). */
export function objectsOf(
  store: TripleStore,
  subjectIri: string,
  predicateIri: string,
): RdfNode[] {
  return store.objects(iriNode(subjectIri), predicateIri);
}

/** The single object of (s, p) or undefined (assertion helper). */
export function objectOf(
  store: TripleStore,
  subjectIri: string,
  predicateIri: string,
): RdfNode | undefined {
  const objs = objectsOf(store, subjectIri, predicateIri);
  return objs.length === 1 ? objs[0] : undefined;
}

// ─────────────────────────────────────────────────────────────────────
// The fixture package: two classes (one depending on the other), four
// requirements (shall default / should / may / an orphan outside any
// class; escaping-problem characters in the alpha statement; a binding
// and a dependency naming another requirement; a dependency on an id
// nothing exports), one targeting conformance test (with guidance and a
// reference), and three terms (two in source clause 3 — one with
// alt/abbreviation labels, one with vocab_ref/see-also/deprecated — and
// one in clause 4, so the clause-3 competency question has a negative
// case).
// ─────────────────────────────────────────────────────────────────────

export function buildRdfFixturePackage(): string {
  const parent = mkdtempSync(join(tmpdir(), 'primmel-rdf-'));
  const dir = join(parent, 'pkg');
  mkdirSync(dir);
  writeFileSync(
    join(dir, 'package.primmel'),
    `package {
  id test-pkg
  kind rec
  title "Test package"
  version "1"
  editions { 1 }
  baseUrn "urn:test:pkg:1"
  description "A tiny RDF export fixture."
}`,
  );
  mkdirSync(join(dir, 'specification'));
  writeFileSync(
    join(dir, 'specification', 'requirements.prl'),
    `requirement_class /req/scope {
  name "Scope requirements"
  title "Scope requirements"
  dependencies { /req/other }
}

requirement_class /req/other {
  name "Other requirements"
}

requirement /req/scope/alpha {
  name "Alpha"
  statement "The widget shall frobnicate & pass <all> \\"checks\\"."
  guidance "Frobnicate gently."
  binds_to { family.parameters.x /req/scope/beta }
  limit {
    expression "ocl{family.parameters.x > 0}"
    uses { family.parameters.x }
  }
  dependencies { /req/scope/beta /req/missing }
  verification { method examination description "By inspection." }
  source { doc "urn:test:r:1:2021" clause "5.2" }
  source { doc "urn:test:r:1:2021" clause "5.2.1" }
}

requirement /req/scope/beta {
  name "Beta"
  statement "The widget should glow."
  obligation should
  source { doc "urn:test:r:1:2021" clause "5.3" }
}

requirement /req/scope/gamma {
  name "Gamma"
  statement "The widget may hum."
  obligation may
}

requirement /req/orphan {
  name "Orphan"
  statement "The widget shall stand alone."
}`,
  );
  writeFileSync(
    join(dir, 'specification', 'conformance.prl'),
    `conformance_test /conf/scope-tests/alpha-check {
  name "Alpha check"
  purpose "Verify the widget frobnicates."
  guidance "Check twice."
  reference { doc "urn:test:r:2:2021" clause "A.3" }
  targets { /req/scope/alpha }
}`,
  );
  writeFileSync(
    join(dir, 'terminology.prl'),
    `term widget {
  label "widget"
  definition "a thing that frobnicates"
  section "3.1"
  source "urn:test:r:1:2021#clause-3.1"
  language "en"
  form_type "fullForm"
  part_of_speech "noun"
  alt { wdg }
  abbreviations { wdg }
}

term frobnication {
  label "frobnication"
  definition "the act of frobnicating"
  section "3.2"
  note "Frobnication is reversible."
  scope_note "Applies to widgets only."
  vocab_ref { register viml-2022 clause "5.15" }
  vocab_term "frobnication act"
  see_also { widget }
  deprecated { frobnicating }
}

term gloom {
  label "gloom"
  definition "the state of a widget that does not glow"
  section "4.1"
}`,
  );
  return dir;
}
