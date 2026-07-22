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
  description: string;
  source: PackageSource | null;
}
