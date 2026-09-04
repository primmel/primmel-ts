// ─────────────────────────────────────────────────────────────────────
// RDF/OWL export (TODO.roadmap/27 — interop projections, surface 2).
//
// A Primmel package → an RDF graph in the IEC-ISO Core Ontology
// vocabulary (the smartSDU information-model share's core-ontology.ttl
// v2.0.0 — every IRI cited in rdf-vocabulary.ts): the package as
// smart:PublicationDocument, requirement classes as the smart:Clause
// tree (nested per their /req/... id paths), requirements as Provision
// subclasses BY MODALITY (the smartSDU form: shall → smart:Requirement,
// should → smart:Recommendation, may → smart:Permission — the modality
// IS the rdf:type subclass; the raw token rides as primmel:obligation
// data for consumers without RDFS subclass reasoning), conformance
// tests as primmel:ConformanceTest (the vocabulary has NO verification-
// provision class — documented extension, declared rdfs:subClassOf
// smart:Provision in the graph), terminology as smart:TermEntry +
// skosxl labels per the share's terminology model, guidance as
// smart:ProvisionSupplement notes, and provenance (source URNs) as
// dcterms:source annotation IRIs in the platform's <doc#clause-X>
// convention. Turtle is canonical; JSON-LD renders the same graph.
//
// ONE-WAY PROJECTION, NEVER THE KERNEL'S TRUTH. The package stays the
// single source of truth; re-imports are new-model suggestions, never
// merges (documented, not built). The same doctrine is stated in the
// exported document's header note (the leading Turtle comment; JSON-LD
// has no comment syntax — the note ships in Turtle + this header only):
//
//   SURVIVES — the document + clause tree (PublicationDocument, Clause
//     nesting by id path), provisions (requirements typed by modality,
//     tests as primmel:ConformanceTest), the modality token, terms with
//     definitions (TermEntry + skosxl:prefLabel/altLabel/deprecatedLabel
//     Term nodes, form/part-of-speech types when authored), provenance
//     (dcterms:source doc#clause IRIs), cross-references
//     (dcterms:requires dependencies, primmel:verifies test targets,
//     dcterms:references bindings/see-also naming exported ids),
//     guidance as ProvisionSupplement notes, the verification method as
//     inert data.
//   LOST — machine-checkable bindings (binds_to subject paths), OCL
//     limit expressions, acceptance criteria, quantities with units,
//     typed parameters, applicability filters, processes, forms,
//     workflows, state machines, tables, formulas, symbols (term
//     symbol links), the publication layout (the share's oa:Annotation
//     → dcat:Distribution content-fragment machinery is NOT projected:
//     statements/labels ride on the nodes as rdf:value / skosxl
//     literals), test-reference fragment detail (only doc+clause of a
//     test's reference survives).
//
// Extension namespace (urn:primmel:vocab:, prefix primmel:) — minted
// because the core vocabulary lacks the concepts, declared in every
// graph's declaration block: primmel:ConformanceTest (class),
// primmel:verifies (subPropertyOf dcterms:references),
// primmel:obligation (modality token), primmel:verificationMethod,
// primmel:vocabRef, primmel:vocabTerm.
//
// Companion modules: rdf-shapes.ts (the projection's SHACL shapes) and
// rdf-competency-questions.ts (the SPARQL acceptance queries) — both
// executed against exported graphs in test/rdf-export.test.ts.
// ─────────────────────────────────────────────────────────────────────

import type Standard from '../types/Standard';
import type { Requirement } from '../types/Requirement';
import type ConformanceTest from '../types/ConformanceTest';
import { loadPackageWithIssues } from '../ser-des/package';
import {
  BINDINGNESS_NORMATIVE,
  DCTERMS_NS,
  PART_OF_SPEECH_TYPE_BY_POS,
  PRIMMEL_CONFORMANCE_TEST,
  PRIMMEL_OBLIGATION,
  PRIMMEL_VERIFICATION_METHOD,
  PRIMMEL_VERIFIES,
  PRIMMEL_VOCAB_REF,
  PRIMMEL_VOCAB_TERM,
  PROVISION_TYPE_GOVERNING,
  PUBLICATION_TYPE_STANDARD,
  RDF_BASE_PREFIXES,
  RDF_NS,
  RDF_PROVISION_CLASS_BY_OBLIGATION,
  RDFS_NS,
  SKOS_NS,
  SKOSXL_NS,
  SMART_CLAUSE,
  SMART_HAS_BINDINGNESS_TYPE,
  SMART_HAS_PART_OF_SPEECH_TYPE,
  SMART_HAS_PROVISION_TYPE,
  SMART_HAS_PUBLICATION_TYPE,
  SMART_HAS_SECTION_NUMBER,
  SMART_HAS_SUPPLEMENT,
  SMART_HAS_SUPPLEMENT_TYPE,
  SMART_HAS_TERM_FORM_TYPE,
  SMART_PERMISSION,
  SMART_PROVISION,
  SMART_PROVISION_SET,
  SMART_PROVISION_SUPPLEMENT,
  SMART_PUBLICATION_DOCUMENT,
  SMART_DEPRECATED_LABEL,
  SMART_RECOMMENDATION,
  SMART_REQUIREMENT,
  SMART_TERM,
  SMART_TERM_ENTRY,
  SUPPLEMENT_TYPE_NOTE,
  TERM_FORM_TYPE_BY_FORM,
  rdfObligationToken,
  rdfProvisionClass,
} from './rdf-vocabulary';

/** The export format: Turtle (canonical) or JSON-LD (same graph). */
export type RdfExportFormat = 'turtle' | 'jsonld';

/** Tallies + honesty bookkeeping for one export run. */
export interface RdfExportStats {
  documents: number;
  /** Requirement classes exported as smart:Clause nodes. */
  requirementClasses: number;
  /** Requirements exported as Provision(-subclass) nodes. */
  requirements: number;
  /** Conformance tests exported as primmel:ConformanceTest nodes. */
  conformanceTests: number;
  /** Terms exported as smart:TermEntry nodes. */
  terms: number;
  /** Guidance notes exported as smart:ProvisionSupplement nodes. */
  supplements: number;
  /** Emitted cross-references (requires / verifies / references). */
  crossReferences: number;
  /** Triples in the exported graph (declaration block included). */
  triples: number;
  /**
   * Dependency / verification / binding / see-also references that name
   * an id with no node in the export (e.g. an id from an un-composed
   * upstream package). Dropped, never emitted as a dangling IRI — one
   * entry per drop, `<owner> -> <ref> (<kind>)`.
   *
   * Bindings are pre-filtered (same discipline as the ReqIF surface):
   * only `binds_to` / `limit.uses` refs in the `/`-addressed id space go
   * through the drop record; subject-chain paths (`sample.x`,
   * `formula:…`, `table:…`) stay silent — they are part of the LOST
   * machine-checkable bindings, not dropped references.
   */
  droppedReferences: string[];
  /**
   * Requirements whose obligation is neither empty nor a canonical
   * shall/should/may spelling. Each exports typed smart:Provision with
   * primmel:obligation "undefined" — never silently promoted, but
   * counted here so authoring typos (`obligation SHALL`) are visible.
   */
  unknownObligations: number;
}

/** The export product: the graph in both syntaxes, plus bookkeeping. */
export interface RdfExport {
  turtle: string;
  jsonld: string;
  stats: RdfExportStats;
}

// ─────────────────────────────────────────────────────────────────────
// The intermediate triple model. Both syntaxes render from this.
// ─────────────────────────────────────────────────────────────────────

export type RdfObject =
  | { kind: 'iri'; iri: string }
  | { kind: 'literal'; value: string; lang?: string; datatype?: string };

export interface RdfTriple {
  subject: string;
  predicate: string;
  object: RdfObject;
}

const iri = (iri_: string): RdfObject => ({ kind: 'iri', iri: iri_ });
const lit = (value: string, lang?: string): RdfObject =>
  lang ? { kind: 'literal', value, lang } : { kind: 'literal', value };

// Shared predicate IRIs (namespaces live in rdf-vocabulary.ts).
const RDF_TYPE = `${RDF_NS}type`;
const RDF_VALUE = `${RDF_NS}value`;
const RDFS_SUBCLASS_OF = `${RDFS_NS}subClassOf`;
const RDFS_SUBPROPERTY_OF = `${RDFS_NS}subPropertyOf`;
const RDFS_LABEL = `${RDFS_NS}label`;
const DCTERMS_TITLE = `${DCTERMS_NS}title`;
const DCTERMS_IDENTIFIER = `${DCTERMS_NS}identifier`;
const DCTERMS_DESCRIPTION = `${DCTERMS_NS}description`;
const DCTERMS_HAS_VERSION = `${DCTERMS_NS}hasVersion`;
const DCTERMS_IS_PART_OF = `${DCTERMS_NS}isPartOf`;
const DCTERMS_SOURCE = `${DCTERMS_NS}source`;
const DCTERMS_REQUIRES = `${DCTERMS_NS}requires`;
const DCTERMS_REFERENCES = `${DCTERMS_NS}references`;
const SKOS_DEFINITION = `${SKOS_NS}definition`;
const SKOS_NOTE = `${SKOS_NS}note`;
const SKOS_SCOPE_NOTE = `${SKOS_NS}scopeNote`;
const SKOSXL_LABEL = `${SKOSXL_NS}Label`;
const SKOSXL_PREF_LABEL = `${SKOSXL_NS}prefLabel`;
const SKOSXL_ALT_LABEL = `${SKOSXL_NS}altLabel`;
const SKOSXL_LITERAL_FORM = `${SKOSXL_NS}literalForm`;

/** The synthetic Clause grouping the conformance tests (27b's synthetic
 *  "Conformance tests" ReqIF heading, one surface over). */
const TESTS_CLAUSE_LOCAL = 'conformance-tests';

/**
 * Slugs a Primmel id into an IRI-safe local-name fragment:
 * `/req/metrological/mpe` → `req-metrological-mpe`. (Same algorithm as
 * the ReqIF surface's slug — kept module-local so the two surfaces
 * evolve independently.)
 */
export function rdfSlug(id: string): string {
  const s = id
    .replace(/^\/+/, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/, '');
  return s === '' ? 'x' : s;
}

/** A language tag safe to emit: the term's authored language when it
 *  looks like a BCP-47 primary tag, else "en". */
function langTag(language: string | undefined): string {
  return language && /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(language)
    ? language
    : 'en';
}

/**
 * The class a requirement belongs to: the longest class id that is a
 * path-prefix of the requirement id (`/req/a/b` holds `/req/a/b/c`).
 * Null = the requirement sits at the document's top level. (The ReqIF
 * surface has the same rule as `requirementClassOf`; duplicated here so
 * the surfaces stay independent.)
 */
export function rdfRequirementClassOf(
  requirementId: string,
  classIds: string[],
): string | null {
  let best: string | null = null;
  for (const c of classIds) {
    if (requirementId.startsWith(c + '/')) {
      if (best === null || c.length > best.length) {
        best = c;
      }
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────
// Projection: Standard → triples.
// ─────────────────────────────────────────────────────────────────────

/** All { doc, clause } fragments a requirement cites (sourceRefs first,
 *  falling back to the back-compat single `source`). */
function requirementSourceRefs(
  r: Requirement,
): { doc: string; clause: string }[] {
  const refs = r.sourceRefs ?? (r.source ? [r.source] : []);
  return refs.map(s => ({ doc: s.doc, clause: s.clause }));
}

/** All { doc, clause } fragments a conformance test cites (sourceRefs
 *  first, falling back to the single `sourceRef`; fragment detail is
 *  dropped — LOST, per the module header). */
function testSourceRefs(t: ConformanceTest): { doc: string; clause: string }[] {
  const refs = t.sourceRefs ?? (t.sourceRef ? [t.sourceRef] : []);
  return refs.map(s => ({ doc: s.doc, clause: s.clause }));
}

/** IRIREF-legality for a composed citation IRI: a scheme, then no
 *  whitespace or IRI-delimiter characters. */
const IRI_SHAPED = /^[A-Za-z][A-Za-z0-9+.-]*:[^\s<>"{}|^`\\]*$/;

/** The dcterms:source object for one { doc, clause } fragment. An
 *  IRI-shaped citation composes the platform's <doc#clause-X> convention
 *  and exports as an IRI. A human-readable citation (the CASCO layers:
 *  `doc "ISO/IEC 17065:2012"` with a clause list) exports as a
 *  natural-language literal — `"<doc>, clause <clause>"` — NEVER the
 *  IRI-mangled `#clause-` composition, which reads like an IRI to a
 *  downstream consumer (task-27c review Minor 2); a bare doc cites the
 *  document itself, as-is. */
function sourceTermFor(doc: string, clause: string): RdfObject {
  const composed = clause ? `${doc}#clause-${clause}` : doc;
  if (IRI_SHAPED.test(composed)) {
    return iri(composed);
  }
  return lit(clause ? `${doc}, clause ${clause}` : doc);
}

/** The dcterms:source object for one already-complete citation string
 *  (a Term.source token): an IRI when IRI-shaped (the URN convention),
 *  else the literal token — human-readable provenance survives as text
 *  (caught by the rdflib cross-check on the R 60 export). */
function sourceTerm(citation: string): RdfObject {
  return IRI_SHAPED.test(citation) ? iri(citation) : lit(citation);
}

/** Projects a loaded Standard into an RDF graph (Turtle + JSON-LD). The
 *  projection is fully deterministic — no options (the ReqIF surface's
 *  `now` has no counterpart: the graph carries no timestamps). */
export function exportStandardRdf(standard: Standard): RdfExport {
  const manifest = standard.packageManifest ?? null;
  const packageId = manifest?.id ?? 'unknown-package';
  const packageTitle = manifest?.title || manifest?.id || 'Primmel package';
  // The document node and every instance IRI derive from baseUrn — a
  // malformed one (the manifest field is a free string; C85 lints it but
  // the export also runs on un-linted packages) would emit spec-malformed
  // IRIREFs silently (task-27c review Important 1). Guard at the door:
  // the same IRI shape C85 checks (scheme present, no whitespace or IRI
  // delimiters) — a one-line content failure, never a malformed document.
  const declaredUrn = manifest?.baseUrn ?? '';
  if (declaredUrn && !IRI_SHAPED.test(declaredUrn)) {
    throw new Error(
      `package "${packageId}": baseUrn "${declaredUrn}" is not a well-formed IRI (a scheme followed by no whitespace or IRI delimiters) — the RDF projection would emit malformed IRIREFs`,
    );
  }
  const baseUrn = declaredUrn || `urn:primmel:package:${packageId}`;
  const instPrefix = `${baseUrn}#`;

  const classes = standard.requirementClasses ?? [];
  const requirements = standard.requirements ?? [];
  const tests = standard.conformanceTests ?? [];
  const terms = standard.terms ?? [];

  const triples: RdfTriple[] = [];
  const t = (subject: string, predicate: string, object: RdfObject): void => {
    triples.push({ subject, predicate, object });
  };

  // ── local names (collision-safe, first-come order) ──
  const localById = new Map<string, string>();
  const usedLocals = new Set<string>([TESTS_CLAUSE_LOCAL]);
  const claimLocal = (id: string, hint: string): string => {
    let candidate = hint;
    for (let n = 2; usedLocals.has(candidate); n++) {
      candidate = `${hint}-${n}`;
    }
    usedLocals.add(candidate);
    localById.set(id, candidate);
    return candidate;
  };
  const nodeIri = (local: string): string => `${instPrefix}${local}`;
  const iriOf = (id: string): string | undefined => {
    const local = localById.get(id);
    return local === undefined ? undefined : nodeIri(local);
  };
  /** Claims a DERIVED local (supplements, labels) — collision-safe like
   *  claimLocal but not registered in the id map (nothing references
   *  derived nodes by Primmel id). */
  const claimDerived = (hint: string): string => {
    let candidate = hint;
    for (let n = 2; usedLocals.has(candidate); n++) {
      candidate = `${hint}-${n}`;
    }
    usedLocals.add(candidate);
    return candidate;
  };

  // ── the declaration block (the share's instance pattern re-states
  //    the subclass triples it relies on — document_sample.ttl:14-16) ──
  const decl = (s: string, p: string, o: string | RdfObject): void =>
    t(s, p, typeof o === 'string' ? iri(o) : o);
  decl(SMART_REQUIREMENT, RDFS_SUBCLASS_OF, SMART_PROVISION);
  decl(SMART_RECOMMENDATION, RDFS_SUBCLASS_OF, SMART_PROVISION);
  decl(SMART_PERMISSION, RDFS_SUBCLASS_OF, SMART_PROVISION);
  decl(SMART_CLAUSE, RDFS_SUBCLASS_OF, SMART_PROVISION_SET);
  decl(PRIMMEL_CONFORMANCE_TEST, RDFS_SUBCLASS_OF, SMART_PROVISION);
  decl(
    PRIMMEL_CONFORMANCE_TEST,
    RDFS_LABEL,
    lit(
      'conformance test — Primmel extension: the IEC-ISO Core Ontology has no verification-provision class (rdf-vocabulary.ts)',
    ),
  );
  decl(PRIMMEL_VERIFIES, RDFS_SUBPROPERTY_OF, DCTERMS_REFERENCES);
  decl(
    PRIMMEL_VERIFIES,
    RDFS_LABEL,
    lit('conformance test → verified requirement (Primmel extension)'),
  );
  decl(
    PRIMMEL_OBLIGATION,
    RDFS_LABEL,
    lit(
      'modality token (shall | should | may | undefined) carried as data — the vocabulary’s own modality form is the rdf:type Provision subclass',
    ),
  );
  decl(
    PRIMMEL_VERIFICATION_METHOD,
    RDFS_LABEL,
    lit('verification method facet as inert data (Primmel extension)'),
  );
  decl(
    PRIMMEL_VOCAB_REF,
    RDFS_LABEL,
    lit(
      'glossarist vocabulary-register citation "<register>#<clause>" (Primmel extension)',
    ),
  );
  decl(
    PRIMMEL_VOCAB_TERM,
    RDFS_LABEL,
    lit(
      'register-preferred designation when it differs from the term (Primmel extension)',
    ),
  );

  // ── the document node ──
  const docIri = baseUrn;
  t(docIri, RDF_TYPE, iri(SMART_PUBLICATION_DOCUMENT));
  t(docIri, DCTERMS_TITLE, lit(packageTitle, 'en'));
  t(docIri, DCTERMS_IDENTIFIER, lit(packageId));
  t(docIri, SMART_HAS_PUBLICATION_TYPE, iri(PUBLICATION_TYPE_STANDARD));
  if (manifest?.description) {
    t(docIri, DCTERMS_DESCRIPTION, lit(manifest.description, 'en'));
  }
  if (manifest?.version) {
    t(docIri, DCTERMS_HAS_VERSION, lit(manifest.version));
  }

  // ── cross-references (deduped; dangling refs dropped, recorded) ──
  const droppedReferences: string[] = [];
  let crossReferences = 0;
  const seenReference = new Set<string>();
  const addReference = (
    owner: string,
    ref: string,
    predicate: string,
    kind: string,
  ): void => {
    const source = iriOf(owner);
    const target = iriOf(ref);
    if (source === undefined || target === undefined) {
      droppedReferences.push(`${owner} -> ${ref} (${kind})`);
      return;
    }
    const key = `${source}|${predicate}|${target}`;
    if (seenReference.has(key)) {
      return;
    }
    seenReference.add(key);
    t(source, predicate, iri(target));
    crossReferences++;
  };

  // ── supplements (guidance → ProvisionSupplement notes) ──
  let supplements = 0;
  const addGuidanceSupplement = (
    ownerIri: string,
    ownerLocal: string,
    guidance: string,
  ): void => {
    if (!guidance) {
      return;
    }
    supplements++;
    const supLocal = claimDerived(`${ownerLocal}-note`); // one guidance string per owner
    const supIri = nodeIri(supLocal);
    t(ownerIri, SMART_HAS_SUPPLEMENT, iri(supIri));
    t(supIri, RDF_TYPE, iri(SMART_PROVISION_SUPPLEMENT));
    t(supIri, SMART_HAS_SUPPLEMENT_TYPE, iri(SUPPLEMENT_TYPE_NOTE));
    t(supIri, RDF_VALUE, lit(guidance, 'en'));
  };

  // ── clauses (requirement classes, nested by id path) ──
  const classIds = classes.map(c => c.id);
  for (const rc of classes) {
    claimLocal(rc.id, rdfSlug(rc.id));
  }
  for (const rc of classes) {
    const local = localById.get(rc.id)!;
    const cIri = nodeIri(local);
    t(cIri, RDF_TYPE, iri(SMART_CLAUSE));
    t(cIri, DCTERMS_IDENTIFIER, lit(rc.id));
    t(cIri, DCTERMS_TITLE, lit(rc.title || rc.name || rc.id, 'en'));
    if (rc.description) {
      t(cIri, DCTERMS_DESCRIPTION, lit(rc.description, 'en'));
    }
    const parent = rdfRequirementClassOf(
      rc.id,
      classIds.filter(c => c !== rc.id),
    );
    t(cIri, DCTERMS_IS_PART_OF, iri(parent !== null ? iriOf(parent)! : docIri));
  }
  // Class dependencies, after every class IRI exists.
  for (const rc of classes) {
    for (const dep of rc.dependencies ?? []) {
      addReference(rc.id, dep, DCTERMS_REQUIRES, 'depends-on');
    }
  }

  // ── provisions (requirements, typed by modality) ──
  let unknownObligations = 0;
  for (const r of requirements) {
    claimLocal(r.id, rdfSlug(r.id));
  }
  for (const r of requirements) {
    const local = localById.get(r.id)!;
    const rIri = nodeIri(local);
    const provisionClass = rdfProvisionClass(r.obligation);
    if (r.obligation && !(r.obligation in RDF_PROVISION_CLASS_BY_OBLIGATION)) {
      // Types smart:Provision + primmel:obligation "undefined" — counted
      // so the typo is visible in stats, never silently promoted.
      unknownObligations++;
    }
    t(rIri, RDF_TYPE, iri(provisionClass));
    t(rIri, DCTERMS_IDENTIFIER, lit(r.id));
    if (r.name) {
      t(rIri, DCTERMS_TITLE, lit(r.name, 'en'));
    }
    t(rIri, RDF_VALUE, lit(r.statement, 'en'));
    t(rIri, PRIMMEL_OBLIGATION, lit(rdfObligationToken(r.obligation)));
    t(rIri, SMART_HAS_BINDINGNESS_TYPE, iri(BINDINGNESS_NORMATIVE));
    if (provisionClass !== SMART_PROVISION) {
      // governing per the provision-type taxonomy (Requirement and its
      // sibling verbal forms "guide actions or results"); left unstated
      // on unknown-obligation provisions rather than guessed.
      t(rIri, SMART_HAS_PROVISION_TYPE, iri(PROVISION_TYPE_GOVERNING));
    }
    const owner = rdfRequirementClassOf(r.id, classIds);
    t(rIri, DCTERMS_IS_PART_OF, iri(owner !== null ? iriOf(owner)! : docIri));
    if (r.verificationMethod) {
      t(rIri, PRIMMEL_VERIFICATION_METHOD, lit(r.verificationMethod));
    }
    const seenSource = new Set<string>();
    for (const s of requirementSourceRefs(r)) {
      const term = sourceTermFor(s.doc, s.clause);
      const key = JSON.stringify(term);
      if (!seenSource.has(key)) {
        seenSource.add(key);
        t(rIri, DCTERMS_SOURCE, term);
      }
    }
    addGuidanceSupplement(rIri, local, r.guidance);
  }
  // Requirement dependencies + bindings, after every provision IRI
  // exists (dependencies point forward as often as back).
  for (const r of requirements) {
    for (const dep of r.dependencies ?? []) {
      addReference(r.id, dep, DCTERMS_REQUIRES, 'depends-on');
    }
    // Bindings: binds_to paths and limit uses that name an exported
    // node become dcterms:references. Unexported `/`-addressed refs are
    // recorded as dropped; subject-chain paths stay silent (LOST).
    const bindings = [...(r.bindsTo ?? []), ...(r.limit?.uses ?? [])];
    for (const b of bindings) {
      if (localById.has(b) || b.startsWith('/')) {
        addReference(r.id, b, DCTERMS_REFERENCES, 'binds');
      }
    }
  }

  // ── verification provisions (conformance tests) ──
  for (const test of tests) {
    claimLocal(test.id, rdfSlug(test.id));
  }
  if (tests.length > 0) {
    const cIri = nodeIri(TESTS_CLAUSE_LOCAL);
    t(cIri, RDF_TYPE, iri(SMART_CLAUSE));
    t(cIri, DCTERMS_IDENTIFIER, lit('primmel:conformance-tests'));
    t(cIri, DCTERMS_TITLE, lit('Conformance tests', 'en'));
    t(cIri, DCTERMS_IS_PART_OF, iri(docIri));
  }
  for (const test of tests) {
    const local = localById.get(test.id)!;
    const tIri = nodeIri(local);
    t(tIri, RDF_TYPE, iri(PRIMMEL_CONFORMANCE_TEST));
    t(tIri, DCTERMS_IDENTIFIER, lit(test.id));
    if (test.name) {
      t(tIri, DCTERMS_TITLE, lit(test.name, 'en'));
    }
    t(
      tIri,
      RDF_VALUE,
      lit(test.purpose || test.method || test.name || test.id, 'en'),
    );
    t(tIri, PRIMMEL_OBLIGATION, lit('undefined'));
    t(tIri, SMART_HAS_BINDINGNESS_TYPE, iri(BINDINGNESS_NORMATIVE));
    t(tIri, DCTERMS_IS_PART_OF, iri(nodeIri(TESTS_CLAUSE_LOCAL)));
    const seenSource = new Set<string>();
    for (const s of testSourceRefs(test)) {
      const term = sourceTermFor(s.doc, s.clause);
      const key = JSON.stringify(term);
      if (!seenSource.has(key)) {
        seenSource.add(key);
        t(tIri, DCTERMS_SOURCE, term);
      }
    }
    addGuidanceSupplement(tIri, local, test.guidance);
  }
  for (const test of tests) {
    for (const target of test.targets ?? []) {
      addReference(test.id, target, PRIMMEL_VERIFIES, 'verifies');
    }
    for (const dep of test.dependencies ?? []) {
      addReference(test.id, dep, DCTERMS_REQUIRES, 'depends-on');
    }
  }

  // ── terminology (TermEntry + skosxl labels, per the share's
  //    terminology-model.shacl.ttl shape style) ──
  for (const term of terms) {
    claimLocal(term.id, `term-${rdfSlug(term.id)}`);
  }
  for (const term of terms) {
    const local = localById.get(term.id)!;
    const eIri = nodeIri(local);
    const lang = langTag(term.language);
    t(eIri, RDF_TYPE, iri(SMART_TERM_ENTRY));
    t(eIri, DCTERMS_IDENTIFIER, lit(term.id));
    t(eIri, DCTERMS_IS_PART_OF, iri(docIri));
    t(eIri, SKOS_DEFINITION, lit(term.definition, lang));
    if (term.scopeNote) {
      t(eIri, SKOS_SCOPE_NOTE, lit(term.scopeNote, lang));
    }
    if (term.note) {
      t(eIri, SKOS_NOTE, lit(term.note, lang));
    }
    if (term.section) {
      t(eIri, SMART_HAS_SECTION_NUMBER, lit(term.section));
    }
    // Provenance: the Term.source string is a space-separated URN list
    // in the platform's <doc#clause-X> convention; non-IRI tokens (rare
    // free-text citations) survive as literals (sourceTerm's rule).
    for (const token of (term.source ?? '').split(/\s+/).filter(x => x)) {
      t(eIri, DCTERMS_SOURCE, sourceTerm(token));
    }
    if (term.vocabRef) {
      t(
        eIri,
        PRIMMEL_VOCAB_REF,
        lit(`${term.vocabRef.register}#${term.vocabRef.clause}`),
      );
    }
    if (term.vocabTerm) {
      t(eIri, PRIMMEL_VOCAB_TERM, lit(term.vocabTerm, lang));
    }
    const labelNode = (
      localHint: string,
      form: string,
      value: string,
    ): string => {
      const lIri = nodeIri(claimDerived(`${local}-${localHint}`));
      t(lIri, RDF_TYPE, iri(SMART_TERM));
      t(lIri, RDF_TYPE, iri(SKOSXL_LABEL));
      t(lIri, SKOSXL_LITERAL_FORM, lit(value, lang));
      const formType = TERM_FORM_TYPE_BY_FORM[form];
      if (formType) {
        t(lIri, SMART_HAS_TERM_FORM_TYPE, iri(formType));
      }
      return lIri;
    };
    const prefIri = labelNode(
      'label',
      term.formType ?? '',
      term.label || term.id,
    );
    if (term.partOfSpeech && PART_OF_SPEECH_TYPE_BY_POS[term.partOfSpeech]) {
      t(
        prefIri,
        SMART_HAS_PART_OF_SPEECH_TYPE,
        iri(PART_OF_SPEECH_TYPE_BY_POS[term.partOfSpeech]),
      );
    }
    t(eIri, SKOSXL_PREF_LABEL, iri(prefIri));
    // The alias family's canonical channel (MN 114 v3.2): the parser
    // folds the v2 `alt` spelling into `aliases`; read both for
    // hand-built Terms.
    (term.aliases ?? term.alt ?? []).forEach((a, i) => {
      const form = (term.abbreviations ?? []).includes(a) ? 'abbreviation' : '';
      t(eIri, SKOSXL_ALT_LABEL, iri(labelNode(`alt-${i + 1}`, form, a)));
    });
    (term.deprecated ?? []).forEach((d, i) => {
      t(
        eIri,
        SMART_DEPRECATED_LABEL,
        iri(labelNode(`deprecated-${i + 1}`, '', d)),
      );
    });
  }
  for (const term of terms) {
    for (const other of term.seeAlso ?? []) {
      addReference(term.id, other, DCTERMS_REFERENCES, 'see-also');
    }
  }

  const stats: RdfExportStats = {
    documents: 1,
    requirementClasses: classes.length,
    requirements: requirements.length,
    conformanceTests: tests.length,
    terms: terms.length,
    supplements,
    crossReferences,
    triples: triples.length,
    droppedReferences,
    unknownObligations,
  };

  const prefixes: [string, string][] = [
    ['inst', instPrefix],
    ...RDF_BASE_PREFIXES,
  ];
  const turtle =
    headerNote(packageId, packageTitle, baseUrn, stats) +
    '\n' +
    renderTurtle(prefixes, triples);
  const jsonld = renderJsonLd(prefixes, triples);
  return { turtle, jsonld, stats };
}

/**
 * Loads the package at `dir` (single directory — the CLI's `check`
 * default; `uses` composition needs a locator and stays a punt) and
 * projects it into an RDF graph.
 */
export function exportPackageRdf(dir: string): RdfExport {
  const { standard } = loadPackageWithIssues(dir);
  return exportStandardRdf(standard);
}

// ─────────────────────────────────────────────────────────────────────
// The header note — the one-way / survive-vs-lost doctrine, shipped IN
// the exported Turtle as its leading comment. (JSON-LD has no comment
// syntax; the note lives here and in the module header.)
// ─────────────────────────────────────────────────────────────────────

function headerNote(
  packageId: string,
  packageTitle: string,
  baseUrn: string,
  stats: RdfExportStats,
): string {
  // Turtle comments run to end-of-line, and PRL quoted strings CAN
  // contain raw newlines — a title with "\n" would otherwise break out
  // of the comment into a non-# line (malformed Turtle). Newlines in
  // interpolated values become spaces.
  const c = (s: string): string => s.replace(/[\r\n]+/g, ' ');
  const n = (count: number, singular: string, plural: string): string =>
    `${count} ${count === 1 ? singular : plural}`;
  const lines = [
    `RDF/OWL export of the Primmel package "${c(packageId)}" (${c(packageTitle)}).`,
    `Generated by \`primmel export rdf\` (primmel-ts, TODO.roadmap/27).`,
    ``,
    `ONE-WAY PROJECTION. The Primmel package remains the single source of`,
    `truth; this graph is a lossy projection for linked-data consumers.`,
    `Re-imports are new-model suggestions, NEVER merges.`,
    ``,
    `Vocabulary: the IEC-ISO Core Ontology for (SMART) standards content`,
    `(smartSDU information-model share, ontologies/core-ontology.ttl,`,
    `version 2.0.0) and its taxonomies; instance IRIs under ${c(baseUrn)}.`,
    ``,
    `SURVIVES the projection:`,
    `  - document + clause tree: the package as smart:PublicationDocument,`,
    `    requirement classes as smart:Clause nested by /req/... id paths`,
    `  - provisions: one node per requirement, typed by modality (shall ->`,
    `    smart:Requirement, should -> smart:Recommendation, may ->`,
    `    smart:Permission — the vocabulary's own modality form), and one`,
    `    primmel:ConformanceTest per conformance test under a synthetic`,
    `    "Conformance tests" clause; the modality token rides as`,
    `    primmel:obligation data on every provision`,
    `  - bindingness (normative) and provision type (governing) facets`,
    `  - terms: smart:TermEntry + skosxl pref/alt/deprecated labels with`,
    `    definitions, form/part-of-speech types when authored`,
    `  - provenance: dcterms:source annotation IRIs (<doc#clause-X>)`,
    `  - cross-references: dcterms:requires (dependencies),`,
    `    primmel:verifies (conformance-test targets), dcterms:references`,
    `    (bindings and term see-also naming exported ids)`,
    `  - guidance as smart:ProvisionSupplement notes; the verification`,
    `    method as inert primmel:verificationMethod data`,
    ``,
    `LOST in the projection (absent from this graph, by design):`,
    `  - machine-checkable bindings (binds_to subject paths)`,
    `  - OCL limit expressions and acceptance criteria`,
    `  - quantities with units, typed parameters, applicability filters`,
    `  - processes, forms, workflows, state machines, tables, formulas,`,
    `    symbols (term symbol links)`,
    `  - the publication layout: the share's oa:Annotation ->`,
    `    dcat:Distribution content-fragment machinery is not projected —`,
    `    statements and labels ride on the nodes (rdf:value, skosxl)`,
    `  - conformance-test reference fragment detail (only doc+clause of a`,
    `    test's reference survives)`,
    ``,
    `Extensions (prefix primmel:, urn:primmel:vocab:): primmel:ConformanceTest`,
    `(the core vocabulary has no verification-provision class), primmel:verifies,`,
    `primmel:obligation, primmel:verificationMethod, primmel:vocabRef,`,
    `primmel:vocabTerm. smart:hasSectionNumber is reused undeclared-in-2.0.0,`,
    `on the share's own precedent (its SHACL shapes + sample use it).`,
    ``,
    `Contents: ${n(stats.documents, 'document', 'documents')}, ${n(stats.requirementClasses, 'requirement class', 'requirement classes')}, ${n(stats.requirements, 'requirement', 'requirements')}, ${n(stats.conformanceTests, 'conformance test', 'conformance tests')}, ${n(stats.terms, 'term', 'terms')}, ${n(stats.supplements, 'supplement', 'supplements')}, ${n(stats.crossReferences, 'cross-reference', 'cross-references')}, ${n(stats.triples, 'triple', 'triples')}, ${n(stats.droppedReferences.length, 'dropped reference', 'dropped references')}${stats.unknownObligations > 0 ? `, ${n(stats.unknownObligations, 'unknown obligation (typed bare smart:Provision)', 'unknown obligations (typed bare smart:Provision)')}` : ''}.`,
  ];
  return lines.map(l => (l ? `# ${l}` : '#')).join('\n');
}

// ─────────────────────────────────────────────────────────────────────
// Turtle rendering (canonical; byte-deterministic).
// ─────────────────────────────────────────────────────────────────────

/** Control characters Turtle "..." literals cannot carry raw. */
// eslint-disable-next-line no-control-regex
const TURTLE_CONTROL_CHARS = /[\u0000-\u0008\u000e-\u001f\u007f]/g;

/** Escapes a string for a Turtle "..." literal. */
export function turtleEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/[\b\f]/g, c => (c === '\b' ? '\\b' : '\\f'))
    .replace(
      TURTLE_CONTROL_CHARS,
      c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
    );
}

/** The prefixed-name form of an IRI against the prefix table, or null
 *  when no namespace matches or the local part is not a legal
 *  prefixed-name local (no accidental illegal prefixed names). */
function prefixedName(
  prefixes: [string, string][],
  iri_: string,
): string | null {
  for (const [prefix, ns] of prefixes) {
    if (iri_.startsWith(ns)) {
      const local = iri_.slice(ns.length);
      if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(local)) {
        return `${prefix}:${local}`;
      }
    }
  }
  return null;
}

/** Turtle term form: prefixed name when possible, else <iri>. */
function compactIri(prefixes: [string, string][], iri_: string): string {
  return prefixedName(prefixes, iri_) ?? `<${iri_}>`;
}

/** JSON-LD @id form: prefixed name when possible, else the raw IRI. */
function compactIriJsonLd(prefixes: [string, string][], iri_: string): string {
  return prefixedName(prefixes, iri_) ?? iri_;
}

function renderObject(prefixes: [string, string][], o: RdfObject): string {
  if (o.kind === 'iri') {
    return compactIri(prefixes, o.iri);
  }
  const base = `"${turtleEscape(o.value)}"`;
  if (o.lang) {
    return `${base}@${o.lang}`;
  }
  if (o.datatype) {
    return `${base}^^${compactIri(prefixes, o.datatype)}`;
  }
  return base;
}

/** Renders the triple model as Turtle: subjects in insertion order,
 *  predicates in insertion order, `a` for rdf:type. */
export function renderTurtle(
  prefixes: [string, string][],
  triples: RdfTriple[],
): string {
  const bySubject = new Map<string, Map<string, RdfObject[]>>();
  for (const tr of triples) {
    let preds = bySubject.get(tr.subject);
    if (!preds) {
      preds = new Map();
      bySubject.set(tr.subject, preds);
    }
    let objs = preds.get(tr.predicate);
    if (!objs) {
      objs = [];
      preds.set(tr.predicate, objs);
    }
    objs.push(tr.object);
  }
  const blocks: string[] = [];
  for (const [subject, preds] of bySubject) {
    const lines: string[] = [];
    for (const [predicate, objs] of preds) {
      const p = predicate === RDF_TYPE ? 'a' : compactIri(prefixes, predicate);
      const rendered = objs.map(o => renderObject(prefixes, o));
      lines.push(`${p} ${rendered.join(',\n        ')}`);
    }
    blocks.push(`${compactIri(prefixes, subject)} ${lines.join(' ;\n    ')} .`);
  }
  const prefixLines = prefixes
    .map(([p, ns]) => `@prefix ${p}: <${ns}> .`)
    .join('\n');
  return `${prefixLines}\n\n${blocks.join('\n\n')}\n`;
}

// ─────────────────────────────────────────────────────────────────────
// JSON-LD rendering (the same graph; @graph nodes in insertion order).
// ─────────────────────────────────────────────────────────────────────

function renderJsonLd(
  prefixes: [string, string][],
  triples: RdfTriple[],
): string {
  const context: Record<string, string> = {};
  for (const [p, ns] of prefixes) {
    context[p] = ns;
  }
  const bySubject = new Map<string, Map<string, RdfObject[]>>();
  for (const tr of triples) {
    let preds = bySubject.get(tr.subject);
    if (!preds) {
      preds = new Map();
      bySubject.set(tr.subject, preds);
    }
    let objs = preds.get(tr.predicate);
    if (!objs) {
      objs = [];
      preds.set(tr.predicate, objs);
    }
    objs.push(tr.object);
  }
  const nodeObject = (
    subject: string,
    preds: Map<string, RdfObject[]>,
  ): Record<string, unknown> => {
    const node: Record<string, unknown> = {
      '@id': compactIriJsonLd(prefixes, subject),
    };
    for (const [predicate, objs] of preds) {
      if (predicate === RDF_TYPE) {
        node['@type'] = objs.map(o =>
          o.kind === 'iri' ? compactIriJsonLd(prefixes, o.iri) : '',
        );
        continue;
      }
      node[compactIriJsonLd(prefixes, predicate)] = objs.map(o => {
        if (o.kind === 'iri') {
          return { '@id': compactIriJsonLd(prefixes, o.iri) };
        }
        const v: Record<string, string> = { '@value': o.value };
        if (o.lang) {
          v['@language'] = o.lang;
        } else if (o.datatype) {
          v['@type'] = compactIriJsonLd(prefixes, o.datatype);
        }
        return v;
      });
    }
    return node;
  };
  const graph = [...bySubject].map(([s, preds]) => nodeObject(s, preds));
  return `${JSON.stringify({ '@context': context, '@graph': graph }, null, 2)}\n`;
}
