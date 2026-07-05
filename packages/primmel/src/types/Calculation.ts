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
  description: string;
  inputs: CalculationInput[];
  output: CalculationOutput;
  expression: string;
  ref: Reference[];
}

export default Calculation;

export type ResolvableCalculation = Resolvable<Calculation, 'ref'>;
