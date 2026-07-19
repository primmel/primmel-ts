/**
 * Subject-chain constructs (Primmel v2, gap G1).
 *
 * The MeasuringInstrument taxonomy — what an instrument IS and CAN DO:
 * subject type + variants, classification dimensions, family criteria,
 * model groups ("inner families"), attribute definitions (the INV-2
 * schema layer), capability mixins, behaviors, and operating condition sets.
 *
 * Maps 1:1 to the OIML SMART domain model layer (data/<rec>/model/*.yaml).
 */

export interface SourceRef {
  doc: string;
  clause: string;
}

/** instrument <Id> — the subject type definition (one per Recommendation). */
export interface SubjectVariant {
  id: string;
  definition: string;
}

export interface DimensionValue {
  id: string;
  description: string;
  /** Per-value payload (e.g. n_lc_limits per accuracy class). */
  payload: Record<string, string>;
  /**
   * Category subsumption (TODO.refactor/07): other value ids of THIS
   * dimension this value implies (e.g. R 91 average-speed implies
   * fixed-distance). The applicability engine walks the implication
   * closure when matching; the graph must be acyclic.
   */
  implies: string[];
}

export interface ClassificationDimension {
  id: string;
  label: string;
  scope: string;
  /**
   * single (default): one value per subject. set: the subject holds a
   * value SET (multi-select, e.g. R 144 measurand_components).
   */
  cardinality: string;
  /**
   * Join separator for set-valued dimensions when rendering labels
   * (certificate dimension_labels). Empty = default '+'.
   */
  labelSeparator: string;
  description: string;
  source: SourceRef | null;
  values: DimensionValue[];
}

export interface ModelGroupDef {
  definition: string;
  identicalCharacteristics: string[];
  identicalAttributes: string[];
}

export interface Instrument {
  id: string;
  extends: string;
  definition: string;
  variants: SubjectVariant[];
  dimensions: ClassificationDimension[];
  /**
   * Channel dimension id (a dimension with cardinality set, e.g.
   * measurand_components). When declared, requirements marked
   * `channel <id>` are verified PER SELECTED VALUE of the channel
   * (evaluation config per_channel in data/schemas/evaluation-dimensions.yaml).
   */
  perChannel: string;
  familyCriteria: string[];
  familyDefaultDimensions: string[];
  familyDefaultParameters: string[];
  modelGroup: ModelGroupDef | null;
  referenceIds: string[];
}

/** attribute_definition <id> — define an attribute ONCE (INV-2). */
export interface AttributeDefinition {
  id: string;
  symbol: string;
  name: string;
  definition: string;
  source: SourceRef | null;
  quantityKind: string;
  unit: string;
  valueType: string;
  origin: string;
  scope: string;
  category: string;
  isDimension: boolean;
  enumRef: string;
  /** Inline enum values (when the attribute defines its own axis). */
  enumValues?: string[];
  /** Free-text editorial note (rationale, provenance). */
  note?: string;
  irdi: string;
  derived: string;
  referenceIds: string[];
}

/** capability <id> — mixin: what the instrument CAN do (OCP mechanism). */
export interface Capability {
  id: string;
  label: string;
  description: string;
  abstract: boolean;
  extends: string[];
  requires: string[];
  hasParameters: string[];
  satisfiesRequirements: string[];
  verifiedByTests: string[];
  referenceIds: string[];
}

/** behavior <id> — a response characteristic requirements bind to. */
export interface Behavior {
  id: string;
  kind: string;
  stimulus: string;
  response: string;
  source: SourceRef | null;
  verifiedBy: string[];
  referenceIds: string[];
}

/** condition_set <id> — one operating-condition tier (reference/rated/limiting). */
export interface ConditionEntry {
  quantityKind: string;
  value: string;
  unit: string;
  tolerance: string;
}

export interface ConditionSet {
  id: string;
  role: string;
  entries: ConditionEntry[];
  referenceIds: string[];
}
