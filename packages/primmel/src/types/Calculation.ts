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
}

export interface CalculationOutput {
  type: string;
  unit: string;
  name?: string;
  description?: string;
}

/** Table-lookup declaration (key + carried variable + multiplier). */
export interface CalculationLookup {
  key: string;
  variable: string;
  multiplier: string;
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
  sourceRef?: { doc: string; clause: string } | null;
  ref: Reference[];
}

export default Calculation;

export type ResolvableCalculation = Resolvable<Calculation, 'ref'>;
