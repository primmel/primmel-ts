// ─────────────────────────────────────────────────────────────────────
// RDF/OWL export tests (TODO.roadmap/27, interop projections surface 2):
// the exact modality mapping (obligation → Provision subclass), the
// document/clause-tree/provision/term projections checked by parsing
// the Turtle back, the SHACL shapes validated clean on the projection
// and failing on deliberately broken graphs, the SPARQL competency
// questions executed against the projected graph, a golden
// small-package document, the header-note doctrine, and the real R 60
// package exercised end to end.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  exportPackageRdf,
  rdfRequirementClassOf,
  rdfSlug,
} from '../src/export/rdf';
import {
  RDF_PROVISION_CLASS_BY_OBLIGATION,
  rdfObligationToken,
  rdfProvisionClass,
  SMART_NS,
} from '../src/export/rdf-vocabulary';
import { RDF_EXPORT_SHAPES_TTL } from '../src/export/rdf-shapes';
import { RDF_COMPETENCY_QUESTIONS } from '../src/export/rdf-competency-questions';
import {
  buildRdfFixturePackage,
  iriNode,
  literalNode,
  nodeDisplay,
  objectOf,
  objectsOf,
  parseTurtle,
  type RdfNode,
  type TripleStore,
} from './helpers/rdf';
import { buildCounterexamplePackage } from './helpers/reqif';
import { validateShacl } from './helpers/rdf-shacl';
import { sparqlSelect } from './helpers/rdf-sparql';

// The real R 60 package lives in the sibling smart repo checkout, which
// CI and fresh clones do not have — the R 60 spec then SKIPs gracefully
// (same pattern as check.test.ts / reqif-export.test.ts). Set
// R60_PACKAGE to a built primmel-packages/oiml-r60 directory to enable.
const R60 =
  process.env.R60_PACKAGE ??
  '/Users/mulgogi/src/oimlsmart/smart/primmel-packages/oiml-r60';
const R60_AVAILABLE = existsSync(R60);
const R60_SKIP: string | false = R60_AVAILABLE
  ? false
  : `no oiml-r60 package at ${R60} — set R60_PACKAGE to a built primmel-packages/oiml-r60 directory`;
if (!R60_AVAILABLE) {
  console.log(`rdf-export.test.ts: skipping the R 60 spec — ${R60_SKIP}`);
}

const SMART = (local: string): string => `${SMART_NS}${local}`;
const DCTERMS = 'http://purl.org/dc/terms/';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const SKOS = 'http://www.w3.org/2004/02/skos/core#';
const SKOSXL = 'http://www.w3.org/2008/05/skos-xl#';
const PRIMMEL = 'urn:primmel:vocab:';
const INST = 'urn:test:pkg:1#';
const DOC = 'urn:test:pkg:1';

/** Exports the fixture package and parses the Turtle back. */
function fixtureGraph(): {
  store: TripleStore;
  stats: ReturnType<typeof exportPackageRdf>['stats'];
} {
  const result = exportPackageRdf(buildRdfFixturePackage());
  const store = parseTurtle(result.turtle);
  return { store, stats: result.stats };
}

/** The rdf:type IRIs of a node (subject IRI form). */
function typesOf(store: TripleStore, subjectIri: string): string[] {
  return store.typesOf(iriNode(subjectIri));
}

/** All cross-reference triples (requires / verifies / references). */
function crossReferences(
  store: TripleStore,
): { s: string; p: string; o: string }[] {
  const preds = [
    `${DCTERMS}requires`,
    `${PRIMMEL}verifies`,
    `${DCTERMS}references`,
  ];
  return store.triples
    .filter(t => preds.includes(t.p))
    .map(t => ({
      s: nodeDisplay(t.s),
      p: t.p,
      o: nodeDisplay(t.o),
    }));
}

describe('RDF/OWL export (TODO.roadmap/27)', () => {
  it('maps obligations to Provision subclasses exactly: shall→Requirement, should→Recommendation, may→Permission', () => {
    assert.equal(rdfProvisionClass('shall'), SMART('Requirement'));
    assert.equal(rdfProvisionClass('should'), SMART('Recommendation'));
    assert.equal(rdfProvisionClass('may'), SMART('Permission'));
    // The empty obligation is the Primmel default (shall); anything else
    // maps to the bare smart:Provision, never silently promoted.
    assert.equal(rdfProvisionClass(''), SMART('Requirement'));
    assert.equal(rdfProvisionClass('bogus'), SMART('Provision'));
    // …and the primmel:obligation token mirrors the class.
    assert.equal(rdfObligationToken(''), 'shall');
    assert.equal(rdfObligationToken('may'), 'may');
    assert.equal(rdfObligationToken('bogus'), 'undefined');
    assert.deepEqual(Object.keys(RDF_PROVISION_CLASS_BY_OBLIGATION), [
      'shall',
      'should',
      'may',
    ]);
  });

  it('slugs ids into IRI-safe locals and places requirements under their longest-prefix class id', () => {
    assert.equal(rdfSlug('/req/metrological/mpe'), 'req-metrological-mpe');
    assert.equal(rdfSlug('/'), 'x');
    assert.equal(rdfRequirementClassOf('/req/a/b', ['/req/a']), '/req/a');
    assert.equal(
      rdfRequirementClassOf('/req/a/b/c', ['/req/a', '/req/a/b']),
      '/req/a/b',
    );
    assert.equal(rdfRequirementClassOf('/req/ab/x', ['/req/a']), null);
  });

  it('emits Turtle that parses back with the declared prefixes and the exact triple count', () => {
    const result = exportPackageRdf(buildRdfFixturePackage());
    const store = parseTurtle(result.turtle);
    assert.equal(store.triples.length, result.stats.triples);
    assert.match(
      result.turtle,
      /@prefix smart: <https:\/\/w3id\.org\/standards\/smart\/ontologies\/core\/> \./,
    );
    assert.match(result.turtle, /@prefix inst: <urn:test:pkg:1#> \./);
    assert.match(result.turtle, /@prefix primmel: <urn:primmel:vocab:> \./);
    // The graph is self-contained for RDFS-subclass consumers: the
    // subclass declarations the shapes and queries rely on.
    for (const sub of ['Requirement', 'Recommendation', 'Permission']) {
      assert.ok(
        store.triples.some(
          t =>
            nodeEqualsSafe(t.s, SMART(sub)) &&
            t.p === 'http://www.w3.org/2000/01/rdf-schema#subClassOf' &&
            nodeEqualsSafe(t.o, SMART('Provision')),
        ),
        `missing declaration ${sub} ⊑ Provision`,
      );
    }
    assert.ok(
      store.triples.some(
        t =>
          nodeEqualsSafe(t.s, `${PRIMMEL}ConformanceTest`) &&
          t.p === 'http://www.w3.org/2000/01/rdf-schema#subClassOf' &&
          nodeEqualsSafe(t.o, SMART('Provision')),
      ),
    );
  });

  it('renders the same graph as JSON-LD (--format jsonld)', () => {
    const result = exportPackageRdf(buildRdfFixturePackage());
    const doc = JSON.parse(result.jsonld);
    assert.equal(doc['@context'].smart, SMART_NS);
    assert.equal(doc['@context'].inst, 'urn:test:pkg:1#');
    const byId = new Map<string, Record<string, unknown>>(
      doc['@graph'].map((n: Record<string, unknown>) => [
        n['@id'] as string,
        n,
      ]),
    );
    const alpha = byId.get('inst:req-scope-alpha')!;
    assert.deepEqual(alpha['@type'], ['smart:Requirement']);
    assert.deepEqual(alpha['dcterms:identifier'], [
      { '@value': '/req/scope/alpha' },
    ]);
    assert.deepEqual(alpha['primmel:obligation'], [{ '@value': 'shall' }]);
    assert.deepEqual(alpha['dcterms:isPartOf'], [{ '@id': 'inst:req-scope' }]);
    // The document node keeps its full URN @id (no angle brackets).
    assert.ok(byId.has(DOC));
  });

  it('projects each requirement’s obligation into the Provision subclass + primmel:obligation token', () => {
    const { store } = fixtureGraph();
    assert.deepEqual(typesOf(store, `${INST}req-scope-alpha`), [
      SMART('Requirement'),
    ]);
    assert.deepEqual(typesOf(store, `${INST}req-scope-beta`), [
      SMART('Recommendation'),
    ]);
    assert.deepEqual(typesOf(store, `${INST}req-scope-gamma`), [
      SMART('Permission'),
    ]);
    assert.deepEqual(typesOf(store, `${INST}conf-scope-tests-alpha-check`), [
      `${PRIMMEL}ConformanceTest`,
    ]);
    const obligation = (id: string): string => {
      const o = objectOf(store, id, `${PRIMMEL}obligation`);
      return o && o.kind === 'literal' ? o.value : '';
    };
    assert.equal(obligation(`${INST}req-scope-alpha`), 'shall');
    assert.equal(obligation(`${INST}req-scope-beta`), 'should');
    assert.equal(obligation(`${INST}req-scope-gamma`), 'may');
    assert.equal(
      obligation(`${INST}conf-scope-tests-alpha-check`),
      'undefined',
    );
  });

  it('nests the document, clause tree, provisions, and the synthetic tests clause', () => {
    const { store } = fixtureGraph();
    const parent = (id: string): string => {
      const o = objectOf(store, id, `${DCTERMS}isPartOf`);
      return o && o.kind === 'iri' ? o.iri : '';
    };
    assert.deepEqual(typesOf(store, DOC), [SMART('PublicationDocument')]);
    assert.equal(parent(`${INST}req-scope`), DOC);
    assert.equal(parent(`${INST}req-other`), DOC);
    assert.equal(parent(`${INST}req-scope-alpha`), `${INST}req-scope`);
    assert.equal(parent(`${INST}req-orphan`), DOC); // orphan at top level
    assert.equal(
      parent(`${INST}conf-scope-tests-alpha-check`),
      `${INST}conformance-tests`,
    );
    assert.equal(parent(`${INST}conformance-tests`), DOC);
    // The document carries its publication typing + identity.
    assert.deepEqual(typesOf(store, DOC), [SMART('PublicationDocument')]);
    assert.deepEqual(
      objectOf(store, DOC, `${SMART_NS}hasPublicationType`),
      iriNode(
        'https://w3id.org/standards/smart/taxonomies/publication-type/standard',
      ),
    );
    assert.deepEqual(
      objectOf(store, DOC, `${DCTERMS}identifier`),
      literalNode('test-pkg'),
    );
  });

  it('projects dependencies, bindings, targets, and see-also into cross-references; unexported refs drop, never dangle', () => {
    const { store, stats } = fixtureGraph();
    assert.deepEqual(crossReferences(store), [
      {
        s: `<${INST}req-scope>`,
        p: `${DCTERMS}requires`,
        o: `<${INST}req-other>`,
      },
      {
        s: `<${INST}req-scope-alpha>`,
        p: `${DCTERMS}requires`,
        o: `<${INST}req-scope-beta>`,
      },
      {
        s: `<${INST}req-scope-alpha>`,
        p: `${DCTERMS}references`,
        o: `<${INST}req-scope-beta>`,
      },
      {
        s: `<${INST}conf-scope-tests-alpha-check>`,
        p: `${PRIMMEL}verifies`,
        o: `<${INST}req-scope-alpha>`,
      },
      {
        s: `<${INST}term-frobnication>`,
        p: `${DCTERMS}references`,
        o: `<${INST}term-widget>`,
      },
    ]);
    // /req/missing is not in the export: recorded as dropped, and no
    // reference targets an IRI with no node in the graph.
    assert.deepEqual(stats.droppedReferences, [
      '/req/scope/alpha -> /req/missing (depends-on)',
    ]);
    assert.equal(stats.crossReferences, 5);
    const subjects = new Set(store.subjects().map(nodeDisplay));
    for (const ref of crossReferences(store)) {
      assert.ok(subjects.has(ref.o), `dangling reference target ${ref.o}`);
    }
  });

  it('carries provenance (dcterms:source doc#clause IRIs, deduped) and inert verification-method data', () => {
    const { store } = fixtureGraph();
    assert.deepEqual(
      objectsOf(store, `${INST}req-scope-alpha`, `${DCTERMS}source`),
      [
        iriNode('urn:test:r:1:2021#clause-5.2'),
        iriNode('urn:test:r:1:2021#clause-5.2.1'),
      ],
    );
    assert.deepEqual(
      objectsOf(
        store,
        `${INST}conf-scope-tests-alpha-check`,
        `${DCTERMS}source`,
      ),
      [iriNode('urn:test:r:2:2021#clause-A.3')],
    );
    assert.deepEqual(
      objectOf(store, `${INST}req-scope-alpha`, `${PRIMMEL}verificationMethod`),
      literalNode('examination'),
    );
  });

  it('emits human-readable citations (CASCO-style doc + clause-list) as natural-language literal provenance, never IRI-mangled', () => {
    // The rdflib cross-check on the R 60 export caught the malformed-IRI
    // class; the review's Minor 2 then caught the literal form keeping
    // the IRI-mangled `#clause-` composition — the literal now reads as
    // natural language ("doc, clause X").
    const parent = mkdtempSync(join(tmpdir(), 'primmel-rdf-cite-'));
    const dir = join(parent, 'pkg');
    mkdirSync(dir);
    writeFileSync(
      join(dir, 'package.primmel'),
      `package {
  id cite-pkg
  kind rec
  title "Citations"
  version "1"
  editions { 1 }
  baseUrn "urn:test:cite:1"
  description "d"
}`,
    );
    mkdirSync(join(dir, 'specification'));
    writeFileSync(
      join(dir, 'specification', 'r.prl'),
      `requirement /req/cited {
  statement "The widget shall be cited."
  source { doc "ISO/IEC 17065:2012" clause "7.9.1, 7.9.2" }
}

requirement /req/cited-bare {
  statement "The widget shall be cited bare."
  source { doc "ISO/IEC 17065:2012, 4.1.1" clause "" }
}`,
    );
    const store = parseTurtle(exportPackageRdf(dir).turtle);
    assert.deepEqual(
      objectsOf(store, 'urn:test:cite:1#req-cited', `${DCTERMS}source`),
      [literalNode('ISO/IEC 17065:2012, clause 7.9.1, 7.9.2')],
    );
    // The bare-doc form (the R 60 layers' common case) cites as-is.
    assert.deepEqual(
      objectsOf(store, 'urn:test:cite:1#req-cited-bare', `${DCTERMS}source`),
      [literalNode('ISO/IEC 17065:2012, 4.1.1')],
    );
  });

  it('rejects a malformed baseUrn at the door — a clean content failure, never malformed Turtle (review Important 1)', () => {
    const parent = mkdtempSync(join(tmpdir(), 'primmel-rdf-urn-'));
    const dir = join(parent, 'pkg');
    mkdirSync(dir);
    writeFileSync(
      join(dir, 'package.primmel'),
      `package {
  id bad-urn-pkg
  kind rec
  title "Bad URN"
  version "1"
  editions { 1 }
  baseUrn "urn:bad urn"
  description "d"
}`,
    );
    mkdirSync(join(dir, 'specification'));
    writeFileSync(
      join(dir, 'specification', 'r.prl'),
      'requirement /req/one {\n  statement "S."\n}',
    );
    assert.throws(
      () => exportPackageRdf(dir),
      (e: Error) => {
        // One line, names the field and the shape — no stack at the CLI.
        assert.match(
          e.message,
          /^package "bad-urn-pkg": baseUrn "urn:bad urn" is not a well-formed IRI/,
        );
        return true;
      },
    );
    // A well-formed baseUrn passes (the same manifest, URN fixed).
    writeFileSync(
      join(dir, 'package.primmel'),
      `package {
  id bad-urn-pkg
  kind rec
  title "Bad URN"
  version "1"
  editions { 1 }
  baseUrn "urn:good:urn:1"
  description "d"
}`,
    );
    const store = parseTurtle(exportPackageRdf(dir).turtle);
    assert.ok(store.triples.length > 0);
  });

  it('projects guidance as ProvisionSupplement notes', () => {
    const { store, stats } = fixtureGraph();
    assert.equal(stats.supplements, 2); // alpha's + the test's guidance
    const sup = objectOf(
      store,
      `${INST}req-scope-alpha`,
      `${SMART_NS}hasSupplement`,
    );
    assert.ok(sup && sup.kind === 'iri');
    const supIri = (sup as Extract<typeof sup, { kind: 'iri' }>).iri;
    assert.deepEqual(typesOf(store, supIri), [SMART('ProvisionSupplement')]);
    assert.deepEqual(
      objectOf(store, supIri, `${SMART_NS}hasSupplementType`),
      iriNode(
        'https://w3id.org/standards/smart/taxonomies/provision-supplement-type/note',
      ),
    );
    assert.deepEqual(
      objectOf(store, supIri, `${RDF}value`),
      literalNode('Frobnicate gently.', 'en'),
    );
  });

  it('projects terms as TermEntry + skosxl labels with definitions, form/POS types, and provenance', () => {
    const { store, stats } = fixtureGraph();
    assert.equal(stats.terms, 3);
    const entry = `${INST}term-widget`;
    assert.deepEqual(typesOf(store, entry), [SMART('TermEntry')]);
    assert.deepEqual(
      objectOf(store, entry, `${SKOS}definition`),
      literalNode('a thing that frobnicates', 'en'),
    );
    assert.deepEqual(
      objectOf(store, entry, `${SMART_NS}hasSectionNumber`),
      literalNode('3.1'),
    );
    assert.deepEqual(objectsOf(store, entry, `${DCTERMS}source`), [
      iriNode('urn:test:r:1:2021#clause-3.1'),
    ]);
    // prefLabel: a smart:Term + skosxl:Label with literal form, form
    // type, and part-of-speech type.
    const pref = objectOf(store, entry, `${SKOSXL}prefLabel`);
    assert.ok(pref && pref.kind === 'iri');
    const prefIri = (pref as Extract<typeof pref, { kind: 'iri' }>).iri;
    assert.deepEqual(typesOf(store, prefIri).sort(), [
      `${SKOSXL}Label`,
      SMART('Term'),
    ]);
    assert.deepEqual(
      objectOf(store, prefIri, `${SKOSXL}literalForm`),
      literalNode('widget', 'en'),
    );
    assert.deepEqual(
      objectOf(store, prefIri, `${SMART_NS}hasTermFormType`),
      iriNode(
        'https://w3id.org/standards/smart/taxonomies/term-form-type/fullForm',
      ),
    );
    assert.deepEqual(
      objectOf(store, prefIri, `${SMART_NS}hasPartOfSpeechType`),
      iriNode(
        'https://w3id.org/standards/smart/taxonomies/part-of-speech-type/noun',
      ),
    );
    // The alt label carries the abbreviation form type (it is listed in
    // the term's abbreviations).
    const alt = objectOf(store, entry, `${SKOSXL}altLabel`);
    assert.ok(alt && alt.kind === 'iri');
    assert.deepEqual(
      objectOf(
        store,
        (alt as Extract<typeof alt, { kind: 'iri' }>).iri,
        `${SMART_NS}hasTermFormType`,
      ),
      iriNode(
        'https://w3id.org/standards/smart/taxonomies/term-form-type/abbreviation',
      ),
    );
    // frobnication: note, scope note, vocab register citation, deprecated label.
    const frob = `${INST}term-frobnication`;
    assert.deepEqual(
      objectOf(store, frob, `${SKOS}note`),
      literalNode('Frobnication is reversible.', 'en'),
    );
    assert.deepEqual(
      objectOf(store, frob, `${SKOS}scopeNote`),
      literalNode('Applies to widgets only.', 'en'),
    );
    assert.deepEqual(
      objectOf(store, frob, `${PRIMMEL}vocabRef`),
      literalNode('viml-2022#5.15'),
    );
    assert.deepEqual(
      objectOf(store, frob, `${PRIMMEL}vocabTerm`),
      literalNode('frobnication act', 'en'),
    );
    const dep = objectOf(store, frob, `${SMART_NS}deprecatedLabel`);
    assert.ok(dep && dep.kind === 'iri');
    assert.deepEqual(
      objectOf(
        store,
        (dep as Extract<typeof dep, { kind: 'iri' }>).iri,
        `${SKOSXL}literalForm`,
      ),
      literalNode('frobnicating', 'en'),
    );
  });

  it('states the one-way / survive-vs-lost doctrine in the leading Turtle comment', () => {
    const result = exportPackageRdf(buildRdfFixturePackage());
    assert.match(result.turtle, /ONE-WAY PROJECTION/);
    assert.match(result.turtle, /remains the single source of/);
    assert.match(result.turtle, /NEVER merges/);
    assert.match(result.turtle, /SURVIVES the projection/);
    assert.match(result.turtle, /LOST in the projection/);
    assert.match(
      result.turtle,
      /shall ->\s+#?\s*smart:Requirement, should -> smart:Recommendation, may ->/,
    );
  });

  it('sanitizes newlines in interpolated values for the Turtle comment (PRL strings can contain raw newlines)', () => {
    const parent = mkdtempSync(join(tmpdir(), 'primmel-rdf-nl-'));
    const dir = join(parent, 'pkg');
    mkdirSync(dir);
    writeFileSync(
      join(dir, 'package.primmel'),
      `package {
  id nl-pkg
  kind rec
  title "R 99 — the
multi-line package"
  version "1"
  editions { 1 }
  baseUrn "urn:test:nl:1"
  description "d"
}`,
    );
    mkdirSync(join(dir, 'specification'));
    writeFileSync(
      join(dir, 'specification', 'r.prl'),
      'requirement /req/one {\n  statement "S."\n}',
    );
    const result = exportPackageRdf(dir);
    // Every comment line of the header note starts with '#' …
    const comment = result.turtle.slice(0, result.turtle.indexOf('@prefix'));
    for (const line of comment.trimEnd().split('\n')) {
      assert.match(line, /^#/);
    }
    assert.match(comment, /R 99 — the multi-line package/);
    // …and the document still parses back.
    assert.ok(parseTurtle(result.turtle).triples.length > 0);
  });

  it('matches the golden fixture export byte-for-byte', () => {
    // The whole fixture document, pinned (fixtures/rdf-export-golden.ttl
    // was generated by this exporter from the helpers/rdf.ts fixture,
    // then reviewed; regenerate it the same way when the projection
    // intentionally changes — the output is fully deterministic).
    const result = exportPackageRdf(buildRdfFixturePackage());
    const golden = readFileSync(
      join(__dirname, 'fixtures', 'rdf-export-golden.ttl'),
      'utf8',
    );
    assert.equal(result.turtle, golden);
  });

  // ── SHACL legs ──

  it('validates clean against the projection’s SHACL shapes', () => {
    const { store } = fixtureGraph();
    const shapes = parseTurtle(RDF_EXPORT_SHAPES_TTL);
    assert.deepEqual(validateShacl(store, shapes), []);
  });

  it('SHACL: a provision missing its identifier fails the Provision shape', () => {
    const { store } = fixtureGraph();
    // Deliberately broken: drop alpha's identifier triple.
    const idPred = `${DCTERMS}identifier`;
    const idx = store.triples.findIndex(
      t =>
        nodeEqualsSafe(t.s, `${INST}req-scope-alpha`) &&
        t.p === idPred &&
        t.o.kind === 'literal' &&
        t.o.value === '/req/scope/alpha',
    );
    assert.ok(idx >= 0);
    store.triples.splice(idx, 1);
    const violations = validateShacl(store, parseTurtle(RDF_EXPORT_SHAPES_TTL));
    assert.equal(violations.length, 1);
    assert.match(violations[0].shape, /ProvisionShape$/);
    assert.equal(violations[0].path, idPred);
    assert.match(violations[0].message, /exactly one identifier/);
  });

  it('SHACL: a clause that is its own ancestor fails the acyclicity constraint', () => {
    const { store } = fixtureGraph();
    // Deliberately broken: scope ⇄ other (each isPartOf exactly 1 —
    // the count shapes stay silent; only the cycle constraint fires).
    const isPartOf = `${DCTERMS}isPartOf`;
    for (const [subj, newObj] of [
      [`${INST}req-scope`, `${INST}req-other`],
      [`${INST}req-other`, `${INST}req-scope`],
    ] as const) {
      const idx = store.triples.findIndex(
        t => nodeEqualsSafe(t.s, subj) && t.p === isPartOf,
      );
      assert.ok(idx >= 0);
      store.triples[idx] = { ...store.triples[idx], o: iriNode(newObj) };
    }
    const violations = validateShacl(store, parseTurtle(RDF_EXPORT_SHAPES_TTL));
    const cycle = violations.filter(v =>
      /ClauseTreeAcyclicShape$/.test(v.shape),
    );
    assert.equal(cycle.length, 2); // both clauses are their own ancestor
    assert.match(cycle[0].message, /acyclic/);
    // …and no OTHER shape fires on this graph.
    assert.deepEqual(
      violations.filter(v => !/ClauseTreeAcyclicShape$/.test(v.shape)),
      [],
    );
  });

  it('SHACL: an off-vocabulary modality token fails the sh:in constraint', () => {
    const { store } = fixtureGraph();
    // Deliberately broken: "must" is not in the modality set.
    const idx = store.triples.findIndex(
      t =>
        nodeEqualsSafe(t.s, `${INST}req-scope-alpha`) &&
        t.p === `${PRIMMEL}obligation`,
    );
    assert.ok(idx >= 0);
    store.triples[idx] = { ...store.triples[idx], o: literalNode('must') };
    const violations = validateShacl(store, parseTurtle(RDF_EXPORT_SHAPES_TTL));
    assert.equal(violations.length, 1);
    assert.match(violations[0].shape, /ProvisionShape$/);
    assert.equal(violations[0].path, `${PRIMMEL}obligation`);
    assert.match(violations[0].message, /modality token/);
  });

  // ── competency questions (the SPARQL acceptance queries) ──

  for (const cq of RDF_COMPETENCY_QUESTIONS) {
    it(`${cq.id} executes against the projected graph: ${cq.question}`, () => {
      const { store } = fixtureGraph();
      // Every CQ parses and runs; the exact assertions live in the
      // dedicated legs below.
      assert.ok(Array.isArray(sparqlSelect(store, cq.sparql)));
    });
  }

  it('CQ1: all shall-provisions with their holding clause', () => {
    const { store } = fixtureGraph();
    const cq = RDF_COMPETENCY_QUESTIONS.find(q => q.id === 'CQ1')!;
    assert.deepEqual(
      sparqlSelect(store, cq.sparql).map(r => [
        nodeDisplay(r.provision),
        nodeDisplay(r.clause),
      ]),
      [
        [`<${INST}req-orphan>`, `<${DOC}>`],
        [`<${INST}req-scope-alpha>`, `<${INST}req-scope>`],
      ],
    );
  });

  it('CQ2: the verification coverage map (tests → verified provisions)', () => {
    const { store } = fixtureGraph();
    const cq = RDF_COMPETENCY_QUESTIONS.find(q => q.id === 'CQ2')!;
    assert.deepEqual(
      sparqlSelect(store, cq.sparql).map(r => [
        nodeDisplay(r.test),
        nodeDisplay(r.provision),
      ]),
      [[`<${INST}conf-scope-tests-alpha-check>`, `<${INST}req-scope-alpha>`]],
    );
  });

  it('CQ3: terms defined in clause 3 of the source document', () => {
    const { store } = fixtureGraph();
    const cq = RDF_COMPETENCY_QUESTIONS.find(q => q.id === 'CQ3')!;
    assert.deepEqual(
      sparqlSelect(store, cq.sparql).map(r => [
        nodeDisplay(r.entry),
        nodeDisplay(r.section),
        nodeDisplay(r.label),
      ]),
      [
        [`<${INST}term-widget>`, '"3.1"', '"widget"@en'],
        [`<${INST}term-frobnication>`, '"3.2"', '"frobnication"@en'],
      ],
    );
  });

  it('CQ4: every provision under its (sub)class — the modality census', () => {
    const { store } = fixtureGraph();
    const cq = RDF_COMPETENCY_QUESTIONS.find(q => q.id === 'CQ4')!;
    assert.deepEqual(
      sparqlSelect(store, cq.sparql).map(r => [
        nodeDisplay(r.type),
        nodeDisplay(r.provision),
      ]),
      [
        [`<${SMART('Permission')}>`, `<${INST}req-scope-gamma>`],
        [`<${SMART('Recommendation')}>`, `<${INST}req-scope-beta>`],
        [`<${SMART('Requirement')}>`, `<${INST}req-orphan>`],
        [`<${SMART('Requirement')}>`, `<${INST}req-scope-alpha>`],
        [
          `<${PRIMMEL}ConformanceTest>`,
          `<${INST}conf-scope-tests-alpha-check>`,
        ],
      ],
    );
  });

  it('CQ5: the full clause tree (clause → parent)', () => {
    const { store } = fixtureGraph();
    const cq = RDF_COMPETENCY_QUESTIONS.find(q => q.id === 'CQ5')!;
    assert.deepEqual(
      sparqlSelect(store, cq.sparql).map(r => [
        nodeDisplay(r.clause),
        nodeDisplay(r.parent),
      ]),
      [
        [`<${INST}conformance-tests>`, `<${DOC}>`],
        [`<${INST}req-other>`, `<${DOC}>`],
        [`<${INST}req-scope>`, `<${DOC}>`],
      ],
    );
  });

  // ── the counterexample package (shared with the ReqIF surface) ──

  it('types unknown obligation spellings as bare smart:Provision with token undefined — counted, never promoted', () => {
    const result = exportPackageRdf(buildCounterexamplePackage());
    assert.equal(result.stats.unknownObligations, 1);
    assert.match(
      result.turtle,
      /1 unknown obligation \(typed bare smart:Provision\)/,
    );
    const store = parseTurtle(result.turtle);
    const inst = 'urn:test:dashy:1#';
    assert.deepEqual(typesOf(store, `${inst}req-one`), [SMART('Provision')]);
    assert.deepEqual(
      objectOf(store, `${inst}req-one`, `${PRIMMEL}obligation`),
      literalNode('undefined'),
    );
    // A bare-Provision node still validates clean (modality token
    // "undefined" is in the enumerated set).
    assert.deepEqual(
      validateShacl(store, parseTurtle(RDF_EXPORT_SHAPES_TTL)),
      [],
    );
  });

  it('records a binds ref to an unexported /-id as dropped; subject paths stay silent', () => {
    const result = exportPackageRdf(buildCounterexamplePackage());
    assert.deepEqual(result.stats.droppedReferences, [
      '/req/one -> /req/not-exported (binds)',
    ]);
    const store = parseTurtle(result.turtle);
    const subjects = new Set(store.subjects().map(nodeDisplay));
    for (const ref of crossReferences(store)) {
      assert.ok(subjects.has(ref.o), `dangling reference target ${ref.o}`);
    }
  });

  // ── the real R 60 package ──

  it(
    'exports the real R 60 package: counts, SHACL-clean, competency questions answered',
    { skip: R60_SKIP },
    () => {
      const result = exportPackageRdf(R60);
      assert.deepEqual(
        {
          documents: result.stats.documents,
          requirementClasses: result.stats.requirementClasses,
          requirements: result.stats.requirements,
          conformanceTests: result.stats.conformanceTests,
          terms: result.stats.terms,
          droppedReferences: result.stats.droppedReferences.length,
          unknownObligations: result.stats.unknownObligations,
        },
        {
          documents: 1,
          requirementClasses: 14,
          requirements: 180,
          conformanceTests: 62,
          terms: 85,
          droppedReferences: 0,
          unknownObligations: 0,
        },
      );
      const store = parseTurtle(result.turtle);
      assert.equal(store.triples.length, result.stats.triples);
      // SHACL-clean against the projection's shapes.
      assert.deepEqual(
        validateShacl(store, parseTurtle(RDF_EXPORT_SHAPES_TTL)),
        [],
      );
      // The competency questions answer over the real package.
      const run = (id: string) =>
        sparqlSelect(
          store,
          RDF_COMPETENCY_QUESTIONS.find(q => q.id === id)!.sparql,
        );
      assert.equal(run('CQ1').length, 157); // 180 requirements: 157 shall,
      // 23 should (22 from the composed CASCO layer packages + R 60's own
      // non-mandatory-info), 0 may/unknown.
      assert.equal(run('CQ3').length, 69); // 85 terms: 69 in clause 3,
      // 16 in annex A (A.1.x, A.2.1) — the filter's negative case.
      assert.equal(run('CQ5').length, 15); // 14 classes + the tests clause
      // CQ4's census: 157 Requirement + 23 Recommendation + 62 ConformanceTest.
      const census = new Map<string, number>();
      for (const r of run('CQ4')) {
        const k = nodeDisplay(r.type);
        census.set(k, (census.get(k) ?? 0) + 1);
      }
      assert.deepEqual(Object.fromEntries([...census].sort()), {
        [`<${SMART('Recommendation')}>`]: 23,
        [`<${SMART('Requirement')}>`]: 157,
        [`<${PRIMMEL}ConformanceTest>`]: 62,
      });
      // The documentation-review test verifies its seven requirements.
      assert.equal(
        run('CQ2').filter(r =>
          nodeDisplay(r.test).includes('conf-examinations-documentation'),
        ).length,
        7,
      );
      // The one should-obligation requirement is a smart:Recommendation.
      const inst = 'urn:oiml:pub:r:60:2021#';
      assert.deepEqual(
        typesOf(store, `${inst}req-technical-non-mandatory-info`),
        [SMART('Recommendation')],
      );
      // No dangling cross-reference targets.
      const subjects = new Set(store.subjects().map(nodeDisplay));
      for (const ref of crossReferences(store)) {
        assert.ok(subjects.has(ref.o), `dangling reference target ${ref.o}`);
      }
    },
  );
});

/** IRI-equality on nodes (test-local convenience). */
function nodeEqualsSafe(n: RdfNode, iri: string): boolean {
  return n.kind === 'iri' && n.iri === iri;
}
