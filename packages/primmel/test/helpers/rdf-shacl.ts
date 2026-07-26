// ─────────────────────────────────────────────────────────────────────
// A minimal SHACL validator for the RDF/OWL export tests — validates a
// projected graph against the projection's shapes document
// (src/export/rdf-shapes.ts). Dependency-free by the declared call
// documented in helpers/rdf.ts.
//
// THE SUPPORTED SUBSET (everything the shipped shapes use, nothing
// more):
//   - node shapes selected by sh:targetClass, with RDFS-subclass
//     closure read from the DATA graph (an exported graph declares the
//     subclass triples it relies on — a primmel:ConformanceTest IS
//     validated by the smart:Provision shape);
//   - property shapes with sh:path (single predicate), sh:minCount,
//     sh:maxCount, sh:nodeKind (IRI / Literal / BlankNode and the Or
//     combinations), sh:datatype (RDF 1.1: plain literals are
//     xsd:string, language literals rdf:langString), sh:class (with
//     subclass closure), sh:in, sh:or (each value must satisfy at
//     least one alternative), sh:uniqueLang, sh:message (carried into
//     the violation);
//   - sh:sparql constraints on node shapes of the form
//     SELECT $this WHERE { ... } (SHACL-SPARQL) — evaluated by the
//     repo's SPARQL subset (rdf-sparql.ts) with $this pre-bound; each
//     returned solution is one violation. Used for the clause-tree
//     acyclicity constraint, which SHACL Core cannot express.
// NOT supported: sh:node / sh:nodeShape linking, sh:qualifiedValueShape,
// severity/deactivation, targetNode/targetSubjectsOf, sequence or
// inverse paths, closed shapes.
// ─────────────────────────────────────────────────────────────────────

import {
  TripleStore,
  literalDatatype,
  nodeDisplay,
  nodeEquals,
  type RdfNode,
} from './rdf';
import { sparqlSelect } from './rdf-sparql';

const SH = 'http://www.w3.org/ns/shacl#';
const SH_TARGET_CLASS = `${SH}targetClass`;
const SH_PROPERTY = `${SH}property`;
const SH_PATH = `${SH}path`;
const SH_MIN_COUNT = `${SH}minCount`;
const SH_MAX_COUNT = `${SH}maxCount`;
const SH_NODE_KIND = `${SH}nodeKind`;
const SH_DATATYPE = `${SH}datatype`;
const SH_CLASS = `${SH}class`;
const SH_IN = `${SH}in`;
const SH_OR = `${SH}or`;
const SH_UNIQUE_LANG = `${SH}uniqueLang`;
const SH_MESSAGE = `${SH}message`;
const SH_SPARQL = `${SH}sparql`;
const SH_SELECT = `${SH}select`;
const SH_IRI = `${SH}IRI`;
const SH_LITERAL = `${SH}Literal`;
const SH_BLANK_NODE = `${SH}BlankNode`;
const SH_BLANK_NODE_OR_IRI = `${SH}BlankNodeOrIRI`;
const SH_BLANK_NODE_OR_LITERAL = `${SH}BlankNodeOrLiteral`;
const SH_IRI_OR_LITERAL = `${SH}IRIOrLiteral`;

export interface ShaclViolation {
  /** The shape IRI that produced the violation. */
  shape: string;
  /** The focus node (display form). */
  focusNode: string;
  /** The property path IRI for property violations. */
  path?: string;
  message: string;
}

/** The literal string of the shapes-graph object of (shape, predicate), if any. */
function shapeValue(
  shapes: TripleStore,
  shapeNode: RdfNode,
  predicate: string,
): RdfNode | undefined {
  const objs = shapes.objects(shapeNode, predicate);
  return objs.length > 0 ? objs[0] : undefined;
}

function shapeMessage(objs: RdfNode[], fallback: string): string {
  const msg = objs.find(o => o.kind === 'literal');
  return msg && msg.kind === 'literal' ? msg.value : fallback;
}

/** The value-constraint failures of one value against one property
 *  shape (or one sh:or alternative): nodeKind / datatype / class / in /
 *  or. Counts live on the caller. */
function valueFailures(
  data: TripleStore,
  shapes: TripleStore,
  shapeNode: RdfNode,
  value: RdfNode,
): string[] {
  const failures: string[] = [];
  const nodeKind = shapeValue(shapes, shapeNode, SH_NODE_KIND);
  if (nodeKind && nodeKind.kind === 'iri') {
    const nk = nodeKind.iri;
    const ok =
      (nk === SH_IRI && value.kind === 'iri') ||
      (nk === SH_LITERAL && value.kind === 'literal') ||
      (nk === SH_BLANK_NODE && value.kind === 'bnode') ||
      (nk === SH_BLANK_NODE_OR_IRI &&
        (value.kind === 'bnode' || value.kind === 'iri')) ||
      (nk === SH_BLANK_NODE_OR_LITERAL &&
        (value.kind === 'bnode' || value.kind === 'literal')) ||
      (nk === SH_IRI_OR_LITERAL &&
        (value.kind === 'iri' || value.kind === 'literal'));
    if (!ok) {
      failures.push(`nodeKind ${nodeDisplay(nodeKind)}`);
    }
  }
  const datatype = shapeValue(shapes, shapeNode, SH_DATATYPE);
  if (datatype && datatype.kind === 'iri') {
    if (value.kind !== 'literal' || literalDatatype(value) !== datatype.iri) {
      failures.push(`datatype ${nodeDisplay(datatype)}`);
    }
  }
  const cls = shapeValue(shapes, shapeNode, SH_CLASS);
  if (cls && cls.kind === 'iri') {
    if (
      value.kind !== 'iri' ||
      !data.instancesOf(cls.iri).some(x => nodeEquals(x, value))
    ) {
      failures.push(`class ${nodeDisplay(cls)}`);
    }
  }
  const inList = shapeValue(shapes, shapeNode, SH_IN);
  if (inList && inList.kind === 'list') {
    if (!inList.items.some(x => nodeEquals(x, value))) {
      failures.push('sh:in membership');
    }
  }
  const or = shapeValue(shapes, shapeNode, SH_OR);
  if (or && or.kind === 'list') {
    const satisfied = or.items.some(
      alt => valueFailures(data, shapes, alt, value).length === 0,
    );
    if (!satisfied) {
      failures.push('sh:or (no alternative satisfied)');
    }
  }
  return failures;
}

/** Validates the data graph against the shapes graph; an empty result
 *  means the data conforms. */
export function validateShacl(
  data: TripleStore,
  shapes: TripleStore,
): ShaclViolation[] {
  const violations: ShaclViolation[] = [];
  for (const shapeNode of shapes.subjects()) {
    for (const target of shapes.objects(shapeNode, SH_TARGET_CLASS)) {
      if (target.kind !== 'iri') {
        continue;
      }
      const shapeIri =
        shapeNode.kind === 'iri' ? shapeNode.iri : nodeDisplay(shapeNode);
      for (const focus of data.instancesOf(target.iri)) {
        // ── property shapes ──
        for (const pn of shapes.objects(shapeNode, SH_PROPERTY)) {
          const path = shapeValue(shapes, pn, SH_PATH);
          if (!path || path.kind !== 'iri') {
            continue;
          }
          const messages = shapes.objects(pn, SH_MESSAGE);
          const values = data.objects(focus, path.iri);
          const min = shapeValue(shapes, pn, SH_MIN_COUNT);
          if (
            min &&
            min.kind === 'literal' &&
            values.length < Number(min.value)
          ) {
            violations.push({
              shape: shapeIri,
              focusNode: nodeDisplay(focus),
              path: path.iri,
              message: shapeMessage(
                messages,
                `minCount ${min.value} violated (${values.length} values)`,
              ),
            });
          }
          const max = shapeValue(shapes, pn, SH_MAX_COUNT);
          if (
            max &&
            max.kind === 'literal' &&
            values.length > Number(max.value)
          ) {
            violations.push({
              shape: shapeIri,
              focusNode: nodeDisplay(focus),
              path: path.iri,
              message: shapeMessage(
                messages,
                `maxCount ${max.value} violated (${values.length} values)`,
              ),
            });
          }
          const uniqueLang = shapeValue(shapes, pn, SH_UNIQUE_LANG);
          if (
            uniqueLang &&
            uniqueLang.kind === 'literal' &&
            uniqueLang.value === 'true'
          ) {
            const langs = values
              .filter(
                (v): v is Extract<RdfNode, { kind: 'literal' }> =>
                  v.kind === 'literal',
              )
              .map(v => v.lang ?? '');
            if (new Set(langs).size !== langs.length) {
              violations.push({
                shape: shapeIri,
                focusNode: nodeDisplay(focus),
                path: path.iri,
                message: shapeMessage(messages, 'uniqueLang violated'),
              });
            }
          }
          for (const value of values) {
            const failures = valueFailures(data, shapes, pn, value);
            if (failures.length > 0) {
              violations.push({
                shape: shapeIri,
                focusNode: nodeDisplay(focus),
                path: path.iri,
                message: shapeMessage(
                  messages,
                  `${nodeDisplay(value)} fails: ${failures.join(', ')}`,
                ),
              });
            }
          }
        }
        // ── SHACL-SPARQL constraints (SELECT $this …) ──
        for (const sn of shapes.objects(shapeNode, SH_SPARQL)) {
          const select = shapeValue(shapes, sn, SH_SELECT);
          if (!select || select.kind !== 'literal') {
            continue;
          }
          const messages = shapes.objects(sn, SH_MESSAGE);
          const solutions = sparqlSelect(
            data,
            select.value,
            { this: focus },
            shapes.prefixes,
          );
          for (let k = 0; k < solutions.length; k++) {
            violations.push({
              shape: shapeIri,
              focusNode: nodeDisplay(focus),
              message: shapeMessage(messages, 'SPARQL constraint violated'),
            });
          }
        }
      }
    }
  }
  return violations;
}
