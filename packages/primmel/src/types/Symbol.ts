import Resolvable from './Resolvable';
import Reference from './Reference';

export type SymbolType = 'number' | 'integer' | 'string' | 'boolean' | 'enum';

interface Symbol {
  id: string;
  name: string;
  definition: string;
  type: SymbolType;
  unit: string;
  latex: string;
  values: string[];
  ref: Reference[];
}

export default Symbol;

export type ResolvableSymbol = Resolvable<Symbol, 'ref'>;
