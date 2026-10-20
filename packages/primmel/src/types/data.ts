import Resolvable from './Resolvable';
import type { Ref } from '../ser-des/config/ref';

export type { Ref } from '../ser-des/config/ref';

export interface Registry {
  id: string;
  title: string;
  data: DataClass | null;
}

export type ResolvableRegistry = Resolvable<Registry, 'data'>;

export interface DataClass {
  id: string;
  attributes: DataAttribute[];
  /** Persistent store name for storable classes (v2 G2). */
  store?: string;
  /** Store indexes (v2 G2). */
  indexes?: string[];
  /** Helper classes embed into their parents (no store) (v2 G2). */
  helper?: boolean;
  /** Inheritance: fields merge from the parent (v2 G2). */
  extends?: string;
  /**
   * Overlay marker (composition): this class intentionally supersedes
   * an upstream package's class with the same id — uses-no-redefine
   * is lifted and the entry merges FIELD-WISE (attributes union by id
   * in first-seen order), the downstream's added fields landing beside
   * the upstream's (e.g. a Recommendation's entity carrying two extra
   * attributes over oiml-smart-core's).
   */
  overlay?: boolean;
  /** Class-level description. */
  description?: string;
  /** Class-level references (Extension 2 — primmel-ts#52). Provenance:
   *  where this class is defined in source documents. */
  ref?: Ref[];
}

export type ResolvableDataClass = {
  id: string;
  attributes: ResolveableDataAttribute[];
  store?: string;
  indexes?: string[];
  helper?: boolean;
  extends?: string;
  overlay?: boolean;
  description?: string;
  ref?: Ref[];
};

export interface DataAttribute {
  id: string;
  /** The authored surface — 'lutaml' or undefined (the v2 field
   *  dialect); carried through the migration window for the dump. */
  surface?: 'lutaml';
  type: string;
  modality: string;
  cardinality: string;
  definition: string;
  /** The v2 `reference { … }` id list (opaque ids, never resolved). */
  referenceIds: string[];
  satisfy: string[];
  /** FK edge semantics on reference fields (v2 G2). */
  onDelete?: string;
  /** Legacy field kept for migration only (v2 G2). */
  deprecated?: boolean;
  /** Inline enum values for `enum`-typed fields. */
  enumValues?: string[];
  /** Explicit required flag (companion of modality). */
  required?: boolean;
  /** Unit of a quantity-valued field. */
  unit?: string;
  /** Default value (verbatim; structured defaults travel as JSON strings). */
  defaultValue?: string;
}

export type ResolveableDataAttribute = DataAttribute;

export interface Enum {
  id: string;
  values: EnumValue[];
}

export interface EnumValue {
  id: string;
  value: string;
}

export interface Variable {
  id: string;
  type: string;
  definition: string;
  description: string;
}
