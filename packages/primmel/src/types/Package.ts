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

export interface PackageManifest {
  id: string;
  title: string;
  version: string;
  /** Available editions, newest first (e.g. [2021, 2017, 2000]). */
  editions: string[];
  baseUrn: string;
  /** Metamodel package this package extends (e.g. oiml-core). */
  extends: string;
  description: string;
  source: PackageSource | null;
}
