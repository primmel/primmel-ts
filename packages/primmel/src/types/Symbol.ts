import Resolvable from './Resolvable';
import Reference from './Reference';
import type { SeriesDecl } from './Series';
import type { SourceRef } from './Subject';

export type SymbolType =
  'number' | 'integer' | 'string' | 'boolean' | 'enum' | 'collection' | 'array';

/** Inline formula declaration (display form + executable expression). */
export interface SymbolFormula {
  display: string;
  expression: string;
  inputs: string[];
}

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
  /** Symbol role: attribute | formula | observable (free string). */
  kind: string;
  /** Quantity kind (e.g. mass, volume-fraction). */
  quantityKind: string;
  /** measured | derived | declared (free string). */
  origin: string;
  /** Legacy identifier from the source document. */
  legacyId: string;
  /** Attribute id this symbol is bound to. */
  attribute: string;
  /** Calculation id deriving this symbol. */
  calculation: string;
  /** Profile name this symbol resolves through. */
  profile: string;
  /** Structured source provenance (the `reference` relation stays separate). */
  sourceRef: SourceRef | null;
  /** All structured provenance bindings (the repeated-block channel). */
  sourceRefs?: SourceRef[];
  /** Inline formula declaration. */
  formula: SymbolFormula | null;
  /** Free-text editorial notes (repeatable). */
  notes: string[];
  ref: Reference[];
  /** The unified typed references (docs/primmel/18). */
  refs?: import('./Ref').Ref[];
}

export default Symbol;

export type ResolvableSymbol = Resolvable<Symbol, 'ref'>;
