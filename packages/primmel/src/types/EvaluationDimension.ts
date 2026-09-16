// ─────────────────────────────────────────────────────────────────────
// The evaluation dimensions register (smart TODO.roadmap/40 batch 3;
// the packages-as-SSOT epic) — the form-facing classification field
// schema (the dimension selector on the classification form; the fields
// seed the calculation context), first-class what
// evaluation-dimensions.yaml carries today:
//
//   evaluation_dimensions evaluation {      # singleton per rec
//     label "Type of Testing"
//     field technology {
//       label "Technology"
//       type string                   # integer | number | string | text |
//                                     # boolean | date — parse-enforced
//       enum technology               # → classification dimension (C134)
//       required true
//       editable false
//       setting MUST                  # MUST | SHALL | RECOMMEND | SHOULD |
//                                     # MAY | OPTIONAL — parse-enforced
//       multiple true                 # multi-select (r144)
//     }
//   }
//
// The name-vs-enum split is load-bearing: the field key is the
// form-facing name (an is_dimension attribute id — or r129's legacy
// camelCase, carried as-is per the owner decision) while `enum` names
// the classification dimension supplying the value space (r60's
// humidity_symbol field refs humidity_class). C134 resolves both,
// independently.
//
// `per_channel` gets NO facet here (the owner-settled single home):
// kernel `Instrument.perChannel` carries it, and the YAML projection
// derives evaluation_dimensions.per_channel from the instrument.
// The schema-declared-but-unused facets (unit, enum_values, default)
// get no PRL facet (the union rule).
// ─────────────────────────────────────────────────────────────────────

/** One form-facing classification field. */
export interface EvaluationDimensionField {
  /** The field name (an is_dimension attribute id, or r129's legacy
   *  camelCase — C134 accepts either resolution, warning when neither). */
  id: string;
  /** The UI label. */
  label: string;
  /** integer | number | string | text | boolean | date (parse-enforced;
   *  '' = undeclared). */
  type: string;
  /** The classification dimension supplying the value space (→
   *  dimension; C134; '' = undeclared). */
  enumRef: string;
  /** Whether the user must set this field. */
  required: boolean;
  /** Whether the field is locked once set. */
  editable: boolean;
  /** MUST | SHALL | RECOMMEND | SHOULD | MAY | OPTIONAL (the MMEL
   *  importance; parse-enforced; '' = undeclared). */
  setting: string;
  /** Multi-select (the r144 measurand_components shape). */
  multiple: boolean;
}

export default interface EvaluationDimensions {
  /** Conventionally `evaluation` (singleton per rec). */
  id: string;
  /** The register's file-level label ("Type of Testing"). */
  label: string;
  /** The fields, in declared order. */
  fields: EvaluationDimensionField[];
}
