// ─────────────────────────────────────────────────────────────────────
// ReqIF export (TODO.roadmap/27 — interop projections, surface 1).
//
// A Primmel package → ReqIF XML for RM-tool ecosystems, following the
// DIN DKE SPEC 99200 profile (ReqIF interpretation for public standards,
// Release 1.3) where compatible: one document spec-object for the
// package, heading spec-objects for the requirement classes (nested per
// their /req/... id paths), provision spec-objects for the requirements
// and the conformance tests, and a single SPEC-RELATION-TYPE
// "cross-reference" (the only relation type the profile defines) for the
// projected cross-references. ReqIF version: 1.0.1, the 20110401
// namespace the profile's examples use.
//
// ONE-WAY PROJECTION, NEVER THE KERNEL'S TRUTH. The package stays the
// single source of truth; re-imports are new-model suggestions, never
// merges (documented, not built). The same doctrine is stated in the
// exported document's header note (the XML comment after the prolog):
//
//   SURVIVES — provisions (requirements, classes as headings, tests),
//     the class/requirement hierarchy, modality (shall → requirement,
//     should → recommendation, may → permission), clause provenance
//     (doc + clause), and cross-references (dependencies, conformance-
//     test targets, bindings that name an exported spec-object);
//     guidance and the verification method survive as inert text.
//   LOST — machine-checkable bindings (binds_to subject paths), OCL
//     limit expressions, acceptance criteria, quantities with units,
//     typed parameters, applicability filters, processes, forms,
//     workflows — ABSENT from the export, by design.
//
// Deviations from the profile (all stated in the header note):
//   - primmel.* extension attributes (primmel.guidance,
//     primmel.verification-method) and the primmel.object-kind enum
//     (requirement | conformance-test) — the profile has no test object
//     kind, and tests are what `targets` cross-references hang on;
//   - a synthetic "Conformance tests" heading grouping the tests;
//   - the modality enum carries only the values this export mints
//     (requirement, recommendation, permission, undefined) — the
//     profile's wider value set (capability, constraint, …) has no
//     Primmel counterpart;
//   - string datatypes for joined clause citations are widened to
//     1024 chars (the profile's 64 fits single citations only);
//   - spec-relations carry the projection kind in LONG-NAME
//     (depends-on | verifies | binds) since the profile's single
//     cross-reference type cannot distinguish them;
//   - requirements outside any class sit as top-level siblings of the
//     document node (the profile nests every provision under a heading
//     — XSD-legal either way);
//   - leaf SPEC-HIERARCHY nodes emit an explicit empty <CHILDREN/>
//     (the profile omits the element — XSD-optional either way).
// ─────────────────────────────────────────────────────────────────────

import type Standard from '../types/Standard';
import type { Requirement, RequirementClass } from '../types/Requirement';
import type ConformanceTest from '../types/ConformanceTest';
import { loadPackageWithIssues } from '../ser-des/package';

/** The ReqIF namespace (1.0.1) the DIN DKE SPEC 99200 examples target. */
export const REQIF_NAMESPACE =
  'http://www.omg.org/spec/ReqIF/20110401/reqif.xsd';
/** The REQ-IF-VERSION header value for that namespace. */
export const REQIF_VERSION = '1.0';

/**
 * The modality mapping (exact): shall → requirement, should →
 * recommendation, may → permission. The empty obligation is the Primmel
 * default (shall). Anything else maps to the profile's `undefined`
 * value — visible in the RM tool, never silently promoted.
 */
export const REQIF_MODALITY_BY_OBLIGATION: Record<string, string> = {
  shall: 'requirement',
  should: 'recommendation',
  may: 'permission',
};

/** Maps a Primmel obligation facet to the ReqIF modality enum value. */
export function reqifModality(obligation: string): string {
  if (!obligation) {
    return 'requirement'; // shall is the Primmel default
  }
  return REQIF_MODALITY_BY_OBLIGATION[obligation] ?? 'undefined';
}

/** Options controlling the export. */
export interface ReqifExportOptions {
  /**
   * Fixed timestamp for CREATION-TIME / LAST-CHANGE (ISO 8601, emitted
   * verbatim). Defaults to the current time; tests pin it for
   * deterministic output.
   */
  now?: string;
}

/** Tallies + honesty bookkeeping for one export run. */
export interface ReqifExportStats {
  documents: number;
  /** Requirement classes exported as heading spec-objects. */
  requirementClasses: number;
  /** Requirements exported as provision spec-objects. */
  requirements: number;
  /** Conformance tests exported as provision spec-objects. */
  conformanceTests: number;
  specRelations: number;
  /**
   * Dependency / binding / target references that name an id with no
   * spec-object in the export (e.g. an id from an un-composed upstream
   * package). Dropped, never emitted as a dangling SPEC-OBJECT-REF —
   * one entry per drop, `<owner> -> <ref> (<kind>)`.
   *
   * Bindings are pre-filtered: only `binds_to` / `limit.uses` refs in
   * the `/`-addressed id space (refs meant to name a model element,
   * e.g. `/req/...`) are recorded when unexported. Subject-chain paths
   * (`sample.test_context.d_min`, `formula:…`, `table:…`) stay silent —
   * they are part of the LOST machine-checkable bindings, not dropped
   * references.
   */
  droppedReferences: string[];
  /**
   * Requirements whose obligation is neither empty nor a canonical
   * shall/should/may spelling (the parser passes any token through and
   * no lint rule constrains the vocabulary). Each exports with modality
   * `undefined` — never silently promoted, but counted here so authoring
   * typos (`obligation SHALL`) are visible.
   */
  unknownObligations: number;
}

/** The export product: the ReqIF document plus its bookkeeping. */
export interface ReqifExport {
  xml: string;
  stats: ReqifExportStats;
}

// ─────────────────────────────────────────────────────────────────────
// Fixed identifiers (datatypes, spec-types, attribute definitions).
// LONG-NAMEs of profile-compatible attributes match the profile
// verbatim; primmel.* names mark the extensions.
// ─────────────────────────────────────────────────────────────────────

const DT_STRING_16384 = 'primmel-dds-string-16384';
const DT_STRING_1024 = 'primmel-dds-string-1024';
const DT_STRING_64 = 'primmel-dds-string-64';
const DT_XHTML = 'primmel-ddx-xhtml';
const DT_MODALITY = 'primmel-dde-modality';
const DT_NORMATIVITY = 'primmel-dde-normativity';
const DT_OBJECT_KIND = 'primmel-dde-object-kind';

const EV_MODALITY = (v: string) => `primmel-ev-modality-${v}`;
const EV_NORMATIVITY = (v: string) => `primmel-ev-normativity-${v}`;
const EV_OBJECT_KIND = (v: string) => `primmel-ev-object-kind-${v}`;

const SOT_DOCUMENT = 'primmel-sot-document';
const SOT_HEADING = 'primmel-sot-heading';
const SOT_PROVISION = 'primmel-sot-provision';
const SRT_CROSS_REFERENCE = 'primmel-srt-cross-reference';
const ST_SPECIFICATION = 'primmel-st-specification-standard';

/** Attribute-definition refs, per owning spec-object type. */
const AD = {
  document: {
    text: 'primmel-adx-document-reqif.text',
    docIdentifier: 'primmel-ads-document-bib.di.document-identifier',
    unique: 'primmel-ads-document-ids.unique',
  },
  heading: {
    chapterName: 'primmel-adx-heading-reqif.chaptername',
    unique: 'primmel-ads-heading-ids.unique',
  },
  provision: {
    text: 'primmel-adx-provision-reqif.text',
    modality: 'primmel-ade-provision-obj.modality',
    normativity: 'primmel-ade-provision-obj.normativity',
    objectKind: 'primmel-ade-provision-primmel.object-kind',
    clauseNumber: 'primmel-ads-provision-obj.clause-number',
    docIdentifier: 'primmel-ads-provision-bib.di.document-identifier',
    unique: 'primmel-ads-provision-ids.unique',
    guidance: 'primmel-ads-provision-primmel.guidance',
    verificationMethod: 'primmel-ads-provision-primmel.verification-method',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────
// The intermediate model — spec-objects, relations, and the hierarchy
// tree, rendered to ReqIF XML in one deterministic pass.
// ─────────────────────────────────────────────────────────────────────

type AttrValue =
  | { kind: 'xhtml'; ref: string; text: string }
  | { kind: 'string'; ref: string; value: string }
  | { kind: 'enum'; ref: string; values: string[] };

interface SpecObject {
  identifier: string;
  longName: string;
  typeRef: string;
  values: AttrValue[];
}

interface SpecRelation {
  identifier: string;
  /** The projection kind: depends-on | verifies | binds. */
  kind: string;
  source: string;
  target: string;
}

interface HierarchyNode {
  objectIdentifier: string;
  children: HierarchyNode[];
}

/** Escapes the five predefined XML entities (text and attribute safe). */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Slugs a Primmel id into an XML-attribute-safe identifier fragment:
 * `/req/metrological/mpe` → `req-metrological-mpe`.
 */
function slug(id: string): string {
  const s = id
    .replace(/^\/+/, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/, '');
  return s === '' ? 'x' : s;
}

/** The class a requirement belongs to: the longest class id that is a
 *  path-prefix of the requirement id (`/req/a/b` holds `/req/a/b/c`).
 *  Null = the requirement sits at the document's top level. */
export function requirementClassOf(
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
// Projection: Standard → the intermediate model.
// ─────────────────────────────────────────────────────────────────────

/** Joins citation facets (clause, doc) into one "; "-separated value,
 *  deduped in first-citation order — repeated source blocks citing the
 *  same clause fragment collapse to one mention. */
function joinCitation(values: (string | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out.join('; ');
}

/** All { doc, clause } fragments a requirement cites (sourceRefs first,
 *  falling back to the back-compat single `source`). */
function requirementSourceRefs(
  r: Requirement,
): { doc: string; clause: string }[] {
  const refs = r.sourceRefs ?? (r.source ? [r.source] : []);
  return refs.map(s => ({ doc: s.doc, clause: s.clause }));
}

function requirementSpecObject(r: Requirement, identifier: string): SpecObject {
  const values: AttrValue[] = [
    { kind: 'xhtml', ref: AD.provision.text, text: r.statement },
    {
      kind: 'enum',
      ref: AD.provision.modality,
      values: [EV_MODALITY(reqifModality(r.obligation))],
    },
    {
      kind: 'enum',
      ref: AD.provision.normativity,
      values: [EV_NORMATIVITY('normative')],
    },
    {
      kind: 'enum',
      ref: AD.provision.objectKind,
      values: [EV_OBJECT_KIND('requirement')],
    },
  ];
  const refs = requirementSourceRefs(r);
  const clause = joinCitation(refs.map(s => s.clause));
  if (clause) {
    values.push({
      kind: 'string',
      ref: AD.provision.clauseNumber,
      value: clause,
    });
  }
  const doc = joinCitation(refs.map(s => s.doc));
  if (doc) {
    values.push({
      kind: 'string',
      ref: AD.provision.docIdentifier,
      value: doc,
    });
  }
  values.push({ kind: 'string', ref: AD.provision.unique, value: r.id });
  if (r.guidance) {
    values.push({
      kind: 'string',
      ref: AD.provision.guidance,
      value: r.guidance,
    });
  }
  if (r.verificationMethod) {
    values.push({
      kind: 'string',
      ref: AD.provision.verificationMethod,
      value: r.verificationMethod,
    });
  }
  return {
    identifier,
    longName: r.name || r.id,
    typeRef: SOT_PROVISION,
    values,
  };
}

function testSpecObject(t: ConformanceTest, identifier: string): SpecObject {
  return {
    identifier,
    longName: t.name || t.id,
    typeRef: SOT_PROVISION,
    values: [
      {
        kind: 'xhtml',
        ref: AD.provision.text,
        text: t.purpose || t.method || '',
      },
      {
        kind: 'enum',
        ref: AD.provision.modality,
        values: [EV_MODALITY('undefined')],
      },
      {
        kind: 'enum',
        ref: AD.provision.normativity,
        values: [EV_NORMATIVITY('normative')],
      },
      {
        kind: 'enum',
        ref: AD.provision.objectKind,
        values: [EV_OBJECT_KIND('conformance-test')],
      },
      { kind: 'string', ref: AD.provision.unique, value: t.id },
    ],
  };
}

function headingSpecObject(
  rc: RequirementClass,
  identifier: string,
): SpecObject {
  const title = rc.title || rc.name || rc.id;
  return {
    identifier,
    longName: title,
    typeRef: SOT_HEADING,
    values: [
      { kind: 'xhtml', ref: AD.heading.chapterName, text: title },
      { kind: 'string', ref: AD.heading.unique, value: rc.id },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────
// Rendering.
// ─────────────────────────────────────────────────────────────────────

function renderAttrValue(v: AttrValue, ind: string): string {
  if (v.kind === 'xhtml') {
    return (
      `${ind}<ATTRIBUTE-VALUE-XHTML>\n` +
      `${ind}\t<THE-VALUE><xhtml:div><xhtml:p>${escapeXml(v.text)}</xhtml:p></xhtml:div></THE-VALUE>\n` +
      `${ind}\t<DEFINITION><ATTRIBUTE-DEFINITION-XHTML-REF>${v.ref}</ATTRIBUTE-DEFINITION-XHTML-REF></DEFINITION>\n` +
      `${ind}</ATTRIBUTE-VALUE-XHTML>`
    );
  }
  if (v.kind === 'string') {
    return (
      `${ind}<ATTRIBUTE-VALUE-STRING THE-VALUE="${escapeXml(v.value)}">\n` +
      `${ind}\t<DEFINITION><ATTRIBUTE-DEFINITION-STRING-REF>${v.ref}</ATTRIBUTE-DEFINITION-STRING-REF></DEFINITION>\n` +
      `${ind}</ATTRIBUTE-VALUE-STRING>`
    );
  }
  return (
    `${ind}<ATTRIBUTE-VALUE-ENUMERATION>\n` +
    `${ind}\t<VALUES>${v.values.map(e => `<ENUM-VALUE-REF>${e}</ENUM-VALUE-REF>`).join('')}</VALUES>\n` +
    `${ind}\t<DEFINITION><ATTRIBUTE-DEFINITION-ENUMERATION-REF>${v.ref}</ATTRIBUTE-DEFINITION-ENUMERATION-REF></DEFINITION>\n` +
    `${ind}</ATTRIBUTE-VALUE-ENUMERATION>`
  );
}

function renderSpecObject(o: SpecObject, now: string): string {
  return (
    `\t\t\t\t<SPEC-OBJECT IDENTIFIER="${o.identifier}" LAST-CHANGE="${now}" LONG-NAME="${escapeXml(o.longName)}">\n` +
    `\t\t\t\t\t<VALUES>\n` +
    o.values.map(v => renderAttrValue(v, '\t\t\t\t\t\t')).join('\n') +
    `\n\t\t\t\t\t</VALUES>\n` +
    `\t\t\t\t\t<TYPE><SPEC-OBJECT-TYPE-REF>${o.typeRef}</SPEC-OBJECT-TYPE-REF></TYPE>\n` +
    `\t\t\t\t</SPEC-OBJECT>`
  );
}

function renderRelation(r: SpecRelation, now: string): string {
  return (
    `\t\t\t\t<SPEC-RELATION IDENTIFIER="${r.identifier}" LAST-CHANGE="${now}" LONG-NAME="${r.kind}">\n` +
    `\t\t\t\t\t<TARGET><SPEC-OBJECT-REF>${r.target}</SPEC-OBJECT-REF></TARGET>\n` +
    `\t\t\t\t\t<SOURCE><SPEC-OBJECT-REF>${r.source}</SPEC-OBJECT-REF></SOURCE>\n` +
    `\t\t\t\t\t<TYPE><SPEC-RELATION-TYPE-REF>${SRT_CROSS_REFERENCE}</SPEC-RELATION-TYPE-REF></TYPE>\n` +
    `\t\t\t\t</SPEC-RELATION>`
  );
}

function renderHierarchy(
  node: HierarchyNode,
  identifier: string,
  now: string,
  ind: string,
): string {
  const children =
    node.children.length === 0
      ? `${ind}\t<CHILDREN/>\n`
      : `${ind}\t<CHILDREN>\n` +
        node.children
          .map((c, i) =>
            renderHierarchy(c, `${identifier}-${i + 1}`, now, ind + '\t\t'),
          )
          .join('\n') +
        `\n${ind}\t</CHILDREN>\n`;
  return (
    `${ind}<SPEC-HIERARCHY IDENTIFIER="${identifier}" LAST-CHANGE="${now}">\n` +
    `${ind}\t<OBJECT><SPEC-OBJECT-REF>${node.objectIdentifier}</SPEC-OBJECT-REF></OBJECT>\n` +
    children +
    `${ind}</SPEC-HIERARCHY>`
  );
}

// ─────────────────────────────────────────────────────────────────────
// The header note — the one-way / survive-vs-lost doctrine, shipped IN
// the exported document as its leading XML comment.
// ─────────────────────────────────────────────────────────────────────

/**
 * Sanitizes a value interpolated into the header note's XML comment:
 * XML comments may not contain `--` (a package titled `R 99 -- the
 * dashy package` would otherwise export malformed XML). `--` runs
 * become an em dash — the punctuation the run stands for in prose.
 */
export function xmlCommentSafe(s: string): string {
  return s.replace(/--+/g, '—');
}

function headerNote(
  packageId: string,
  packageTitle: string,
  stats: ReqifExportStats,
): string {
  // XML comments may not contain "--"; keep to single hyphens in the
  // static text and run interpolated values through xmlCommentSafe.
  const n = (count: number, singular: string, plural: string): string =>
    `${count} ${count === 1 ? singular : plural}`;
  return `<!--
  ReqIF export of the Primmel package "${xmlCommentSafe(packageId)}" (${xmlCommentSafe(packageTitle)}).
  Generated by \`primmel export reqif\` (primmel-ts, TODO.roadmap/27).

  ONE-WAY PROJECTION. The Primmel package remains the single source of
  truth; this document is a lossy projection for RM-tool ecosystems.
  Re-imports are new-model suggestions, NEVER merges.

  Profile: DIN DKE SPEC 99200 (ReqIF interpretation for public
  standards, Release 1.3), ReqIF ${REQIF_VERSION} (20110401 namespace),
  followed where compatible.

  SURVIVES the projection:
    - provisions: one spec-object per requirement, per requirement
      class (heading), and per conformance test; the package itself as
      the document spec-object
    - hierarchy: classes nest per their /req/... id paths, requirements
      sit under their class, tests under a synthetic heading
    - modality: shall -> requirement, should -> recommendation,
      may -> permission (obj.modality)
    - clause provenance: obj.clause-number + bib.di.document-identifier
    - cross-references (spec-relations of type cross-reference, kind in
      LONG-NAME): depends-on (requirement and class dependencies),
      verifies (conformance-test targets), binds (bindings that name an
      exported spec-object)
    - guidance and verification method as inert text attributes
      (primmel.guidance, primmel.verification-method)

  LOST in the projection (absent from this document, by design):
    - machine-checkable bindings (binds_to subject paths)
    - OCL limit expressions and acceptance criteria
    - quantities with units, typed parameters, applicability filters
    - processes, forms, workflows, state machines, tables, formulas

  Deviations from the profile: the primmel.* extension attributes and
  the primmel.object-kind enum (requirement | conformance-test); the
  synthetic "Conformance tests" heading; the modality enum carries only
  the values this export mints; joined clause citations use a widened
  (1024) string datatype; requirements outside any class sit top-level
  (the profile nests every provision under a heading); leaf
  SPEC-HIERARCHY nodes carry an explicit empty CHILDREN element (the
  profile omits it).

  Contents: ${n(stats.documents, 'document', 'documents')}, ${n(stats.requirementClasses, 'requirement class', 'requirement classes')}, ${n(stats.requirements, 'requirement', 'requirements')}, ${n(stats.conformanceTests, 'conformance test', 'conformance tests')}, ${n(stats.specRelations, 'spec-relation', 'spec-relations')}, ${n(stats.droppedReferences.length, 'dropped reference', 'dropped references')}${stats.unknownObligations > 0 ? `, ${n(stats.unknownObligations, 'unknown obligation (modality undefined)', 'unknown obligations (modality undefined)')}` : ''}.
-->`;
}

// ─────────────────────────────────────────────────────────────────────
// The export itself.
// ─────────────────────────────────────────────────────────────────────

/** Projects a loaded Standard into a ReqIF document. */
export function exportStandardReqif(
  standard: Standard,
  options: ReqifExportOptions = {},
): ReqifExport {
  const now = options.now ?? new Date().toISOString();
  const manifest = standard.packageManifest ?? null;
  const packageId = manifest?.id ?? 'unknown-package';
  const packageTitle = manifest?.title || manifest?.id || 'Primmel package';

  const classes = standard.requirementClasses ?? [];
  const requirements = standard.requirements ?? [];
  const tests = standard.conformanceTests ?? [];

  // ── spec-objects + the exported-id map ──
  const objects: SpecObject[] = [];
  const identifierById = new Map<string, string>();
  const usedIdentifiers = new Set<string>();
  const claimIdentifier = (id: string): string => {
    let candidate = `primmel-so-${slug(id)}`;
    for (let n = 2; usedIdentifiers.has(candidate); n++) {
      candidate = `primmel-so-${slug(id)}-${n}`;
    }
    usedIdentifiers.add(candidate);
    return candidate;
  };

  const docIdentifier = `primmel-doc-${slug(packageId)}`;
  usedIdentifiers.add(docIdentifier);
  identifierById.set(packageId, docIdentifier);
  const docObject: SpecObject = {
    identifier: docIdentifier,
    longName: packageTitle,
    typeRef: SOT_DOCUMENT,
    values: [
      {
        kind: 'xhtml',
        ref: AD.document.text,
        text: manifest?.description ?? '',
      },
      ...(manifest?.baseUrn
        ? [
            {
              kind: 'string' as const,
              ref: AD.document.docIdentifier,
              value: manifest.baseUrn,
            },
          ]
        : []),
      { kind: 'string', ref: AD.document.unique, value: packageId },
    ],
  };
  objects.push(docObject);

  for (const rc of classes) {
    const identifier = claimIdentifier(rc.id);
    identifierById.set(rc.id, identifier);
    objects.push(headingSpecObject(rc, identifier));
  }
  let unknownObligations = 0;
  for (const r of requirements) {
    const identifier = claimIdentifier(r.id);
    identifierById.set(r.id, identifier);
    objects.push(requirementSpecObject(r, identifier));
    if (r.obligation && !(r.obligation in REQIF_MODALITY_BY_OBLIGATION)) {
      // Exports with modality `undefined` (reqifModality) — counted so
      // the typo is visible in stats, never silently promoted.
      unknownObligations++;
    }
  }
  for (const t of tests) {
    const identifier = claimIdentifier(t.id);
    identifierById.set(t.id, identifier);
    objects.push(testSpecObject(t, identifier));
  }
  const TESTS_HEADING_ID = 'primmel-hdr-conformance-tests';
  if (tests.length > 0) {
    usedIdentifiers.add(TESTS_HEADING_ID);
    objects.push({
      identifier: TESTS_HEADING_ID,
      longName: 'Conformance tests',
      typeRef: SOT_HEADING,
      values: [
        {
          kind: 'xhtml',
          ref: AD.heading.chapterName,
          text: 'Conformance tests',
        },
        {
          kind: 'string',
          ref: AD.heading.unique,
          value: 'primmel:conformance-tests',
        },
      ],
    });
  }

  // ── spec-relations (deduped; dangling refs dropped, recorded) ──
  const relations: SpecRelation[] = [];
  const droppedReferences: string[] = [];
  const seenRelation = new Set<string>();
  const addRelation = (owner: string, ref: string, kind: string): void => {
    const source = identifierById.get(owner);
    const target = identifierById.get(ref);
    if (source === undefined || target === undefined) {
      droppedReferences.push(`${owner} -> ${ref} (${kind})`);
      return;
    }
    const key = `${source}|${target}|${kind}`;
    if (seenRelation.has(key)) {
      return;
    }
    seenRelation.add(key);
    relations.push({
      identifier: `primmel-sr-${relations.length + 1}`,
      kind,
      source,
      target,
    });
  };

  for (const rc of classes) {
    for (const dep of rc.dependencies ?? []) {
      addRelation(rc.id, dep, 'depends-on');
    }
  }
  for (const r of requirements) {
    for (const dep of r.dependencies ?? []) {
      addRelation(r.id, dep, 'depends-on');
    }
    // Bindings: binds_to paths and limit uses that name an exported
    // spec-object become binds relations. Unexported refs in the
    // `/`-addressed id space (meant to name a model element, e.g. an
    // upstream /req/... id) are recorded as dropped; subject-chain
    // paths (sample.x, formula:…, table:…) stay silent — they are LOST
    // (the machine-checkable binding does not survive), not dropped.
    const bindings = [...(r.bindsTo ?? []), ...(r.limit?.uses ?? [])];
    for (const b of bindings) {
      if (identifierById.has(b) || b.startsWith('/')) {
        addRelation(r.id, b, 'binds');
      }
    }
  }
  for (const t of tests) {
    for (const target of t.targets ?? []) {
      addRelation(t.id, target, 'verifies');
    }
  }

  // ── the hierarchy ──
  const classIds = classes.map(c => c.id);
  const nodeByClassId = new Map<string, HierarchyNode>();
  for (const rc of classes) {
    nodeByClassId.set(rc.id, {
      objectIdentifier: identifierById.get(rc.id)!,
      children: [],
    });
  }
  // Class nesting: a class's parent is the longest OTHER class id that
  // path-prefixes it (R 60's classes are flat — all top level).
  const topLevel: HierarchyNode[] = [
    { objectIdentifier: docIdentifier, children: [] },
  ];
  for (const rc of classes) {
    const parent = requirementClassOf(
      rc.id,
      classIds.filter(c => c !== rc.id),
    );
    const node = nodeByClassId.get(rc.id)!;
    if (parent !== null) {
      nodeByClassId.get(parent)!.children.push(node);
    } else {
      topLevel.push(node);
    }
  }
  for (const r of requirements) {
    const owner = requirementClassOf(r.id, classIds);
    const node: HierarchyNode = {
      objectIdentifier: identifierById.get(r.id)!,
      children: [],
    };
    if (owner !== null) {
      nodeByClassId.get(owner)!.children.push(node);
    } else {
      topLevel.push(node);
    }
  }
  if (tests.length > 0) {
    topLevel.push({
      objectIdentifier: TESTS_HEADING_ID,
      children: tests.map(t => ({
        objectIdentifier: identifierById.get(t.id)!,
        children: [],
      })),
    });
  }

  const stats: ReqifExportStats = {
    documents: 1,
    requirementClasses: classes.length,
    requirements: requirements.length,
    conformanceTests: tests.length,
    specRelations: relations.length,
    droppedReferences,
    unknownObligations,
  };

  // ── render ──
  const enumValues = (
    dt: string,
    name: string,
    values: string[],
    ev: (v: string) => string,
  ): string =>
    `\t\t\t\t<DATATYPE-DEFINITION-ENUMERATION IDENTIFIER="${dt}" LAST-CHANGE="${now}" LONG-NAME="${name}">\n` +
    `\t\t\t\t\t<SPECIFIED-VALUES>\n` +
    values
      // PROPERTIES/EMBEDDED-VALUE is a required child of ENUM-VALUE in
      // the ReqIF XSD (KEY = the 1-based position, per the profile's
      // examples; OTHER-CONTENT left empty).
      .map(
        (v, i) =>
          `\t\t\t\t\t\t<ENUM-VALUE IDENTIFIER="${ev(v)}" LAST-CHANGE="${now}" LONG-NAME="${v}">\n` +
          `\t\t\t\t\t\t\t<PROPERTIES><EMBEDDED-VALUE KEY="${i + 1}" OTHER-CONTENT=""/></PROPERTIES>\n` +
          `\t\t\t\t\t\t</ENUM-VALUE>`,
      )
      .join('\n') +
    `\n\t\t\t\t\t</SPECIFIED-VALUES>\n` +
    `\t\t\t\t</DATATYPE-DEFINITION-ENUMERATION>`;

  const stringAttr = (id: string, name: string, dt: string): string =>
    `\t\t\t\t\t\t<ATTRIBUTE-DEFINITION-STRING IDENTIFIER="${id}" LAST-CHANGE="${now}" LONG-NAME="${name}" IS-EDITABLE="true">\n` +
    `\t\t\t\t\t\t\t<TYPE><DATATYPE-DEFINITION-STRING-REF>${dt}</DATATYPE-DEFINITION-STRING-REF></TYPE>\n` +
    `\t\t\t\t\t\t</ATTRIBUTE-DEFINITION-STRING>`;
  const xhtmlAttr = (id: string, name: string): string =>
    `\t\t\t\t\t\t<ATTRIBUTE-DEFINITION-XHTML IDENTIFIER="${id}" LAST-CHANGE="${now}" LONG-NAME="${name}" IS-EDITABLE="true">\n` +
    `\t\t\t\t\t\t\t<TYPE><DATATYPE-DEFINITION-XHTML-REF>${DT_XHTML}</DATATYPE-DEFINITION-XHTML-REF></TYPE>\n` +
    `\t\t\t\t\t\t</ATTRIBUTE-DEFINITION-XHTML>`;
  const enumAttr = (id: string, name: string, dt: string): string =>
    `\t\t\t\t\t\t<ATTRIBUTE-DEFINITION-ENUMERATION IDENTIFIER="${id}" LAST-CHANGE="${now}" LONG-NAME="${name}" IS-EDITABLE="true" MULTI-VALUED="false">\n` +
    `\t\t\t\t\t\t\t<TYPE><DATATYPE-DEFINITION-ENUMERATION-REF>${dt}</DATATYPE-DEFINITION-ENUMERATION-REF></TYPE>\n` +
    `\t\t\t\t\t\t</ATTRIBUTE-DEFINITION-ENUMERATION>`;

  const specObjectType = (
    id: string,
    name: string,
    desc: string,
    attrs: string[],
  ): string =>
    `\t\t\t\t<SPEC-OBJECT-TYPE IDENTIFIER="${id}" LAST-CHANGE="${now}" LONG-NAME="${name}" DESC="${desc}">\n` +
    `\t\t\t\t\t<SPEC-ATTRIBUTES>\n` +
    attrs.join('\n') +
    `\n\t\t\t\t\t</SPEC-ATTRIBUTES>\n` +
    `\t\t\t\t</SPEC-OBJECT-TYPE>`;

  const specificationId = `primmel-spec-${slug(packageId)}`;
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    headerNote(packageId, packageTitle, stats) +
    `\n<REQ-IF xmlns="${REQIF_NAMESPACE}" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${REQIF_NAMESPACE} ${REQIF_NAMESPACE}">\n` +
    `\t<THE-HEADER>\n` +
    `\t\t<REQ-IF-HEADER IDENTIFIER="primmel-reqif-${slug(packageId)}">\n` +
    `\t\t\t<CREATION-TIME>${now}</CREATION-TIME>\n` +
    `\t\t\t<REQ-IF-TOOL-ID>primmel export reqif</REQ-IF-TOOL-ID>\n` +
    `\t\t\t<REQ-IF-VERSION>${REQIF_VERSION}</REQ-IF-VERSION>\n` +
    `\t\t\t<SOURCE-TOOL-ID>primmel-ts</SOURCE-TOOL-ID>\n` +
    `\t\t\t<TITLE>${escapeXml(packageTitle)}</TITLE>\n` +
    `\t\t</REQ-IF-HEADER>\n` +
    `\t</THE-HEADER>\n` +
    `\t<CORE-CONTENT>\n` +
    `\t\t<REQ-IF-CONTENT>\n` +
    `\t\t\t<DATATYPES>\n` +
    `\t\t\t\t<DATATYPE-DEFINITION-STRING IDENTIFIER="${DT_STRING_16384}" LAST-CHANGE="${now}" LONG-NAME="string-16384" MAX-LENGTH="16384"/>\n` +
    `\t\t\t\t<DATATYPE-DEFINITION-STRING IDENTIFIER="${DT_STRING_1024}" LAST-CHANGE="${now}" LONG-NAME="string-1024" MAX-LENGTH="1024"/>\n` +
    `\t\t\t\t<DATATYPE-DEFINITION-STRING IDENTIFIER="${DT_STRING_64}" LAST-CHANGE="${now}" LONG-NAME="string-64" MAX-LENGTH="64"/>\n` +
    `\t\t\t\t<DATATYPE-DEFINITION-XHTML IDENTIFIER="${DT_XHTML}" LAST-CHANGE="${now}" LONG-NAME="xhtml"/>\n` +
    enumValues(
      DT_MODALITY,
      'modality',
      ['requirement', 'recommendation', 'permission', 'undefined'],
      EV_MODALITY,
    ) +
    `\n` +
    enumValues(
      DT_NORMATIVITY,
      'normativity',
      ['normative', 'informative'],
      EV_NORMATIVITY,
    ) +
    `\n` +
    enumValues(
      DT_OBJECT_KIND,
      'primmel.object-kind',
      ['requirement', 'conformance-test'],
      EV_OBJECT_KIND,
    ) +
    `\n\t\t\t</DATATYPES>\n` +
    `\t\t\t<SPEC-TYPES>\n` +
    specObjectType(SOT_DOCUMENT, 'document', 'Documents', [
      xhtmlAttr(AD.document.text, 'ReqIF.Text'),
      stringAttr(
        AD.document.docIdentifier,
        'bib.di.document-identifier',
        DT_STRING_1024,
      ),
      stringAttr(AD.document.unique, 'ids.unique', DT_STRING_1024),
    ]) +
    `\n` +
    specObjectType(SOT_HEADING, 'heading', 'Clause and Section Headers', [
      xhtmlAttr(AD.heading.chapterName, 'ReqIF.ChapterName'),
      stringAttr(AD.heading.unique, 'ids.unique', DT_STRING_1024),
    ]) +
    `\n` +
    specObjectType(
      SOT_PROVISION,
      'provision',
      'Governing and assertional provisions',
      [
        xhtmlAttr(AD.provision.text, 'ReqIF.Text'),
        enumAttr(AD.provision.modality, 'obj.modality', DT_MODALITY),
        enumAttr(AD.provision.normativity, 'obj.normativity', DT_NORMATIVITY),
        enumAttr(
          AD.provision.objectKind,
          'primmel.object-kind',
          DT_OBJECT_KIND,
        ),
        stringAttr(
          AD.provision.clauseNumber,
          'obj.clause-number',
          DT_STRING_1024,
        ),
        stringAttr(
          AD.provision.docIdentifier,
          'bib.di.document-identifier',
          DT_STRING_1024,
        ),
        stringAttr(AD.provision.unique, 'ids.unique', DT_STRING_1024),
        stringAttr(AD.provision.guidance, 'primmel.guidance', DT_STRING_16384),
        stringAttr(
          AD.provision.verificationMethod,
          'primmel.verification-method',
          DT_STRING_64,
        ),
      ],
    ) +
    `\n` +
    `\t\t\t\t<SPEC-RELATION-TYPE IDENTIFIER="${SRT_CROSS_REFERENCE}" LAST-CHANGE="${now}" LONG-NAME="cross-reference" DESC="Internal document reference"/>\n` +
    `\t\t\t\t<SPECIFICATION-TYPE IDENTIFIER="${ST_SPECIFICATION}" LAST-CHANGE="${now}" LONG-NAME="specification-standard" DESC="Standards Document">\n` +
    `\t\t\t\t\t<SPEC-ATTRIBUTES/>\n` +
    `\t\t\t\t</SPECIFICATION-TYPE>\n` +
    `\t\t\t</SPEC-TYPES>\n` +
    `\t\t\t<SPEC-OBJECTS>\n` +
    objects.map(o => renderSpecObject(o, now)).join('\n') +
    `\n\t\t\t</SPEC-OBJECTS>\n` +
    `\t\t\t<SPEC-RELATIONS>\n` +
    relations.map(r => renderRelation(r, now)).join('\n') +
    `\n\t\t\t</SPEC-RELATIONS>\n` +
    `\t\t\t<SPECIFICATIONS>\n` +
    `\t\t\t\t<SPECIFICATION IDENTIFIER="${specificationId}" LAST-CHANGE="${now}" LONG-NAME="${escapeXml(packageTitle)}">\n` +
    `\t\t\t\t\t<TYPE><SPECIFICATION-TYPE-REF>${ST_SPECIFICATION}</SPECIFICATION-TYPE-REF></TYPE>\n` +
    `\t\t\t\t\t<CHILDREN>\n` +
    topLevel
      .map((n, i) =>
        renderHierarchy(n, `primmel-sh-${i + 1}`, now, '\t\t\t\t\t\t'),
      )
      .join('\n') +
    `\n\t\t\t\t\t</CHILDREN>\n` +
    `\t\t\t\t</SPECIFICATION>\n` +
    `\t\t\t</SPECIFICATIONS>\n` +
    `\t\t</REQ-IF-CONTENT>\n` +
    `\t</CORE-CONTENT>\n` +
    `</REQ-IF>\n`;

  return { xml, stats };
}

/**
 * Loads the package at `dir` (single directory — the CLI's `check`
 * default; `uses` composition needs a locator and stays a punt) and
 * projects it into a ReqIF document.
 */
export function exportPackageReqif(
  dir: string,
  options: ReqifExportOptions = {},
): ReqifExport {
  const { standard } = loadPackageWithIssues(dir);
  return exportStandardReqif(standard, options);
}
