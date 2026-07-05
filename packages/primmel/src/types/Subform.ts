import Resolvable from './Resolvable';
import type { FormField } from './Form';

export interface ParameterMapping {
  [key: string]: string | number;
}

export interface ParameterDecl {
  name: string;
  type: string;
  description: string;
  hasDefault: boolean;
  defaultValue: string;
  mapping: ParameterMapping | null;
}

/**
 * A subform is a parameterized row shape that can be composed into multiple
 * parent forms via `subform_ref`. Placeholders `${{ name }}` in field
 * properties are substituted at composition time.
 *
 * See Primmel spec MN 113-7 §5 (Subforms).
 */
interface Subform {
  id: string;
  description: string;
  shapeType: 'object' | 'array';
  parameters: ParameterDecl[];
  fields: FormField[];
}

export default Subform;

export type ResolvableSubform = Resolvable<Subform, never>;
