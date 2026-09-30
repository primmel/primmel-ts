/**
 * Quantities, time, and the IS↔HAS value duality
 * (Primmel v3, TODO.roadmap/06; doctrine ch. 6 — data and values).
 *
 * INV-1 (no bare numbers): every physical quantity is a QuantityValue —
 * value + unit are inseparable; tolerance marks the symmetric band of a
 * SPECIFIED value (the designed side), uncertainty the dispersion of a
 * MEASURED value (the exhibited side). The two never merge.
 *
 * The quantity_register is the typed unit/quantity-kind registry of a
 * package: units carry symbol + kind; kinds carry the dimension vector and
 * the SI coherent unit; every non-coherent unit declares its conversion
 * factor to SI. Comparison coherence is judged on KINDS, never on unit
 * strings (linter C33 quantity-coherence).
 *
 * The `dual` construct is the IS↔HAS duality relation: ONE quantity in
 * two aspect roles — designed (IS: what the design promises) vs exhibited
 * (HAS: what the instance shows) — enabling as-found verification. Both
 * roles are optional individually, but at least one must be present
 * (linter C34 duality-coherence).
 */

/**
 * One quantity value: value + unit, with the optional facets of the two
 * duality roles. `value` holds a number when the source token was an
 * unquoted numeric literal, otherwise the string as written.
 */
export interface QuantityValue {
  value: string | number;
  /** Unit id or symbol — resolves in a quantity_register (C33). */
  unit?: string;
  /**
   * Quantity kind override. Normally derived from `unit` through the
   * register; declared explicitly only when the unit is unmapped.
   */
  quantityKind?: string;
  /** Dispersion of a MEASURED value (exhibited side; GUM-shaped). */
  uncertainty?: string | number;
  /** Symmetric band of a SPECIFIED value (designed side). */
  tolerance?: string | number;
  /**
   * Per-entry provenance (the typed kernel, clause 10): where the value
   * was read from, in the register's own words when the wording
   * differs, and the lineage references when the value's status has
   * changed — the declaration it came from and the verdict that
   * validated it. Optional per entry; carried through serialization.
   */
  provenance?: ValueProvenance;
}

export interface ValueProvenance {
  /** The document, test report and run, or system of record. */
  source: string;
  /** The page the value was read from (scanned documents). */
  page?: string;
  /** The entry's own wording when it differs from the model's symbol. */
  entryWording?: string;
  /** When the value was read (ISO 8601 datetime). */
  readAt?: string;
  /** The declaration the value came from (lineage, kernel rule R7). */
  declaration?: string;
  /** The verdict that validated the value (lineage, kernel rule R7). */
  verdict?: string;
}

/**
 * One quantity kind — the comparison-coherence unit. `dimensions` is the
 * dimension vector over the SI base dimensions (M, L, T, I, Θ, N, J);
 * `siUnit` is the SI coherent unit of the kind (symbol, e.g. "kg", "m/s").
 */
export interface QuantityKindDef {
  id: string;
  /** Dimension vector: SI base-dimension symbol → exponent (0 elided). */
  dimensions: Record<string, number>;
  /** SI coherent unit of the kind (symbol; "1" for dimensionless). */
  siUnit: string;
  description: string;
  /**
   * The external unit-vocabulary bindings (v3.2, clause 13.4) — e.g.
   * `corresponds unitsml "<unit-identifier>"`. Maps-to, never imports.
   */
  correspondences?: import('./Correspondence').Correspondence[];
}

/** One unit in a quantity register. */
export interface UnitDef {
  id: string;
  symbol: string;
  label: string;
  /** Quantity-kind id this unit measures (resolves across registers). */
  kind: string;
  /**
   * Multiplicative conversion factor to the kind's SI coherent unit
   * (km/h → 1/3.6 m/s). 1 for SI coherent units.
   */
  factorToSI: number;
  /**
   * Affine offset to SI, added AFTER scaling (degC → K: factor 1,
   * offset 273.15). 0 for purely multiplicative units.
   */
  offsetToSI: number;
  /** Free-text definition (e.g. "kg⋅m/s²" for N). */
  definition: string;
  /** The external unit-vocabulary bindings (v3.2, clause 13.4). */
  correspondences?: import('./Correspondence').Correspondence[];
}

/**
 * quantity_register <id> — the typed unit/quantity-kind registry of a
 * package. A rec package EXTENDS the register by adding domain units; it
 * never redefines SI entries (linter C33).
 */
export interface QuantityRegister {
  id: string;
  kinds: QuantityKindDef[];
  units: UnitDef[];
  referenceIds: string[];
}

/**
 * dual <id> — the IS↔HAS value duality (doctrine §3.2/§9.6). One value
 * structure, two roles: `designed` (IS — rating, with tolerance) and
 * `exhibited` (HAS — observation, with uncertainty). Both roles optional
 * individually; at least one present (C34).
 */
export interface Dual {
  id: string;
  /** The attribute_definition both roles measure (id). */
  attribute: string;
  designed?: QuantityValue;
  exhibited?: QuantityValue;
  referenceIds: string[];
}
