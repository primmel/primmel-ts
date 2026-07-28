/**
 * Package manifest (Primmel v2, gap G8).
 *
 * One `package.primmel` per Recommendation package — the only required file.
 * Everything else in the package directory is merged by convention.
 */
export interface PackageSource {
  collection: string;
  parts: string[];
}

/**
 * Edition lifecycle status (TODO.roadmap/28, doctrine §13.4): `current`
 * (the in-force edition), `preview` (published for review, not yet in
 * force — e.g. R 91:2025), `superseded` (a later edition holds force),
 * `withdrawn` (pulled without a successor).
 */
export type EditionStatus = 'current' | 'preview' | 'superseded' | 'withdrawn';

/**
 * An edition's validity window (doctrine §13.4: "a fact about the
 * package's force", time-primitive machinery applied at the manifest).
 * `from` is an ISO 8601 date/datetime; `to` optional — the window closes
 * when the edition is superseded (or explicitly at `to`).
 */
export interface EditionValidity {
  from: string;
  to?: string;
}

/**
 * Package tier (TODO.roadmap/05): `core` = the shared kernel, `module` =
 * a shared capability package consumed by ≥2 recs, `rec` = a publishable
 * Recommendation. Registries skip non-rec kinds in rec listings.
 * `product_reference` (TODO.roadmap/36, doctrine ch. 15) = a
 * manufacturer's product model, mapped aspect-by-aspect to the
 * Recommendation — a REFERENCE model consumed by users in two modes
 * (abstract import / live integration), never a refinement of the
 * standard: the two are related by mapping only.
 * `certification_program` (TODO.v2/01, twin-certification-design Q4) =
 * a scheme operator's certification program (e.g. the digital-twin
 * program) — a FOURTH publisher with the product_reference shape:
 * related to recs (maps_to) and product packages (pinned abstract
 * imports) by mapping only, composed into nothing.
 */
export type PackageKind =
  'core' | 'module' | 'rec' | 'product_reference' | 'certification_program';

export interface PackageManifest {
  id: string;
  title: string;
  version: string;
  /** Available editions, newest first (e.g. [2021, 2017, 2000]). */
  editions: string[];
  baseUrn: string;
  /**
   * @deprecated Metamodel package this package extends (e.g. oiml-core).
   * Kept for backwards compatibility: the loader treats it as a single
   * entry of `uses` (with a deprecation warning). New packages declare
   * `uses` instead.
   */
  extends: string;
  /**
   * Imported packages (`uses` composition — structural inclusion, "my
   * model contains yours"; concept doc §5.6 b). Multi-package, merged in
   * topological order by the loader (TODO.roadmap/05): a downstream
   * package may REFERENCE upstream ids but never REDEFINE them.
   * Import is NOT mapping: a namespace listed here (or in `extends`) may
   * not also be the target of a map_profile/.prm mapSet — linter rule
   * C24 (import-not-mapping).
   *
   * Two entry forms: a bare package id (`oiml-smart-core`), or a
   * version-pinned ABSTRACT IMPORT `acme-lc500@2021` (TODO.roadmap/36)
   * of a `product_reference` package — reference content cited at a
   * pinned edition, located and checked but NEVER content-merged by the
   * composer, and exempt from C24 (the import is expressed as a mapping
   * to the product's promised aspects; doctrine ch. 15 §15.3). The pins
   * land in `usePins`; this list always carries the bare ids.
   */
  uses?: string[];
  /**
   * Version pins parsed from `uses` entries of the form
   * `<package-id>@<edition>` (abstract imports of product reference
   * packages — linter rule C83 abstract-import-pinned requires the pin
   * and checks it against the product package's edition register).
   * Keyed by the bare package id.
   */
  usePins?: Record<string, string>;
  /** Package tier; absent means an ordinary (rec) package. */
  kind?: PackageKind;
  /**
   * Product reference packages only (TODO.roadmap/36, doctrine ch. 15
   * §15.1): the manufacturer this model speaks for, and the product
   * designation (e.g. "LC-500"). Linter rule C81 requires both.
   */
  manufacturer?: string;
  product?: string;
  /**
   * Product reference and certification program packages only: the
   * standards-reference packages this model maps to (`maps_to { oiml-r60 }`)
   * — the declaration its map_profile/.prm maps must resolve into (C81
   * product-maps-resolves, C97 program-maps-resolves).
   */
  mapsTo?: string[];
  /**
   * Certification program packages only (TODO.v2/01,
   * twin-certification-design Q4): the program's self-classification
   * against the ISO/IEC 17067 scheme-type register (`scheme_type
   * type_5`) — a free token here (the register lives consumer-side; the
   * kernel stays register-free, the C89 spelling precedent). C98 warns
   * when a no-surveillance shape (type_1a/1b) is declared alongside
   * surveillance machinery.
   */
  schemeType?: string;
  /**
   * Capability ids this package contributes for downstream consumers
   * (module manifests). Every provides entry must be consumed by a
   * downstream package's `requires` or explicitly waived — linter rule
   * C30 (provides-consumed-or-waived).
   */
  provides?: string[];
  /**
   * Capability or package ids this package expects in the composition.
   * Satisfied when the entry names a composed package's id or one of its
   * `provides` entries — checked after the merge (C31 requires-satisfied).
   */
  requires?: string[];
  /**
   * Explicit consumer-side waivers for provides entries the composer
   * would otherwise flag as unconsumed: `<packageId>:<providesEntry>`
   * (a bare `<providesEntry>` also matches).
   */
  waives?: string[];
  /**
   * Edition lifecycle (TODO.roadmap/28, doctrine §13.4) — packagings, not
   * core semantics: versioning relations live on the package manifest,
   * never in subject models. `supersedes`/`replaces` name package URNs of
   * earlier editions (urn:oiml:pub:r:60:2017); the supersedes graph must
   * be acyclic (linter C79).
   */
  supersedes?: string[];
  /** Stronger than supersedes: this edition takes the place of the target. */
  replaces?: string[];
  /** The edition's validity window; `to` absent = closes when superseded. */
  validity?: EditionValidity;
  /** Lifecycle status of THIS packaged edition (linter C77). */
  status?: EditionStatus;
  /**
   * ISO 24229 multilinguality (TODO.roadmap/25, doctrine ch. 10 §10.6):
   * the package's DEFAULT spelling code — the spelling every inline prose
   * string (`name "…"`, `statement "…"`, …) is authored in. Alternate
   * spellings are added by `text` blocks; every content set carries the
   * default. Syntax checked by C89 (script mandatory).
   */
  defaultSpelling?: string;
  /**
   * The declared spelling set of the package (the default plus every
   * spelling a localization ships) — the linter's coverage declaration
   * (doctrine §10.6: declared spellings missing from a set are coverage
   * gaps). Absent means the default spelling only.
   */
  spellings?: string[];
  description: string;
  source: PackageSource | null;
}
