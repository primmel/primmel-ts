// ─────────────────────────────────────────────────────────────────────
// The certificate template (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — the rec's certificate RENDERING contract:
// the number format, the dimension-label pattern, the explicit
// characteristic rows (twin-cert today; the recs project their
// characteristic list from the verified promises' certificate print
// projections instead — the two shapes coexist), and the Additional
// National Requirements section labels (TODO.adoption/11):
//
//   certificate_template certificate {        # singleton per package
//     number_format "{shortName}/{edition}-{scheme}-{authority}-{year2}.{seq}"
//     dimension_labels {
//       pattern "{measurand_components}-{measuring_principle}"
//       separator "+"                        # optional; joins set-valued dims
//     }
//     characteristic e_max {
//       type quantity                        # string|integer|number|quantity|statement (C136)
//       label "E_max values"
//       attribute e_max                      # XOR attribute | attributes {…} | dimension | none
//       obligation mandatory                 # mandatory|optional (parse-enforced)
//     }
//     anr_section {
//       title "Additional National Requirements"
//       covered_label "Evaluated"
//       not_evaluated_label "Not evaluated in this evaluation"
//       pending_label "Pending evaluation"
//       none_targeted_note "No additional national requirements were targeted by the application."
//     }
//   }
//
// The characteristic `type` vocabulary is renderer-driven and stays
// parse-TOTAL (the codec never rejects a growing renderer) — C136
// carries the closed-set check at ERROR (the owner-settled decision).
// Localized labels: the default spelling inline here, alternates ride
// the l10n `text` blocks (the term/form precedent).
//
// C136 certificate-template-references: the dimension_labels pattern
// placeholders ({dim} / {dim:sep}) resolve to declared classification
// dimensions; the characteristic bindings resolve (per-register gated)
// with the XOR shape leg; the number_format placeholders check against
// the known token vocabulary at WARNING (open for program-specific
// prefixes like twin-cert's literal TW-1).
// ─────────────────────────────────────────────────────────────────────

/** The dimension-label pattern block. */
export interface CertificateDimensionLabels {
  /** The render pattern; placeholders `{dim}` or `{dim:sep}`. */
  pattern: string;
  /** The set-valued-dimension join separator ('' = the renderer default). */
  separator: string;
}

/** One explicit characteristic row of the certificate. */
export interface CertificateCharacteristic {
  /** The row's name (the characteristic id). */
  id: string;
  /** string | integer | number | quantity | statement (parse-total;
   *  the closed set is C136's). */
  type: string;
  /** The default-spelling label. */
  label: string;
  /** The single-attribute binding ('' when unused — XOR, C136). */
  attribute: string;
  /** The multi-attribute binding ([] when unused — XOR, C136). */
  attributes: string[];
  /** The dimension binding ('' when unused — XOR, C136). */
  dimension: string;
  /** mandatory | optional (parse-enforced; '' when unstated). */
  obligation: string;
}

/** The Additional National Requirements section labels (TODO.adoption/11). */
export interface CertificateAnrSection {
  title: string;
  coveredLabel: string;
  notEvaluatedLabel: string;
  pendingLabel: string;
  noneTargetedNote: string;
}

export default interface CertificateTemplate {
  /** Conventionally `certificate` (singleton per package). */
  id: string;
  /** The certificate-number format pattern ('' when unstated). */
  numberFormat: string;
  /** The dimension-label pattern block (null when unstated). */
  dimensionLabels: CertificateDimensionLabels | null;
  /** The explicit characteristic rows, in declared order. */
  characteristics: CertificateCharacteristic[];
  /** The ANR section labels (null when unstated). */
  anrSection: CertificateAnrSection | null;
}
