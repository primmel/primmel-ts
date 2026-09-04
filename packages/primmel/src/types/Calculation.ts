import Resolvable from './Resolvable';
import Reference from './Reference';

export interface CalculationInput {
  name: string;
  type: string;
  unit: string;
  description: string;
  defaultValue: string;
  hasDefault: boolean;
  /** Inline enum values for enum-typed inputs. */
  enumValues?: string[];
  /**
   * The typed-unit pair's kind half (v3.2 signature, C115) — resolves
   * against the merged quantity register and must agree with `unit`'s
   * kind. Set only when declared (round-trip shape discipline).
   */
  quantityKind?: string;
  /** Admissible domain (v3.2, C115); either bound may be absent. */
  rangeMin?: string;
  rangeMax?: string;
  hasRange?: boolean;
}

export interface CalculationOutput {
  type: string;
  unit: string;
  name?: string;
  description?: string;
  /** v3.2 signature facets (C115) — set only when declared. */
  quantityKind?: string;
  rangeMin?: string;
  rangeMax?: string;
  hasRange?: boolean;
}

/** Table-lookup declaration (key + carried variable + multiplier). */
export interface CalculationLookup {
  key: string;
  variable: string;
  multiplier: string;
  /**
   * Declared fallback tier for a MISSING binding key (G12 residual (b),
   * TODO.roadmap/19) — replaces the hardcoded `multiplier * 1.5` fallback.
   * Absent: a missing key resolves to null/NaN, never a fabricated limit.
   * mode: absolute (default) scales the multiplier; relative scales the
   * measured value — same semantics as table tiers.
   */
  defaultTier?: { factor: number; mode?: 'absolute' | 'relative' } | null;
}

interface Calculation {
  id: string;
  name: string;
  /** Canonical identifier path (e.g. /calc/mpe/absolute). */
  identifier?: string;
  /** Engine rule kind (v2): expression | table_lookup | profile_lookup | pass_fail */
  ruleType?: string;
  /** Grouping category for typed primitives (v2). */
  category?: string;
  /** Display label (v2). */
  label?: string;
  description: string;
  inputs: CalculationInput[];
  output: CalculationOutput;
  expression: string;
  /** Parameter ids the calculation is parameterized by. */
  params?: string[];
  /** Table-lookup declaration. */
  lookup?: CalculationLookup | null;
  /** Profile path this calculation resolves through (e.g. profiles.mpe_tiers). */
  profile?: string;
  /** Structured provenance (doc URN + clause), e.g. R 60-3, 2.1.2.4. */
  sourceRef?: { doc: string; clause: string; fragment?: string } | null;
  /** All structured provenance bindings when the element cites several
   * fragments (TODO.roadmap/24 — repeated `source {}` blocks; sourceRef is
   * the first entry, kept for back-compatibility). */
  sourceRefs?: { doc: string; clause: string; fragment?: string }[];
  /** The unified typed references (docs/primmel/18). */
  refs?: import('./Ref').Ref[];
  /** The correspondence annotations (MN 114 v3.1, clause 19.4). */
  correspondences?: import('./Correspondence').Correspondence[];
  ref: Reference[];
}

export default Calculation;

export type ResolvableCalculation = Resolvable<Calculation, 'ref'>;
