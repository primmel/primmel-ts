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

import type { QuantityValue } from './Quantity';
import type { ApplicabilityEntry } from './Form';
import type { Endpoint, ServeBinding } from './Twin';
import type { CompositionDecl } from './Composition';

export interface SourceRef {
  doc: string;
  clause: string;
  /** Optional sentence sub-address (TODO.roadmap/26 — `fragment "s1"` →
   *  the sentence address urn:…#clause-2.2/s1, the reserved finer
   *  address space of the .prd fragment grammar). */
  fragment?: string;
}

/** instrument <Id> — the subject type definition (one per Recommendation). */
export interface SubjectVariant {
  id: string;
  /** Display name (e.g. "Digital load cell"). */
  name?: string;
  definition: string;
  /** Free-text editorial note. */
  note?: string;
  source?: SourceRef | null;
}

export interface DimensionValue {
  id: string;
  /** Display label of the value (certificate classification labels). */
  label: string;
  description: string;
  /**
   * Per-value payload (e.g. n_lc_limits per accuracy class). Values are
   * scalars, or nested blocks (e.g. n_lc_limits { lower: 50000 upper: unlimited }).
   */
  payload: Record<string, string | Record<string, string>>;
  /**
   * Category subsumption (TODO.refactor/07): other value ids of THIS
   * dimension this value implies (e.g. R 91 average-speed implies
   * fixed-distance). The applicability engine walks the implication
   * closure when matching; the graph must be acyclic.
   */
  implies: string[];
  /**
   * Id of the term in the Recommendation's terminology.yaml that defines
   * this value (TODO.refactor/13 R17 — terminology cross-link).
   */
  termRef?: string;
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
  /** Dimension whose values partition the family into groups. */
  groupBy?: string;
  /** Free-text editorial note. */
  note?: string;
  /** Source provenance entries. */
  sources?: SourceRef[];
  /** Sample-selection provenance (clause refs). */
  sampleSelection?: SourceRef[];
}

/**
 * First-class measurand block (TODO.roadmap/19, gap audit G8 — the
 * metamodel Measurand class): the VIM 2.3 measurand with its measurement
 * CONTEXT when the measurand is a property of another object than the
 * instrument (R 91: the speed of a remote vehicle, identified per
 * R 91-1, 6.6). `measurand_kind` stays as the shorthand form.
 */
export interface InstrumentMeasurand {
  kind: string;
  description: string;
  context: {
    targetObject: string;
    identificationMethod: string;
  } | null;
  source: SourceRef | null;
}

/**
 * A domain-profile component class (metamodel v0.6.0 Structure target;
 * TODO.roadmap/19, gap audit G3) — e.g. R 91's ego_speed_meter (itself a
 * SpeedMeter) or detection_field (a profile-specific class).
 */
export interface InstrumentComponent {
  id: string;
  classId: string;
  definition: string;
  source: SourceRef | null;
}

/**
 * A Structure relation (metamodel v0.6.0 Structure; TODO.roadmap/19, gap
 * audit G3): designed composition of the subject — partOf / consists_of /
 * connectsTo with a typed target and propagation rules declaring what
 * travels across the link (down = whole → parts, up = part → whole).
 */
export interface StructureEntry {
  id: string;
  predicate: string;
  /** The whole / source end — a subject type id or variant id. */
  subject: string;
  /** Typed target — a component id or a subject type. */
  target: string;
  /** Optional dimension filter when the relation holds only for a category. */
  applicability: ApplicabilityEntry[];
  propagation: Array<{ property: string; direction: string }>;
  note: string;
  source: SourceRef | null;
}

export interface Instrument {
  id: string;
  extends: string;
  /** The unified typed references (docs/primmel/18). */
  refs?: import('./Ref').Ref[];
  /** The correspondence annotations (MN 114 v3.1, clause 19.4). */
  correspondences?: import('./Correspondence').Correspondence[];
  sourceRefs?: import('./Subject').SourceRef[];
  /** Measurand kind the instrument measures (e.g. force). */
  measurandKind?: string;
  /**
   * First-class measurand block with measurement context (TODO.roadmap/19,
   * gap audit G8) — the measurand-on-another-object form.
   */
  measurand?: InstrumentMeasurand | null;
  definition: string;
  /** Free-text editorial note. */
  note?: string;
  /** Source provenance of the instrument definition. */
  source?: SourceRef | null;
  variants: SubjectVariant[];
  dimensions: ClassificationDimension[];
  /**
   * Channel dimension id (a dimension with cardinality set, e.g.
   * measurand_components). When declared, requirements marked
   * `channel <id>` are verified PER SELECTED VALUE of the channel
   * (evaluation config per_channel in data/schemas/evaluation-dimensions.yaml).
   */
  perChannel: string;
  /** Domain-profile component classes (Structure targets; TODO.roadmap/19, G3). */
  components: InstrumentComponent[];
  /** Structure relations — designed composition (TODO.roadmap/19, G3). */
  structure: StructureEntry[];
  /** Metamodel class the family instantiates (e.g. MeasuringInstrumentModelFamily). */
  familyMetamodelClass?: string;
  /** Family definition text. */
  familyDefinition?: string;
  /** Free-text editorial note on the family. */
  familyNote?: string;
  /** Source provenance of the family definition. */
  familySource?: SourceRef | null;
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
  /**
   * Whether the attribute is a classification-dimension mirror.
   * null = undeclared (the source omits the flag entirely).
   */
  isDimension: boolean | null;
  enumRef: string;
  /** Inline enum values (when the attribute defines its own axis). */
  enumValues?: string[];
  /** Free-text editorial note (rationale, provenance). */
  note?: string;
  irdi: string;
  derived: string;
  referenceIds: string[];
  /** All provenance bindings (docs/primmel/18 §18.4 — the derives-from
   *  fold target; `source` stays the first entry). */
  sourceRefs?: SourceRef[];
  /** The unified typed references (docs/primmel/18) — semantic
   *  predicates stay here; citation kinds fold onto source/referenceIds. */
  refs?: import('./Ref').Ref[];
  /** The correspondence annotations (MN 114 v3.1, clause 19.4) — the
   *  generalization of this element's `irdi` facet to every scheme. */
  correspondences?: import('./Correspondence').Correspondence[];
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
  /** The unified typed references (docs/primmel/18) — citation kinds
   *  fold onto referenceIds; the rest stay here. */
  refs?: import('./Ref').Ref[];
  /** The correspondence annotations (MN 114 v3.1, clause 19.4). */
  correspondences?: import('./Correspondence').Correspondence[];
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
  /** All provenance bindings (docs/primmel/18 §18.4 — the derives-from
   *  fold target; `source` stays the first entry). */
  sourceRefs?: SourceRef[];
  /** The unified typed references (docs/primmel/18) — semantic
   *  predicates stay here; citation kinds fold onto source/referenceIds. */
  refs?: import('./Ref').Ref[];
  /** The correspondence annotations (MN 114 v3.1, clause 19.4). */
  correspondences?: import('./Correspondence').Correspondence[];
}

/** condition_set <id> — one operating-condition tier (reference/rated/limiting). */
export interface ConditionEntry {
  quantityKind: string;
  value: string;
  unit: string;
  tolerance: string;
  /** Free-text provenance/usage note for the entry. */
  note?: string;
}

export interface ConditionSet {
  id: string;
  role: string;
  /** Subject type the conditions apply to (defaults to the instrument). */
  subject?: string;
  /** Free-text description of the set. */
  description?: string;
  entries: ConditionEntry[];
  /** Structured provenance (doc URN + clause) — first of `sources`. */
  source?: SourceRef | null;
  /** All provenance entries (a set may cite several clauses). */
  sources?: SourceRef[];
  referenceIds: string[];
  /** The unified typed references/relations (spec: docs/primmel/18) —
   *  semantic predicates stay here; citation kinds fold onto
   *  sources/referenceIds. */
  refs?: import('./Ref').Ref[];
  /** The correspondence annotations (MN 114 v3.1, clause 19.4). */
  correspondences?: import('./Correspondence').Correspondence[];
}

// ─────────────────────────────────────────────────────────────────────
// Subject anatomy (Primmel v3, TODO.roadmap/01): the `subject` construct
// organized by the three aspect families is / has / does.
//
// A subject declaration answers three questions:
//   is   — what the subject IS (identity/design level: change it and you
//          have a different subject);
//   has  — what it exhibits (observation level: varies across instances
//          and time without changing identity);
//   does — what it does (process level: executable or simulatable).
//
// Cross-references stay string ids (extends, designed_conditions tiers,
// state, does.behaviors); the linter (check.ts C6–C8) validates them.
// Aspect-block contents per family:
//   IS   = metadata, provenance, structure, design_parameters,
//          designed_conditions, promises, artifacts
//   HAS  = attributes, dimensions, state, characteristics,
//          environmental_context, artifact_instances
//   DOES = behavior
// ─────────────────────────────────────────────────────────────────────

/**
 * has.characteristics entry: a symbol'd quantity derived from behavior I/O
 * (TODO.roadmap/10) — the quantitative interface of the subject (doctrine
 * ch. 02 §2.7): DEFINED in the primary model, referenced everywhere else.
 * The map key is the characteristic's id. Two entry forms:
 *   - shorthand: `creep c_c = ocl{…}` (symbol + derivation only);
 *   - block: `<id> { symbol … derivation … behavior … quantity_kind …
 *     unit … source { … } }` — the full register entry: the behavior the
 *     characteristic quantifies (closing the behavior→I/O→characteristic
 *     chain), the quantity kind + unit of the derived value, and clause
 *     provenance.
 * The linter's C48–C50 enforce the one-home rule, the behavior link, and
 * derivation-input resolution.
 */
export interface SubjectCharacteristic {
  symbol: string;
  /** Derivation from behavior I/O (typically ocl{…}); empty = C7 violation. */
  derivation: string;
  /** Id of the declared behavior this characteristic quantifies (C49). */
  behavior?: string;
  /** Quantity kind of the derived value (e.g. mass, dimensionless). */
  quantityKind?: string;
  /** Measurement unit of the derived value; absent for dimensionless. */
  unit?: string;
  /** Clause provenance of the canonical derivation. */
  source?: SourceRef | null;
}

/**
 * The claimed level of a promise (TODO.roadmap/08) — exactly one shape:
 *   quantity — a QuantityValue claim (block form: value + unit, INV-1);
 *   range    — an envelope claim (bounds + shared unit; a bound may be
 *              symbolic, e.g. "unlimited");
 *   symbolic — a symbolic level claim (e.g. accuracy class C6).
 */
export interface PromiseLevel {
  /** 'quantity' | 'range' | 'symbolic'. */
  kind: string;
  /** kind=quantity: the claimed QuantityValue. */
  quantity?: QuantityValue;
  /** kind=range: the lower/upper envelope bound (either may be symbolic). */
  min?: string | number;
  max?: string | number;
  /** kind=range: the shared unit id of the bounds. */
  unit?: string;
  /** kind=symbolic: the claimed symbolic level (e.g. an accuracy class). */
  symbolic?: string;
}

/**
 * is.promises entry (TODO.roadmap/08) — one manufacturer claim on a
 * characteristic or a behavior (doctrine ch. 02 §2.3): possibly
 * envelope-shaped, possibly conditional; the manufacturer binds itself and
 * evaluation verifies. The certificate prints promises-as-verified
 * (ch. 15 §15.2).
 *
 * A promise is NOT a declared attribute value: a claim stated as one bare
 * parameter value ("t_min = −10 °C") stays an `origin: declared` attribute
 * (linter C44 promise-not-bare-value enforces the distinctness).
 */
export interface SubjectPromise {
  /** Block-form entry id; '' for the statement-only shorthand. */
  id: string;
  /**
   * The claimed characteristic (a has.characteristics key of the owning
   * subject) or a declared behavior id. Empty on the statement-only
   * shorthand (linter C43 flags the promise as unverifiable).
   */
  target: string;
  /** The claimed level; null when the claim is prose-only. */
  level: PromiseLevel | null;
  /**
   * OCL over dimensions/conditions gating the claim (envelope claims:
   * "holds class C6 ACROSS the rated range −10…+40 °C"). Empty =
   * unconditional.
   */
  conditions: string;
  /** Prose statement of the claim. */
  statement: string;
  /**
   * Declared verifying requirement/test ids. When absent the linter
   * derives candidates (requirements/tests binding the same target); no
   * verification found or declared warns at authoring (C43).
   */
  verifiedBy: string[];
  /** Clause provenance of the claim. */
  source?: SourceRef | null;
}

/** is { … } — identity/design aspects. */
export interface SubjectIs {
  /** Free-form key/value metadata (name, definition, source, …). */
  metadata: Record<string, string>;
  /** Pedigree key/value pairs (manufacturer, source clauses, …). */
  provenance: Record<string, string>;
  /** Designed composition entries (slot — rich model lands later). */
  structure: string[];
  /** Type-defining values fixed by design: name → qualifier string. */
  designParameters: Record<string, string>;
  /** Designed operating-condition tiers: tier name → condition_set id. */
  designedConditions: Record<string, string>;
  /**
   * Manufacturer claims on characteristics/behavior (TODO.roadmap/08) —
   * rich entries with target/level/conditions/statement/verified_by;
   * the legacy quoted-string form parses as a statement-only promise.
   */
  promises: SubjectPromise[];
  /**
   * Ids of the artifact_definition constructs (types/Artifact.ts,
   * TODO.roadmap/09) declaring the outputs the subject must produce.
   */
  artifacts: string[];
  /**
   * The subject's declared API surface (types/Twin.ts, TODO.roadmap/32 —
   * doctrine ch. 14 §14.4): endpoint declarations nested in `is { … }`
   * (§14.11) — "this product offers this interface" is part of the type
   * definition, like a marking or a software identification (§14.3).
   */
  endpoints: Endpoint[];
  /**
   * The composition facet (types/Composition.ts, TODO.integration/14):
   * a COMPOSITE subject's `composed_of` — the component twins it is
   * made of and the projection decomposition. Absent on non-composite
   * subjects.
   */
  composedOf?: CompositionDecl;
}

/** has { … } — exhibition aspects. */
export interface SubjectHas {
  /** Exhibited named values: name → qualifier string. */
  attributes: Record<string, string>;
  /** Exhibited classification membership: dimension id → value ids. */
  dimensions: Record<string, string[]>;
  /**
   * The subject's operational state MACHINE (`has.state <machineRef>`) —
   * implemented in task 07. This binds the machine, not the current
   * node: the current node is instance-level run data, folded per run by
   * `foldTrajectory` (see operational-state.ts).
   */
  state: string;
  /** Quantities derived from behavior I/O, by name. */
  characteristics: Record<string, SubjectCharacteristic>;
  /** Actual conditions experienced (logged) — free entries. */
  environmentalContext: string[];
  /**
   * Ids of the artifact_instance constructs (types/Artifact.ts,
   * TODO.roadmap/09) — produced outputs recorded as evidence.
   */
  artifactInstances: string[];
  /**
   * serve bindings (types/Twin.ts, TODO.roadmap/32 — doctrine ch. 14
   * §14.4): aspect → endpoint operation bindings with freshness windows.
   * Served values are timestamped; a stale value degrades verdicts to
   * `indeterminate` (§14.5 — never fail, never a silent pass).
   */
  serves: ServeBinding[];
}

/** does { … } — process aspects. */
export interface SubjectDoes {
  /** References to declared `behavior` constructs. */
  behaviors: string[];
}

/**
 * Aspect key found under the wrong family (or undeclared) at parse time.
 * Recorded on the Subject for the linter (C6); never dumped.
 */
export interface MisplacedAspect {
  /** Family block the aspect was found in ('is' | 'has' | 'does'). */
  family: string;
  /** The aspect keyword as written. */
  aspect: string;
}

/** subject <Id> — the v3 subject declaration (anatomy grammar). */
export interface Subject {
  id: string;
  /** Parent subject id (aspect blocks merge per aspect-kind rules). */
  extends: string;
  is: SubjectIs;
  has: SubjectHas;
  does: SubjectDoes;
  referenceIds: string[];
  /** Parse-time lint capture (C6): aspect keys under the wrong family. */
  misplacedAspects: MisplacedAspect[];
}
