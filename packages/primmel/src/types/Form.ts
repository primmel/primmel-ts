import Resolvable from './Resolvable';
import Reference from './Reference';

export interface ApplicabilityEntry {
  dimension: string;
  values: string[];
  // Optional mapping for parameter resolution (e.g., accuracy_class → n_runs)
  mapping: Record<string, string | number> | null;
}

export interface CalculationBinding {
  inputName: string;
  pathExpr: string;
}

export interface EvaluationRule {
  rule: string;
  condition: string;
  referenceId: string | null;
}

export interface FormField {
  name: string;
  type: string;
  label: string;
  definition: string;
  unit: string;
  required: boolean;
  measurementMethod: string;
  calculationId: string | null;
  calculationBindings: CalculationBinding[];
  derivation: string;
  evaluation: EvaluationRule | null;
  values: string[];
  defaultValue: string;
  hasDefault: boolean;
  referenceIds: string[];
  // Nested object/array shape
  fields: FormField[];
  itemsType: string;
  // Subform reference (when this field composes a subform)
  subformRef: SubformRef | null;
}

export interface SubformRef {
  subformId: string;
  parameters: Record<string, string>;
  applicability: ApplicabilityEntry[];
}

export interface PassFail {
  criteria: string;
  passIf: string;
}

/**
 * A form is a declarative data-capture schema. Form fields can invoke
 * calculations, reference symbols, and compose subforms via `subform_ref`.
 *
 * See Primmel spec MN 113-7 §2 (Form syntax).
 */
interface Form {
  id: string;
  name: string;
  description: string;
  dataClassId: string;
  headerFormId: string;
  conformanceProcessId: string;
  applicability: ApplicabilityEntry[];
  fields: FormField[];
  passFail: PassFail | null;
  referenceIds: string[];
  ref: Reference[];
}

export default Form;

export type ResolvableForm = Resolvable<Form, 'ref'>;
