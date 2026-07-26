// ─────────────────────────────────────────────────────────────────────
// A minimal SPARQL evaluator for the RDF/OWL export tests — the
// acceptance-query machinery for the competency questions
// (src/export/rdf-competency-questions.ts) and the SHACL-SPARQL
// acyclicity constraint (src/export/rdf-shapes.ts). Dependency-free by
// the declared call documented in helpers/rdf.ts.
//
// THE SUPPORTED SUBSET (everything the shipped queries use, nothing
// more):
//   - PREFIX declarations;
//   - SELECT <vars> WHERE { ... } (no *, no ASK/CONSTRUCT/DESCRIBE) —
//     `$this` pre-binding for SHACL-SPARQL constraints;
//   - basic graph patterns: triple patterns with IRI / prefixed-name /
//     literal / variable terms; `.` separators;
//   - predicates: IRI, `a`, inverse `^p`, transitive `p+`,
//     reflexive-transitive `p*` (no alternation, no sequence paths —
//     the competency questions join label nodes explicitly instead);
//   - FILTER(expr) with || && !, comparisons (= != < > <= >=), and the
//     functions STRSTARTS / CONTAINS / REGEX / BOUND / STR / LANG /
//     DATATYPE;
//   - ORDER BY <vars> (ascending).
// Group semantics: all triple patterns join first, then every FILTER
// applies to the joined solutions (exactly SPARQL group semantics for
// this subset). NOT supported: OPTIONAL, UNION, VALUES, aggregates,
// subqueries, ORDER BY DESC/expressions, LIMIT/OFFSET.
// ─────────────────────────────────────────────────────────────────────

import {
  RDF_TYPE,
  TripleStore,
  literalDatatype,
  nodeEquals,
  type RdfNode,
} from './rdf';

export type SparqlBindings = Record<string, RdfNode>;

// ─────────────────────────────────────────────────────────────────────
// Parsing.
// ─────────────────────────────────────────────────────────────────────

type Term = { kind: 'var'; name: string } | { kind: 'node'; node: RdfNode };

interface TriplePattern {
  s: Term;
  path: {
    iri: string;
    inverse: boolean;
    quant: 'one' | 'zeroOrMore' | 'oneOrMore';
  };
  o: Term;
}

type FilterExpr =
  | { op: 'or' | 'and'; args: FilterExpr[] }
  | { op: 'not'; arg: FilterExpr }
  | { op: 'cmp'; cmp: string; left: FilterExpr; right: FilterExpr }
  | { op: 'func'; name: string; args: FilterExpr[] }
  | { op: 'var'; name: string }
  | { op: 'node'; node: RdfNode };

interface ParsedQuery {
  vars: string[];
  patterns: TriplePattern[];
  filters: FilterExpr[];
  orderBy: string[];
}

export function parseSparql(
  query: string,
  seedPrefixes: Map<string, string> = new Map(),
): ParsedQuery {
  let i = 0;
  // SHACL-SPARQL semantics: the shapes graph's prefixes apply inside
  // sh:select strings; the query's own PREFIX declarations extend them.
  const prefixes = new Map<string, string>(seedPrefixes);

  const err = (m: string): never => {
    throw new Error(`SPARQL parse error at offset ${i}: ${m}`);
  };
  const skipWs = (): void => {
    for (;;) {
      if (i < query.length && /\s/.test(query[i])) {
        i++;
      } else if (query[i] === '#') {
        while (i < query.length && query[i] !== '\n') {
          i++;
        }
      } else {
        return;
      }
    }
  };
  const keyword = (kw: string): boolean => {
    skipWs();
    if (query.slice(i, i + kw.length).toUpperCase() === kw) {
      const after = query[i + kw.length] ?? '';
      if (/[^A-Za-z]/.test(after)) {
        i += kw.length;
        return true;
      }
    }
    return false;
  };
  const expectKeyword = (kw: string): void => {
    if (!keyword(kw)) {
      err(`expected ${kw}`);
    }
  };

  const parseIri = (): string => {
    skipWs();
    if (query[i] === '<') {
      const end = query.indexOf('>', i + 1);
      if (end < 0) {
        err('unterminated IRI');
      }
      const iri = query.slice(i + 1, end);
      i = end + 1;
      return iri;
    }
    const m = /^[A-Za-z][A-Za-z0-9_-]*:[A-Za-z0-9_.-]*/.exec(query.slice(i));
    if (!m) {
      err('expected an IRI or prefixed name');
    }
    const full = m![0];
    const colon = full.indexOf(':');
    const ns = prefixes.get(full.slice(0, colon));
    if (ns === undefined) {
      err(`unknown prefix '${full.slice(0, colon)}:'`);
    }
    i += full.length;
    return ns + full.slice(colon + 1);
  };

  const parseTerm = (): Term => {
    skipWs();
    const ch = query[i];
    if (ch === '?' || ch === '$') {
      i++;
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(query.slice(i));
      if (!m) {
        err('bad variable');
      }
      i += m![0].length;
      return { kind: 'var', name: m![0] };
    }
    if (ch === '"') {
      // string literal, optional lang/datatype (query-side literals in
      // the shipped queries are plain strings only, but stay honest)
      const end = query.indexOf('"', i + 1);
      if (end < 0) {
        err('unterminated string');
      }
      const value = query.slice(i + 1, end);
      i = end + 1;
      if (query[i] === '@') {
        i++;
        const m = /^[a-zA-Z]+(-[a-zA-Z0-9]+)*/.exec(query.slice(i));
        if (!m) {
          err('bad language tag');
        }
        i += m![0].length;
        return { kind: 'node', node: { kind: 'literal', value, lang: m![0] } };
      }
      if (query.startsWith('^^', i)) {
        i += 2;
        const dt = parseIri();
        return { kind: 'node', node: { kind: 'literal', value, datatype: dt } };
      }
      return { kind: 'node', node: { kind: 'literal', value } };
    }
    return { kind: 'node', node: { kind: 'iri', iri: parseIri() } };
  };

  const parsePredicate = (): TriplePattern['path'] => {
    skipWs();
    let inverse = false;
    if (query[i] === '^') {
      inverse = true;
      i++;
      skipWs();
    }
    let iri: string;
    // `a` for rdf:type — the one SPARQL keyword legal in predicate
    // position; a prefixed name always carries its ':', so a bare 'a'
    // followed by whitespace is unambiguous.
    if (query[i] === 'a' && /\s/.test(query[i + 1] ?? '')) {
      iri = RDF_TYPE;
      i++;
    } else {
      iri = parseIri();
    }
    skipWs();
    let quant: TriplePattern['path']['quant'] = 'one';
    if (query[i] === '*') {
      quant = 'zeroOrMore';
      i++;
    } else if (query[i] === '+') {
      quant = 'oneOrMore';
      i++;
    }
    return { iri, inverse, quant };
  };

  // ── FILTER expressions (recursive descent) ──
  const parseExpr = (): FilterExpr => parseOr();
  const parseOr = (): FilterExpr => {
    const args = [parseAnd()];
    for (;;) {
      skipWs();
      if (query.startsWith('||', i)) {
        i += 2;
        args.push(parseAnd());
      } else {
        return args.length === 1 ? args[0] : { op: 'or', args };
      }
    }
  };
  const parseAnd = (): FilterExpr => {
    const args = [parseUnary()];
    for (;;) {
      skipWs();
      if (query.startsWith('&&', i)) {
        i += 2;
        args.push(parseUnary());
      } else {
        return args.length === 1 ? args[0] : { op: 'and', args };
      }
    }
  };
  const parseUnary = (): FilterExpr => {
    skipWs();
    if (query[i] === '!') {
      i++;
      return { op: 'not', arg: parseUnary() };
    }
    return parseComparison();
  };
  const parseComparison = (): FilterExpr => {
    const left = parsePrimary();
    skipWs();
    for (const cmp of ['<=', '>=', '!=', '=', '<', '>']) {
      if (query.startsWith(cmp, i)) {
        i += cmp.length;
        const right = parsePrimary();
        return { op: 'cmp', cmp, left, right };
      }
    }
    return left;
  };
  const parsePrimary = (): FilterExpr => {
    skipWs();
    if (query[i] === '(') {
      i++;
      const e = parseExpr();
      skipWs();
      if (query[i] !== ')') {
        err("expected ')'");
      }
      i++;
      return e;
    }
    const fm = /^([A-Za-z]+)\(/.exec(query.slice(i));
    if (fm) {
      const name = fm[1].toUpperCase();
      if (
        ![
          'STRSTARTS',
          'CONTAINS',
          'REGEX',
          'BOUND',
          'STR',
          'LANG',
          'DATATYPE',
        ].includes(name)
      ) {
        err(`unsupported function ${name}`);
      }
      i += fm[0].length;
      const args: FilterExpr[] = [];
      for (;;) {
        args.push(parseExpr());
        skipWs();
        if (query[i] === ',') {
          i++;
          continue;
        }
        if (query[i] === ')') {
          i++;
          break;
        }
        err("expected ',' or ')' in function call");
      }
      return { op: 'func', name, args };
    }
    const term = parseTerm();
    return term.kind === 'var'
      ? { op: 'var', name: term.name }
      : { op: 'node', node: term.node };
  };

  // ── the query itself ──
  for (;;) {
    skipWs();
    if (i >= query.length) {
      err('no SELECT found');
    }
    if (keyword('PREFIX')) {
      skipWs();
      const m = /^[A-Za-z][A-Za-z0-9_-]*:/.exec(query.slice(i));
      if (!m) {
        err('bad PREFIX name');
      }
      const name = m![0].slice(0, -1);
      i += m![0].length;
      skipWs();
      if (query[i] !== '<') {
        err('bad PREFIX IRI');
      }
      const end = query.indexOf('>', i + 1);
      prefixes.set(name, query.slice(i + 1, end));
      i = end + 1;
      continue;
    }
    break;
  }
  expectKeyword('SELECT');
  const vars: string[] = [];
  for (;;) {
    skipWs();
    const ch = query[i];
    if (ch === '?' || ch === '$') {
      const t = parseTerm() as Extract<Term, { kind: 'var' }>;
      vars.push(t.name);
    } else {
      break;
    }
  }
  expectKeyword('WHERE');
  skipWs();
  if (query[i] !== '{') {
    err("expected '{'");
  }
  i++;
  const patterns: TriplePattern[] = [];
  const filters: FilterExpr[] = [];
  for (;;) {
    skipWs();
    if (i >= query.length) {
      err('unterminated WHERE group');
    }
    if (query[i] === '}') {
      i++;
      break;
    }
    if (keyword('FILTER')) {
      skipWs();
      if (query[i] !== '(') {
        err('expected ( after FILTER');
      }
      filters.push(parsePrimary());
      skipWs();
      if (query[i] === '.') {
        i++;
      }
      continue;
    }
    const s = parseTerm();
    // Predicate-object list sugar: `;` chains predicates on the same
    // subject, `,` chains objects on the same predicate.
    for (;;) {
      const path = parsePredicate();
      for (;;) {
        const o = parseTerm();
        patterns.push({ s, path, o });
        skipWs();
        if (query[i] === ',') {
          i++;
          continue;
        }
        break;
      }
      skipWs();
      if (query[i] === ';') {
        i++;
        skipWs();
        // Trailing ';' before the pattern end.
        if (query[i] === '.' || query[i] === '}') {
          break;
        }
        continue;
      }
      break;
    }
    skipWs();
    if (query[i] === '.') {
      i++;
    }
  }
  const orderBy: string[] = [];
  if (keyword('ORDER')) {
    expectKeyword('BY');
    for (;;) {
      skipWs();
      if (query[i] === '?' || query[i] === '$') {
        const t = parseTerm() as Extract<Term, { kind: 'var' }>;
        orderBy.push(t.name);
      } else {
        break;
      }
    }
  }
  skipWs();
  if (i < query.length) {
    err('trailing content after the query');
  }
  return { vars, patterns, filters, orderBy };
}

// ─────────────────────────────────────────────────────────────────────
// Evaluation.
// ─────────────────────────────────────────────────────────────────────

const stringForm = (n: RdfNode): string => {
  if (n.kind === 'iri') {
    return n.iri;
  }
  if (n.kind === 'literal') {
    return n.value;
  }
  if (n.kind === 'bnode') {
    return n.id;
  }
  return '';
};

/** All (subject, object) pairs a predicate path denotes in the store. */
function pathPairs(
  store: TripleStore,
  iri: string,
  inverse: boolean,
  quant: TriplePattern['path']['quant'],
): [RdfNode, RdfNode][] {
  const edges: [RdfNode, RdfNode][] = store.triples
    .filter(t => t.p === iri)
    .map(t => (inverse ? [t.o, t.s] : [t.s, t.o]));
  if (quant === 'one') {
    return edges;
  }
  // Transitive closure per start node (DFS; the graphs are small).
  const pairs: [RdfNode, RdfNode][] = [];
  const seen = new Set<string>();
  const key = (n: RdfNode): string => JSON.stringify(n);
  for (const [start] of edges) {
    const stack = [start];
    const visited = new Set<string>([key(start)]);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const [from, to] of edges) {
        if (!nodeEquals(from, cur)) {
          continue;
        }
        const pairKey = `${key(start)}|${key(to)}`;
        if (!seen.has(pairKey)) {
          seen.add(pairKey);
          pairs.push([start, to]);
        }
        if (!visited.has(key(to))) {
          visited.add(key(to));
          stack.push(to);
        }
      }
    }
  }
  if (quant === 'zeroOrMore') {
    // Zero-length pairs: every node in the graph reaches itself.
    const nodes: RdfNode[] = [];
    for (const t of store.triples) {
      for (const n of [t.s, t.o]) {
        if (n.kind !== 'literal' && !nodes.some(x => nodeEquals(x, n))) {
          nodes.push(n);
        }
      }
    }
    for (const n of nodes) {
      const pairKey = `${key(n)}|${key(n)}`;
      if (!seen.has(pairKey)) {
        seen.add(pairKey);
        pairs.push([n, n]);
      }
    }
  }
  return pairs;
}

function matchTerm(
  term: Term,
  candidate: RdfNode,
  b: SparqlBindings,
): SparqlBindings | null {
  if (term.kind === 'node') {
    return nodeEquals(term.node, candidate) ? b : null;
  }
  const bound = b[term.name];
  if (bound !== undefined) {
    return nodeEquals(bound, candidate) ? b : null;
  }
  return { ...b, [term.name]: candidate };
}

function evalFilter(e: FilterExpr, b: SparqlBindings): boolean {
  const val = (x: FilterExpr): RdfNode | boolean | undefined => {
    switch (x.op) {
      case 'node':
        return x.node;
      case 'var':
        return b[x.name];
      case 'or':
        return x.args.some(a => val(a) === true);
      case 'and':
        return x.args.every(a => val(a) === true);
      case 'not':
        return val(x.arg) !== true;
      case 'func':
        return evalFunc(
          x.name,
          x.args.map(a => val(a)),
        );
      case 'cmp':
        return evalCmp(x.cmp, val(x.left), val(x.right));
    }
  };
  return val(e) === true;
}

type V = RdfNode | boolean | undefined;

function evalFunc(name: string, args: V[]): V {
  const s = (v: V): string | undefined => {
    if (v === undefined || typeof v === 'boolean') {
      return undefined;
    }
    return stringForm(v);
  };
  switch (name) {
    case 'STR':
      return args[0] !== undefined && typeof args[0] !== 'boolean'
        ? { kind: 'literal', value: stringForm(args[0]) }
        : undefined;
    case 'LANG':
      return args[0] !== undefined &&
        typeof args[0] !== 'boolean' &&
        args[0].kind === 'literal'
        ? { kind: 'literal', value: args[0].lang ?? '' }
        : undefined;
    case 'DATATYPE':
      return args[0] !== undefined &&
        typeof args[0] !== 'boolean' &&
        args[0].kind === 'literal'
        ? { kind: 'iri', iri: literalDatatype(args[0]) }
        : undefined;
    case 'BOUND':
      return args[0] !== undefined;
    case 'STRSTARTS': {
      const [a, c] = [s(args[0]), s(args[1])];
      return a === undefined || c === undefined ? undefined : a.startsWith(c);
    }
    case 'CONTAINS': {
      const [a, c] = [s(args[0]), s(args[1])];
      return a === undefined || c === undefined ? undefined : a.includes(c);
    }
    case 'REGEX': {
      const [a, c] = [s(args[0]), s(args[1])];
      return a === undefined || c === undefined
        ? undefined
        : new RegExp(c).test(a);
    }
  }
  return undefined;
}

function evalCmp(cmp: string, left: V, right: V): V {
  if (left === undefined || right === undefined) {
    return undefined; // SPARQL error — the solution is discarded
  }
  if (typeof left === 'boolean' || typeof right === 'boolean') {
    return cmp === '='
      ? left === right
      : cmp === '!='
        ? left !== right
        : undefined;
  }
  if (cmp === '=') {
    return nodeEquals(left, right);
  }
  if (cmp === '!=') {
    return !nodeEquals(left, right);
  }
  const a = stringForm(left);
  const c = stringForm(right);
  const an = Number(a);
  const cn = Number(c);
  const [x, y] =
    a !== '' && c !== '' && !Number.isNaN(an) && !Number.isNaN(cn)
      ? [an, cn]
      : [a, c];
  switch (cmp) {
    case '<':
      return x < y;
    case '>':
      return x > y;
    case '<=':
      return x <= y;
    case '>=':
      return x >= y;
  }
  return undefined;
}

/** Executes a SELECT query against the store; `prebound` seeds the
 *  solutions (the SHACL-SPARQL `$this`), `seedPrefixes` seeds the
 *  prefix table (the shapes graph's prefixes, per SHACL-SPARQL). */
export function sparqlSelect(
  store: TripleStore,
  query: string,
  prebound: SparqlBindings = {},
  seedPrefixes: Map<string, string> = new Map(),
): SparqlBindings[] {
  const q = parseSparql(query, seedPrefixes);
  let solutions: SparqlBindings[] = [{ ...prebound }];
  for (const pattern of q.patterns) {
    const pairs = pathPairs(
      store,
      pattern.path.iri,
      pattern.path.inverse,
      pattern.path.quant,
    );
    const next: SparqlBindings[] = [];
    for (const b of solutions) {
      for (const [sv, ov] of pairs) {
        const b1 = matchTerm(pattern.s, sv, b);
        if (b1 === null) {
          continue;
        }
        const b2 = matchTerm(pattern.o, ov, b1);
        if (b2 === null) {
          continue;
        }
        next.push(b2);
      }
    }
    solutions = next;
  }
  solutions = solutions.filter(b => q.filters.every(f => evalFilter(f, b)));
  if (q.orderBy.length > 0) {
    const cmpKey = (b: SparqlBindings, v: string): string => {
      const n = b[v];
      return n === undefined ? '￿' : stringForm(n);
    };
    solutions = [...solutions].sort((a, b) => {
      for (const v of q.orderBy) {
        const ka = cmpKey(a, v);
        const kb = cmpKey(b, v);
        if (ka !== kb) {
          return ka < kb ? -1 : 1;
        }
      }
      return 0;
    });
  }
  return solutions;
}
