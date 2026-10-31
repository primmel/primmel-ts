// ─────────────────────────────────────────────────────────────────────
// The manifest's declared schema (CRITIQUE-2 #10, TODO.lang-gaps/21):
// the manifest was becoming a second model without the model's tools —
// ~30 facets with cross-facet rules (C144–C146's key/holder pair,
// C77's status-vs-register, C79's lineage, C81's maps) and no typed
// declarations. This module is the facet registry: one entry per
// manifest facet (aliases included), its arity, its closed vocabulary
// where one exists, and the rules that judge it. The parser
// (packageManifest.ts) imports the vocabularies from here — one
// source; the tests assert the schema covers the parser's handler set
// and vice versa, so a facet cannot land undocumented and a schema row
// cannot outlive its facet.
// ─────────────────────────────────────────────────────────────────────

export type ManifestArity =
  /** One bare value (`id test`). */
  | 'scalar'
  /** The block list (`provides { a b }`) — the only list shape. */
  | 'block-list'
  /** One URN or a `{ … }` list of them (supersedes). */
  | 'urn-list'
  /** The typed relation block (`ref derives-from "…"`, repeatable). */
  | 'ref-block'
  /** A structured block (`validity { from … to … }`). */
  | 'block';

export interface ManifestFacet {
  /** The canonical keyword. */
  keyword: string;
  /** Accepted alias spellings (the camelCase bridge). */
  aliases?: string[];
  arity: ManifestArity;
  /** The facet's closed vocabulary, when one exists — the parser
   *  refuses outside it. */
  vocabulary?: readonly string[];
  /** The linter rules that judge the facet. */
  rules: string[];
  note: string;
}

/** The package kinds (C-surface; the parser refuses outside this). */
export const PACKAGE_KINDS: readonly string[] = [
  'core',
  'module',
  'rec',
  'product_reference',
  'certification_program',
] as const;

/** The edition lifecycle statuses (C77). */
export const EDITION_STATUSES: readonly string[] = [
  'current',
  'preview',
  'superseded',
  'withdrawn',
] as const;

export const MANIFEST_FACETS: ManifestFacet[] = [
  {
    keyword: 'id',
    arity: 'scalar',
    rules: [],
    note: 'the package identity every registry keys on',
  },
  { keyword: 'title', arity: 'scalar', rules: [], note: 'the display title' },
  {
    keyword: 'version',
    arity: 'scalar',
    rules: [],
    note: 'the edition year or version string',
  },
  {
    keyword: 'language',
    arity: 'scalar',
    rules: ['C176', 'C178'],
    note: 'the language revision the package is written against',
  },
  {
    keyword: 'editions',
    arity: 'block-list',
    rules: ['C113'],
    note: 'the edition states the package packages',
  },
  {
    keyword: 'baseUrn',
    aliases: ['base_urn'],
    arity: 'scalar',
    rules: ['C85'],
    note: 'the base URN the provenance addresses hang from',
  },
  {
    keyword: 'extends',
    arity: 'scalar',
    rules: ['C27'],
    note: 'the deprecated single-entry uses spelling (parsed as uses, warned)',
  },
  {
    keyword: 'uses',
    arity: 'block-list',
    rules: ['C27', 'C28', 'C29', 'C31', 'C83', 'C187'],
    note: 'the composition edges: ids, edition-pinned abstract imports, locator-qualified imports',
  },
  {
    keyword: 'kind',
    arity: 'scalar',
    vocabulary: PACKAGE_KINDS,
    rules: [],
    note: 'the package kind',
  },
  {
    keyword: 'manufacturer',
    arity: 'scalar',
    rules: ['C144', 'C146'],
    note: "the entitlement pair's manufacturer side",
  },
  {
    keyword: 'product',
    arity: 'scalar',
    rules: [],
    note: 'the product the package belongs to',
  },
  {
    keyword: 'maps_to',
    aliases: ['mapsTo'],
    arity: 'block-list',
    rules: ['C81', 'C82'],
    note: 'the standards-reference packages this model maps to',
  },
  {
    keyword: 'ref',
    arity: 'ref-block',
    rules: [],
    note: 'the typed relations of the package itself (clause 14)',
  },
  {
    keyword: 'corresponds',
    arity: 'block',
    rules: ['C108'],
    note: 'the generalized correspondence annotation',
  },
  {
    keyword: 'scheme_type',
    aliases: ['schemeType'],
    arity: 'scalar',
    rules: ['C98'],
    note: 'the ISO/IEC 17067 self-classification',
  },
  {
    keyword: 'license_key',
    aliases: ['licenseKey'],
    arity: 'scalar',
    rules: ['C144', 'C145'],
    note: 'the entitlement-catalog key',
  },
  {
    keyword: 'license_holder',
    aliases: ['licenseHolder'],
    arity: 'scalar',
    rules: ['C146'],
    note: 'the entitlement holder',
  },
  {
    keyword: 'provides',
    arity: 'block-list',
    rules: ['C30', 'C31'],
    note: 'the capability tokens offered to the closure',
  },
  {
    keyword: 'requires',
    arity: 'block-list',
    rules: ['C31'],
    note: 'the capability tokens demanded of the closure',
  },
  {
    keyword: 'waives',
    arity: 'block-list',
    rules: ['C30'],
    note: 'the capability demands explicitly waived',
  },
  {
    keyword: 'supersedes',
    arity: 'urn-list',
    rules: ['C79', 'C113'],
    note: 'the edition lineage URNs',
  },
  {
    keyword: 'replaces',
    arity: 'urn-list',
    rules: ['C79', 'C113'],
    note: 'the edition lineage URNs',
  },
  {
    keyword: 'superseded_by',
    arity: 'urn-list',
    rules: ['C79', 'C113'],
    note: 'the edition lineage URNs',
  },
  {
    keyword: 'validity',
    arity: 'block',
    rules: ['C78'],
    note: 'the validity window (from/to)',
  },
  {
    keyword: 'status',
    arity: 'scalar',
    vocabulary: EDITION_STATUSES,
    rules: ['C77'],
    note: 'the edition lifecycle status',
  },
  {
    keyword: 'default_spelling',
    aliases: ['defaultSpelling'],
    arity: 'scalar',
    rules: [],
    note: 'the ISO 24229 spelling code the inline prose is authored in',
  },
  {
    keyword: 'spellings',
    arity: 'block-list',
    rules: [],
    note: 'the declared spelling-coverage set',
  },
  { keyword: 'description', arity: 'scalar', rules: [], note: 'free text' },
  {
    keyword: 'source',
    arity: 'block',
    rules: [],
    note: 'the source-extract register (collection/parts)',
  },
];

/** The schema row for one keyword or alias. */
export function manifestFacet(keyword: string): ManifestFacet | undefined {
  return MANIFEST_FACETS.find(
    f => f.keyword === keyword || f.aliases?.includes(keyword),
  );
}
