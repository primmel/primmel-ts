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
 */
export type PackageKind = 'core' | 'module' | 'rec';

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
   */
  uses?: string[];
  /** Package tier; absent means an ordinary (rec) package. */
  kind?: PackageKind;
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
  description: string;
  source: PackageSource | null;
}
