import Resolvable from './Resolvable';
import Reference from './Reference';

export interface CalculationInput {
  name: string;
  type: string;
  unit: string;
  description: string;
  defaultValue: string;
  hasDefault: boolean;
}

export interface CalculationOutput {
  type: string;
  unit: string;
}

interface Calculation {
  id: string;
  name: string;
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
  ref: Reference[];
}

export default Calculation;

export type ResolvableCalculation = Resolvable<Calculation, 'ref'>;
