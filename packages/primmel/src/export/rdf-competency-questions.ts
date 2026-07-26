// ─────────────────────────────────────────────────────────────────────
// SPARQL competency questions (TODO.roadmap/27, surface 2) — the
// documented acceptance-query set for the RDF/OWL projection. Each
// question is executed against the projected graph in the tests
// (test/rdf-export.test.ts) by the repo's own SPARQL subset evaluator
// (test/helpers/rdf-sparql.ts — the queries below stay inside that
// subset: PREFIX, SELECT, basic graph patterns, property paths * / + / ^,
// FILTER with STRSTARTS/CONTAINS/REGEX/BOUND and comparisons, ORDER BY).
//
// The set answers the questions a linked-data consumer of a
// Recommendation package actually asks — provisions by modality with
// their clauses, verification coverage, terminology by source clause —
// in the style of the smartSDU share's own competency questions
// (docs/Competency Questions.md; the rdfs:subClassOf* idiom of CQ4 is
// the share's, tests/document_reconstruction_test/cq_query.sparql:17).
// ─────────────────────────────────────────────────────────────────────

/** One competency question: the natural-language ask, the SPARQL, and
 *  what the acceptance check asserts about the result. */
export interface RdfCompetencyQuestion {
  id: string;
  question: string;
  sparql: string;
  /** What the test asserts (the acceptance criterion), in prose. */
  acceptance: string;
}

export const RDF_COMPETENCY_QUESTIONS: RdfCompetencyQuestion[] = [
  {
    id: 'CQ1',
    question:
      'All shall-provisions (smart:Requirement) of the package, with the clause or document that holds them.',
    sparql: `PREFIX smart: <https://w3id.org/standards/smart/ontologies/core/>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?provision ?clause
WHERE {
  ?provision a smart:Requirement ;
             dcterms:isPartOf ?clause .
}
ORDER BY ?provision
`,
    acceptance:
      "One row per shall-obligation requirement; every row's clause is the requirement's owning class (or the document for orphans). Fixture: exactly the shall requirements; R 60: 157 rows (its 180 requirements are 157 shall + 23 should — 22 of the shoulds come from the composed CASCO layer packages).",
  },
  {
    id: 'CQ2',
    question:
      'All provisions verified by each conformance test (the verification coverage map).',
    sparql: `PREFIX primmel: <urn:primmel:vocab:>

SELECT ?test ?provision
WHERE {
  ?test a primmel:ConformanceTest ;
        primmel:verifies ?provision .
}
ORDER BY ?test ?provision
`,
    acceptance:
      'One row per exported conformance-test target; never a dangling provision IRI. Fixture: the alpha-check → alpha pair; R 60: the documentation-review test covers its seven requirements.',
  },
  {
    id: 'CQ3',
    question:
      'All terms defined in clause 3 of the source document (the terminology clause), with their labels.',
    sparql: `PREFIX smart: <https://w3id.org/standards/smart/ontologies/core/>
PREFIX skosxl: <http://www.w3.org/2008/05/skos-xl#>

SELECT ?entry ?section ?label
WHERE {
  ?entry a smart:TermEntry ;
         smart:hasSectionNumber ?section ;
         skosxl:prefLabel ?labelNode .
  ?labelNode skosxl:literalForm ?label .
  FILTER(STRSTARTS(?section, "3"))
}
ORDER BY ?section ?entry
`,
    acceptance:
      'Exactly the terms whose section facet starts with "3", each with its preferred literal form. Fixture: widget (3.1) and frobnication (3.2), not the clause-4 term; R 60: 69 rows (the 16 annex-A terms — A.1.x, A.2.1 — are the negative case).',
  },
  {
    id: 'CQ4',
    question:
      'Every provision in the graph, grouped by its provision (sub)class — the modality census, including the primmel:ConformanceTest extension class.',
    sparql: `PREFIX smart: <https://w3id.org/standards/smart/ontologies/core/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?provision ?type
WHERE {
  ?type rdfs:subClassOf* smart:Provision .
  ?provision a ?type .
}
ORDER BY ?type ?provision
`,
    acceptance:
      'Every requirement and conformance test appears exactly once, under its declared class (Requirement / Recommendation / Permission / ConformanceTest; bare Provision for unknown obligations).',
  },
  {
    id: 'CQ5',
    question:
      'The full clause tree: every clause with its parent (clause or publication document).',
    sparql: `PREFIX smart: <https://w3id.org/standards/smart/ontologies/core/>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?clause ?parent
WHERE {
  ?clause a smart:Clause ;
          dcterms:isPartOf ?parent .
}
ORDER BY ?clause
`,
    acceptance:
      'One row per requirement class plus the synthetic conformance-tests clause; parents nest by /req/... id path, the document at the root. R 60: 15 rows, all parented on the document (flat classes).',
  },
];
