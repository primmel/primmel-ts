import Resolvable from './Resolvable';
import Reference from './Reference';
import type { SeriesDecl } from './Series';

export type SymbolType =
  'number' | 'integer' | 'string' | 'boolean' | 'enum' | 'collection' | 'array';

interface Symbol {
  id: string;
  name: string;
  definition: string;
  type: SymbolType;
  unit: string;
  latex: string;
  values: string[];
  /** Series shape (axes + cell) when the symbol holds a series of readings. */
  series: SeriesDecl | null;
  ref: Reference[];
}

export default Symbol;

export type ResolvableSymbol = Resolvable<Symbol, 'ref'>;
