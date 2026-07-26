// ─────────────────────────────────────────────────────────────────────
// The projection's SHACL shapes (TODO.roadmap/27, surface 2) — the
// shape constraints every `primmel export rdf` graph satisfies, as one
// Turtle document (RDF_EXPORT_SHAPES_TTL). The style follows the
// smartSDU share's own shapes (information_model/schemas/shacl/
// core-ontology.shacl.ttl + terminology-model.shacl.ttl: isPartOf
// exactly 1, skosxl labels, uniqueLang definitions); the target
// vocabulary is the projection's (rdf-vocabulary.ts), including the
// primmel: extension terms.
//
// The shapes, and what each guarantees:
//   PublicationDocumentShape — the document node carries a title and
//     exactly one identifier (the package id);
//   ClauseShape — every Clause has exactly one identifier + title and
//     sits under exactly one Clause or the PublicationDocument;
//   ClauseTreeAcyclicShape — the Clause tree is acyclic: SHACL Core
//     cannot express transitive closure, so this is a SHACL-SPARQL
//     constraint (a clause that is its own dcterms:isPartOf+ ancestor
//     violates);
//   ProvisionShape — every Provision (requirements AND, via the
//     declared subclass, primmel:ConformanceTest) has exactly one
//     identifier, a statement (rdf:value), exactly one modality token
//     (primmel:obligation, in the enumerated set), and sits under
//     exactly one Clause or the PublicationDocument;
//   TermEntryShape — every TermEntry has exactly one identifier, at
//     least one language-tagged definition (unique per language), and
//     at least one skosxl:prefLabel;
//   TermShape — every Term label node has a literalForm, and its form /
//     part-of-speech types, when present, come from the smartSDU
//     taxonomies.
//
// Validation runs in the tests (test/rdf-export.test.ts): the fixture
// and R 60 exports validate clean; deliberately broken graphs (id
// removed, isPartOf cycle, bad modality token) fail with the expected
// violations. The validator is the repo's own SHACL Core subset
// (test/helpers/rdf-shacl.ts — the shapes below stay inside that
// subset; see the helper's header for the supported components).
// ─────────────────────────────────────────────────────────────────────

/** The projection's SHACL shapes, as one Turtle document. */
export const RDF_EXPORT_SHAPES_TTL = `# ─────────────────────────────────────────────────────────────────────
# SHACL shapes for the primmel RDF/OWL projection (TODO.roadmap/27).
# Companion to src/export/rdf.ts — every exported graph validates clean.
# ─────────────────────────────────────────────────────────────────────
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix skosxl: <http://www.w3.org/2008/05/skos-xl#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix smart: <https://w3id.org/standards/smart/ontologies/core/> .
@prefix term-form-type: <https://w3id.org/standards/smart/taxonomies/term-form-type/> .
@prefix part-of-speech-type: <https://w3id.org/standards/smart/taxonomies/part-of-speech-type/> .
@prefix primmel: <urn:primmel:vocab:> .
@prefix psh: <urn:primmel:shapes:> .

psh:PublicationDocumentShape
    a sh:NodeShape ;
    sh:targetClass smart:PublicationDocument ;
    sh:property [
        sh:path dcterms:title ;
        sh:minCount 1 ;
        sh:datatype rdf:langString ;
        sh:message "the publication document carries a language-tagged title" ;
    ] ;
    sh:property [
        sh:path dcterms:identifier ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:message "the publication document carries exactly one identifier (the package id)" ;
    ] ;
.

psh:ClauseShape
    a sh:NodeShape ;
    sh:targetClass smart:Clause ;
    sh:property [
        sh:path dcterms:identifier ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:message "every clause carries exactly one identifier (its Primmel id)" ;
    ] ;
    sh:property [
        sh:path dcterms:title ;
        sh:minCount 1 ;
        sh:datatype rdf:langString ;
        sh:message "every clause carries a language-tagged title" ;
    ] ;
    sh:property [
        sh:path dcterms:isPartOf ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        sh:or (
            [ sh:class smart:Clause ]
            [ sh:class smart:PublicationDocument ]
        ) ;
        sh:message "every clause sits under exactly one parent clause or the publication document" ;
    ] ;
.

psh:ClauseTreeAcyclicShape
    a sh:NodeShape ;
    sh:targetClass smart:Clause ;
    sh:sparql [
        a sh:SPARQLConstraint ;
        sh:message "the clause tree is acyclic — a clause must not be its own ancestor" ;
        sh:select """
            SELECT $this WHERE { $this dcterms:isPartOf+ $this . }
        """ ;
    ] ;
.

psh:ProvisionShape
    a sh:NodeShape ;
    sh:targetClass smart:Provision ;
    sh:property [
        sh:path dcterms:identifier ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:message "every provision carries exactly one identifier (its Primmel id)" ;
    ] ;
    sh:property [
        sh:path rdf:value ;
        sh:minCount 1 ;
        sh:datatype rdf:langString ;
        sh:message "every provision carries a language-tagged statement" ;
    ] ;
    sh:property [
        sh:path primmel:obligation ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:in ( "shall" "should" "may" "undefined" ) ;
        sh:message "every provision carries exactly one modality token (shall | should | may | undefined)" ;
    ] ;
    sh:property [
        sh:path dcterms:isPartOf ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        sh:or (
            [ sh:class smart:Clause ]
            [ sh:class smart:PublicationDocument ]
        ) ;
        sh:message "every provision sits under exactly one clause or the publication document" ;
    ] ;
.

psh:TermEntryShape
    a sh:NodeShape ;
    sh:targetClass smart:TermEntry ;
    sh:property [
        sh:path dcterms:identifier ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:message "every term entry carries exactly one identifier (its Primmel term id)" ;
    ] ;
    sh:property [
        sh:path skos:definition ;
        sh:minCount 1 ;
        sh:uniqueLang true ;
        sh:datatype rdf:langString ;
        sh:message "every term entry carries at least one language-tagged definition, unique per language" ;
    ] ;
    sh:property [
        sh:path skosxl:prefLabel ;
        sh:minCount 1 ;
        sh:nodeKind sh:IRI ;
        sh:message "every term entry carries at least one preferred label" ;
    ] ;
    sh:property [
        sh:path dcterms:isPartOf ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        sh:class smart:PublicationDocument ;
        sh:message "every term entry sits under the publication document" ;
    ] ;
.

psh:TermShape
    a sh:NodeShape ;
    sh:targetClass smart:Term ;
    sh:property [
        sh:path skosxl:literalForm ;
        sh:minCount 1 ;
        sh:datatype rdf:langString ;
        sh:message "every term label node carries a language-tagged literal form" ;
    ] ;
    sh:property [
        sh:path smart:hasTermFormType ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        sh:in (
            term-form-type:fullForm
            term-form-type:abbreviation
            term-form-type:acronym
            term-form-type:symbol
            term-form-type:variant
        ) ;
        sh:message "a term's form type, when present, comes from the term-form-type taxonomy" ;
    ] ;
    sh:property [
        sh:path smart:hasPartOfSpeechType ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        sh:in (
            part-of-speech-type:noun
            part-of-speech-type:verb
            part-of-speech-type:adjective
            part-of-speech-type:adverb
        ) ;
        sh:message "a term's part-of-speech type, when present, comes from the part-of-speech-type taxonomy" ;
    ] ;
.
`;
