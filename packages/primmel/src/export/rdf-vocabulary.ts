// ─────────────────────────────────────────────────────────────────────
// The RDF vocabulary for the RDF/OWL projection (TODO.roadmap/27,
// interop projections, surface 2): every IRI the exporter mints, with
// its source citation.
//
// Ground truth: the smartSDU information-model share
// (reference-docs/smartsdu-information-model-share-c6362d946900) — the
// IEC-ISO "Core Ontology for representing (SMART) content of standard as
// per the ISO/IEC Directives Part 2", information_model/ontologies/
// core-ontology.ttl, owl:versionInfo "2.0.0" (2024, OWL API 4.5.29
// generated). Citations below name that share's files; the share lives
// outside this repo, so the IRIs are pinned here verbatim.
//
// What the projection uses, per file:
//   ontologies/core-ontology.ttl      — the smart: classes + properties
//   taxonomies/bindingness-type.ttl   — normative | informative
//   taxonomies/provision-type.ttl     — governingProvision | assertionalProvision
//   taxonomies/provision-supplement-type.ttl — note | example | footnote
//   taxonomies/publication-type.ttl   — standard
//   taxonomies/term-form-type.ttl     — fullForm | abbreviation | symbol | …
//   taxonomies/part-of-speech-type.ttl — noun | verb | adjective | adverb
//   schemas/shacl/core-ontology.shacl.ttl + terminology-model.shacl.ttl —
//     the share's own shape style (isPartOf exactly 1, skosxl labels,
//     uniqueLang definitions) — the model our shapes module follows
//   tests/document_reconstruction_test/document_sample.ttl — the share's
//     instance pattern (PublicationDocument + Clause isPartOf tree +
//     Provision nodes carrying hasBindingnessType; rdfs:subClassOf
//     declarations re-stated in the instance graph)
//
// The vocabulary has NO verification-provision class and no
// dependency/verification/obligation-token properties — those are the
// primmel: extension namespace (urn:primmel:vocab:), documented in
// rdf.ts's module header.
// ─────────────────────────────────────────────────────────────────────

/** The IEC-ISO Core Ontology namespace (smartSDU core-ontology.ttl, @prefix smart:). */
export const SMART_NS = 'https://w3id.org/standards/smart/ontologies/core/';

/** The smartSDU taxonomy namespaces (taxonomies/*.ttl, each a skos:ConceptScheme). */
export const BINDINGNESS_TYPE_NS =
  'https://w3id.org/standards/smart/taxonomies/bindingness-type/';
export const PROVISION_TYPE_NS =
  'https://w3id.org/standards/smart/taxonomies/provision-type/';
export const PROVISION_SUPPLEMENT_TYPE_NS =
  'https://w3id.org/standards/smart/taxonomies/provision-supplement-type/';
export const PUBLICATION_TYPE_NS =
  'https://w3id.org/standards/smart/taxonomies/publication-type/';
export const TERM_FORM_TYPE_NS =
  'https://w3id.org/standards/smart/taxonomies/term-form-type/';
export const PART_OF_SPEECH_TYPE_NS =
  'https://w3id.org/standards/smart/taxonomies/part-of-speech-type/';

/** W3C + Dublin Core namespaces the projection draws on. */
export const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
export const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';
export const DCTERMS_NS = 'http://purl.org/dc/terms/';
export const SKOS_NS = 'http://www.w3.org/2004/02/skos/core#';
export const SKOSXL_NS = 'http://www.w3.org/2008/05/skos-xl#';
export const SHACL_NS = 'http://www.w3.org/ns/shacl#';

/**
 * The Primmel extension namespace — everything the core vocabulary does
 * not have. A URN namespace: minted by this toolchain, no HTTP claim,
 * never dereferenced. (The ReqIF surface's primmel.* extension
 * attributes are the same doctrine, one surface over.)
 */
export const PRIMMEL_NS = 'urn:primmel:vocab:';

/** The SHACL shapes namespace for the projection's own shapes document. */
export const PRIMMEL_SHAPES_NS = 'urn:primmel:shapes:';

// ─────────────────────────────────────────────────────────────────────
// smart: classes (core-ontology.ttl §Classes)
// ─────────────────────────────────────────────────────────────────────

/** "Draft or Publication from standardization orgnization." (core-ontology.ttl:437) */
export const SMART_PUBLICATION_DOCUMENT = `${SMART_NS}PublicationDocument`;
/** "Collection of provisions … identified and addressed as such" (core-ontology.ttl:395) */
export const SMART_PROVISION_SET = `${SMART_NS}ProvisionSet`;
/** "Clauses and subclauses … the basic components in the subdivision of the content of a document." (core-ontology.ttl:301) */
export const SMART_CLAUSE = `${SMART_NS}Clause`;
/** "Expression in the content of a normative document that takes the form of a statement, an instruction, a recommendation or a requirement" (core-ontology.ttl:383) */
export const SMART_PROVISION = `${SMART_NS}Provision`;
/** "…objectively verifiable criteria … from which no deviation is permitted" — verbal form SHALL (core-ontology.ttl:475) */
export const SMART_REQUIREMENT = `${SMART_NS}Requirement`;
/** "…a suggested possible choice or course of action deemed to be particularly suitable" — verbal form SHOULD (core-ontology.ttl:461) */
export const SMART_RECOMMENDATION = `${SMART_NS}Recommendation`;
/** "…consent or liberty (or opportunity) to do something" — verbal form MAY (core-ontology.ttl:357) */
export const SMART_PERMISSION = `${SMART_NS}Permission`;
/** "An entity that supplies a provision with extended, supportive information" (core-ontology.ttl:405) */
export const SMART_PROVISION_SUPPLEMENT = `${SMART_NS}ProvisionSupplement`;
/** "The term entry element … all the elements … that describe a concept and all the terms that denote that concept" (core-ontology.ttl:507) */
export const SMART_TERM_ENTRY = `${SMART_NS}TermEntry`;
/** "Denotation of a concept in a specific language." (core-ontology.ttl:498) */
export const SMART_TERM = `${SMART_NS}Term`;

// ─────────────────────────────────────────────────────────────────────
// smart: properties (core-ontology.ttl §Object Properties)
// ─────────────────────────────────────────────────────────────────────

/** "Define the Bindingness Type of a Provision, or of a ProvisionSet (Clause), or a Term Entry" (core-ontology.ttl:148) */
export const SMART_HAS_BINDINGNESS_TYPE = `${SMART_NS}hasBindingnessType`;
/** "Associating a Provision with categories such as governing or assertional" (core-ontology.ttl:172) */
export const SMART_HAS_PROVISION_TYPE = `${SMART_NS}hasProvisionType`;
/** "has supplement" (core-ontology.ttl:201) */
export const SMART_HAS_SUPPLEMENT = `${SMART_NS}hasSupplement`;
/** "Relates a Provision Supplement with its category." (core-ontology.ttl:210) */
export const SMART_HAS_SUPPLEMENT_TYPE = `${SMART_NS}hasSupplementType`;
/** "has publication type" (core-ontology.ttl:193) */
export const SMART_HAS_PUBLICATION_TYPE = `${SMART_NS}hasPublicationType`;
/** "has term form type" (core-ontology.ttl:219) */
export const SMART_HAS_TERM_FORM_TYPE = `${SMART_NS}hasTermFormType`;
/** "has part of speech type" (core-ontology.ttl:165) */
export const SMART_HAS_PART_OF_SPEECH_TYPE = `${SMART_NS}hasPartOfSpeechType`;
/** "deprecated label" (core-ontology.ttl:142) */
export const SMART_DEPRECATED_LABEL = `${SMART_NS}deprecatedLabel`;
/**
 * The clause/section number. NOT declared in core-ontology.ttl v2.0.0 —
 * the share uses it regardless: its own SHACL shapes
 * (schemas/shacl/core-ontology.shacl.ttl:62), its instance sample
 * (document_sample.ttl:249), and its competency questions all reference
 * smart:hasSectionNumber. Reused here on the share's precedent (and
 * noted in the task report).
 */
export const SMART_HAS_SECTION_NUMBER = `${SMART_NS}hasSectionNumber`;

// ─────────────────────────────────────────────────────────────────────
// Taxonomy concepts (taxonomies/*.ttl)
// ─────────────────────────────────────────────────────────────────────

/** bindingness-type:normative — "A normative bindingness type" (bindingness-type.ttl:36) */
export const BINDINGNESS_NORMATIVE = `${BINDINGNESS_TYPE_NS}normative`;
/** provision-type:governingProvision — "conveys information that guides actions or results" (provision-type.ttl:30) */
export const PROVISION_TYPE_GOVERNING = `${PROVISION_TYPE_NS}governingProvision`;
/** provision-supplement-type:note — "Notes are used for giving additional information intended to assist the understanding or use of the text" (provision-supplement-type.ttl:46) */
export const SUPPLEMENT_TYPE_NOTE = `${PROVISION_SUPPLEMENT_TYPE_NS}note`;
/** publication-type:standard — "Document, established by consensus and approved by a recognized body …" (publication-type.ttl:91) */
export const PUBLICATION_TYPE_STANDARD = `${PUBLICATION_TYPE_NS}standard`;

/** term-form-type concepts for the Primmel form_type facet (fullForm | abbreviation | symbol — types/Term.ts). */
export const TERM_FORM_TYPE_BY_FORM: Record<string, string> = {
  fullForm: `${TERM_FORM_TYPE_NS}fullForm`,
  abbreviation: `${TERM_FORM_TYPE_NS}abbreviation`,
  acronym: `${TERM_FORM_TYPE_NS}acronym`,
  symbol: `${TERM_FORM_TYPE_NS}symbol`,
  variant: `${TERM_FORM_TYPE_NS}variant`,
};

/** part-of-speech-type concepts for the Primmel part_of_speech facet (noun | verb | adjective | … — types/Term.ts). */
export const PART_OF_SPEECH_TYPE_BY_POS: Record<string, string> = {
  noun: `${PART_OF_SPEECH_TYPE_NS}noun`,
  verb: `${PART_OF_SPEECH_TYPE_NS}verb`,
  adjective: `${PART_OF_SPEECH_TYPE_NS}adjective`,
  adverb: `${PART_OF_SPEECH_TYPE_NS}adverb`,
};

// ─────────────────────────────────────────────────────────────────────
// primmel: extension terms (urn:primmel:vocab:) — minted here, declared
// in every exported graph's declaration block.
// ─────────────────────────────────────────────────────────────────────

/**
 * The verification-provision class: a conformance test. The core
 * vocabulary has none (checked: core-ontology.ttl's class list is
 * Activity/Agent/BindingnessType/Capability/Clause/Entity/
 * ExternalConstraint/Instruction/Organization/PartOfSpeechType/
 * Permission/Possibility/Provision/ProvisionSet/ProvisionSupplement/
 * ProvisionSupplementType/ProvisionType/PublicationComponentType/
 * PublicationDocument/PublicationDocumentType/Recommendation/
 * Requirement/Statement/Term/TermEntry/TermFormType — nothing
 * verification-shaped). Declared rdfs:subClassOf smart:Provision in the
 * graph, so RDFS-aware consumers see tests as provisions.
 */
export const PRIMMEL_CONFORMANCE_TEST = `${PRIMMEL_NS}ConformanceTest`;
/** test → requirement verification link (declared rdfs:subPropertyOf dcterms:references). */
export const PRIMMEL_VERIFIES = `${PRIMMEL_NS}verifies`;
/**
 * The modality token (shall | should | may | undefined) every projected
 * provision carries as data — the vocabulary's own modality form is the
 * rdf:type subclass (smart:Requirement/Recommendation/Permission); this
 * property is the convenience for consumers without RDFS subclass
 * reasoning, and the shape the SHACL "every provision has a modality"
 * constraint checks.
 */
export const PRIMMEL_OBLIGATION = `${PRIMMEL_NS}obligation`;
/** The requirement's verification method facet (definitional | testing | examination | documentation) as inert data. */
export const PRIMMEL_VERIFICATION_METHOD = `${PRIMMEL_NS}verificationMethod`;
/** A term's glossarist vocabulary-register citation as "<register>#<clause>" (vocab_ref facet — the register→URN mapping is platform knowledge, never minted here). */
export const PRIMMEL_VOCAB_REF = `${PRIMMEL_NS}vocabRef`;
/** The register's preferred designation when it differs from the term's own (vocab_term facet). */
export const PRIMMEL_VOCAB_TERM = `${PRIMMEL_NS}vocabTerm`;

// ─────────────────────────────────────────────────────────────────────
// The modality mapping (the smartSDU form): obligation → Provision
// subclass. Exact: shall → smart:Requirement, should →
// smart:Recommendation, may → smart:Permission. The empty obligation is
// the Primmel default (shall). Anything else maps to the bare
// smart:Provision — visible, never silently promoted.
// ─────────────────────────────────────────────────────────────────────

export const RDF_PROVISION_CLASS_BY_OBLIGATION: Record<string, string> = {
  shall: SMART_REQUIREMENT,
  should: SMART_RECOMMENDATION,
  may: SMART_PERMISSION,
};

/** Maps a Primmel obligation facet to the smart: Provision subclass IRI. */
export function rdfProvisionClass(obligation: string): string {
  if (!obligation) {
    return SMART_REQUIREMENT; // shall is the Primmel default
  }
  return RDF_PROVISION_CLASS_BY_OBLIGATION[obligation] ?? SMART_PROVISION;
}

/** The obligation TOKEN minted as primmel:obligation data (mirrors the class). */
export function rdfObligationToken(obligation: string): string {
  if (!obligation) {
    return 'shall';
  }
  return obligation in RDF_PROVISION_CLASS_BY_OBLIGATION
    ? obligation
    : 'undefined';
}

// ─────────────────────────────────────────────────────────────────────
// The prefix table (Turtle + JSON-LD share it). Fixed order — the
// exported documents are byte-deterministic.
// ─────────────────────────────────────────────────────────────────────

/**
 * Namespace prefixes, longest-namespace-first so IRI compaction is
 * unambiguous. `inst` is per-package (baseUrn#) and prepended by the
 * exporter.
 */
export const RDF_BASE_PREFIXES: [string, string][] = [
  ['smart', SMART_NS],
  ['bindingness-type', BINDINGNESS_TYPE_NS],
  ['provision-type', PROVISION_TYPE_NS],
  ['provision-supplement-type', PROVISION_SUPPLEMENT_TYPE_NS],
  ['publication-type', PUBLICATION_TYPE_NS],
  ['term-form-type', TERM_FORM_TYPE_NS],
  ['part-of-speech-type', PART_OF_SPEECH_TYPE_NS],
  ['dcterms', DCTERMS_NS],
  ['rdf', RDF_NS],
  ['rdfs', RDFS_NS],
  ['xsd', XSD_NS],
  ['skos', SKOS_NS],
  ['skosxl', SKOSXL_NS],
  ['primmel', PRIMMEL_NS],
];
