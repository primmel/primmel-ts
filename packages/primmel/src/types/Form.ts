import Resolvable from './Resolvable';
import Reference from './Reference';
import type { SeriesDecl } from './Series';
import type SourceDiscrepancy from './SourceDiscrepancy';
import type { SourceRef } from './Subject';

export interface ApplicabilityEntry {
  dimension: string;
  values: string[];
  // Optional mapping for parameter resolution (e.g., accuracy_class → n_runs)
  mapping: Record<string, string | number> | null;
  /**
   * Declared-condition match mode for set-cardinality dimensions
   * (rc.yaml $defs/applicability): 'any' (default — existential) or
   * 'all' (universal — every selected value must be listed).
   */
  match: 'any' | 'all' | null;
}

export interface CalculationBinding {
  inputName: string;
  pathExpr: string;
}

export interface EvaluationRule {
  rule: string;
  condition: string;
  referenceId: string | null;
  /** Canonical verdict reference (verdict registry id). */
  verdict?: string;
  /** Comparison applied between the derived value and the limit. */
  op?: string;
  /** Limit predicate, ocl{...}. */
  limit?: string;
  /** Free-text source clause citation (e.g. "R 60-1, 5.7.2.6"). */
  specificationReference?: string;
  sourceDiscrepancy?: SourceDiscrepancy | null;
}

/** Role-grouped source reference (e.g. role requirement → clause URNs). */
export interface RoleReference {
  urn: string;
  role: string;
}

export interface FormField {
  name: string;
  type: string;
  /** True when the field head explicitly declared its type (`: string` included). */
  typeDeclared?: boolean;
  label: string;
  definition: string;
  /** Free-text description (distinct from the formal definition). */
  description?: string;
  unit: string;
  /** Binding path into the subject chain (v2 G5), e.g. model.parameters.e_max */
  bind?: string;
  /** Symbol id this field captures. */
  symbol: string;
  /** Canonical verdict id this field is judged by. */
  verdict: string;
  /** Requirement ids this field provides evidence for. */
  targets: string[];
  /** Classification dimension this field captures a value of. */
  dimension: string;
  /** Enum id when the field's values come from a declared enum. */
  enumRef: string;
  /** Regex validation pattern. */
  pattern: string;
  /** Field scope (e.g. administrative). */
  scope?: string;
  /** Example values shown as entry guidance. */
  examples?: string;
  required: boolean;
  measurementMethod: string;
  calculationId: string | null;
  calculationBindings: CalculationBinding[];
  derivation: string;
  evaluation: EvaluationRule | null;
  /** Allowed values; entries may carry a display label ({ value, label }). */
  values: Array<string | { value: string; label: string }>;
  /** Labels for boolean fields. */
  trueLabel: string;
  falseLabel: string;
  /** Inline enum values (when the field defines its own axis).
   *  Entries may carry a display label ({ value, label }). */
  enumValues: Array<string | { value: string; label: string }>;
  defaultValue: string;
  hasDefault: boolean;
  referenceIds: string[];
  /** Role-grouped source reference URNs. */
  fieldReferences: RoleReference[];
  /** Free-text source clause citation (e.g. "R 144-1, 4.5.2"). */
  specificationReference: string;
  /** Classification applicability filter (dimension → allowed values). */
  applicability: ApplicabilityEntry[];
  sourceDiscrepancy: SourceDiscrepancy | null;
  // Nested object/array shape
  fields: FormField[];
  itemsType: string;
  /** Unit of the array element type (items { <type> unit "…" }). */
  itemsUnit?: string;
  /** Series shape (axes + cell) when this datalist field holds a series. */
  series?: SeriesDecl | null;
  /** Array cardinality bounds (optional; parsed from min_items/max_items).
   *  A non-numeric bound (e.g. the template "${{ n_runs }}") is kept verbatim. */
  minItems?: number | string | null;
  maxItems?: number | string | null;
  // Subform reference (when this field composes a subform)
  subformRef: SubformRef | null;
}

export interface SubformRef {
  subformId: string;
  parameters: Record<string, string>;
  applicability: ApplicabilityEntry[];
}

/** One derived value rule inside a pass_fail block. */
export interface PassFailDerivation {
  name: string;
  calculation: string;
  forEach: string;
  unit: string;
}

export interface PassFail {
  criteria: string;
  passIf: string;
  /** Derived-value rules feeding the pass_if expression. */
  derivations: PassFailDerivation[];
}

/** Form calculation context (shared header + dimensions + tables). */
export interface FormCalculationContext {
  header: string;
  dimensions: boolean;
  tables: string[];
}

/** A named form instance (e.g. "on the load cell"). */
export interface FormInstance {
  id: string;
  name: string;
}

/** A machine-checked form-level constraint. */
export interface FormConstraint {
  id: string;
  rule: string;
  onViolation: string;
  notes: string;
  source: SourceRef | null;
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
  /** Multiple conformance processes (forms covering several tests). */
  conformanceProcessIds?: string[];
  /** Grouping section (report structure). */
  section: string;
  /** Requirement ids this form provides evidence for. */
  requirements: string[];
  /** Free-text editorial notes (repeatable). */
  formNotes: string[];
  /** Form scope (e.g. administrative). */
  scope: string;
  /** Report-table row vocabulary (report-table forms). */
  reportRows?: { field: string; itemKey: string };
  /** Role-grouped source reference URNs. */
  formReferences: RoleReference[];
  /** Calculation context for evaluated fields. */
  calculationContext: FormCalculationContext | null;
  /** Named form instances. */
  formInstances: FormInstance[];
  /** Machine-checked form-level constraints. */
  formConstraints: FormConstraint[];
  applicability: ApplicabilityEntry[];
  fields: FormField[];
  passFail: PassFail | null;
  referenceIds: string[];
  ref: Reference[];
}

export default Form;

export type ResolvableForm = Resolvable<Form, 'ref'>;
