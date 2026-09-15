// ─────────────────────────────────────────────────────────────────────
// The ISO/IEC 17067 scheme-type register (smart TODO.roadmap/40 batch 2;
// the packages-as-SSOT epic) — the Table-1 activity menus and the seven
// scheme types:
//
//   scheme_activity_kind testing {
//     family determination             # common | determination |
//                                      # attestation | surveillance
//     row "II a)"
//     label "testing (of product items …)"
//     source { doc "urn:iso-iec:…:17067:2013" clause "5.2" }
//   }
//
//   scheme_type type_5 {
//     label "scheme type 5"
//     clause "5.3.7"
//     description "The surveillance part of this scheme allows …"
//     sampling "Surveillance samples are taken periodically …"
//     attestation_object ongoing_production
//     determination { testing inspection … }
//     attestation { issue_statement … }
//     surveillance {
//       required true
//       activities { market_sampling factory_sampling … }
//     }
//     notes { "If the surveillance includes audit of the …" }
//     source { doc "…" clause "5.3.7" }
//   }
//
// The `family` and `attestation_object` vocabularies are parse-enforced
// (the fail-closed precedent — the dataspace/policy vocabularies); the
// menu memberships and the manifest's `scheme_type` token resolve at
// check time against the composed register (C122 scheme-type-resolves,
// per-register gated — the C58 doctrine), and C98's hard-coded
// no-surveillance set defers to the register's surveillance.required
// when the register is in scope (the register-free fallback stays). The
// codecs stay total.
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';

/** The Table-1 menu families (ISO/IEC 17067:2013, 5.2). */
export type SchemeActivityFamily =
  'common' | 'determination' | 'attestation' | 'surveillance';

/** One activity-kind entry of the ISO/IEC 17067 Table-1 menus. */
export interface SchemeActivityKind {
  /** Snake-case kind id (testing, issue_statement, market_sampling). */
  id: string;
  /** The menu the entry belongs to. */
  family: SchemeActivityFamily;
  /** The Table-1 row anchor (e.g. "II a)"); '' = none. */
  row: string;
  /** The activity's label as Table 1 states it. */
  label: string;
  /** Clause-URN provenance (doc + clause). */
  source: SourceRef;
}

/** The attestation objects of ISO/IEC 17067 Table 1. */
export type AttestationObject =
  'product_type' | 'batch' | 'ongoing_production' | 'service_or_process';

/** The surveillance facet of a scheme type (Table 1, column V). */
export interface SchemeSurveillance {
  /** Whether the scheme type requires surveillance. */
  required: boolean;
  /** The surveillance activity kinds (→ scheme_activity_kind, C122). */
  activities: string[];
}

/** One scheme type of the ISO/IEC 17067 register (5.3.2–5.3.8). */
export default interface SchemeType {
  /** The type id (type_1a … type_6). */
  id: string;
  /** The type's label ("scheme type 5"). */
  label: string;
  /** The defining clause (5.3.2–5.3.8). */
  clause: string;
  /** The type's description. */
  description: string;
  /** The sampling statement ('' = none). */
  sampling: string;
  /** The object the attestation covers ('' = undeclared). */
  attestationObject: AttestationObject | '';
  /** The determination activity kinds (→ scheme_activity_kind, C122). */
  determination: string[];
  /** The attestation activity kinds (→ scheme_activity_kind, C122). */
  attestation: string[];
  /** The surveillance facet (null = the type carries none). */
  surveillance: SchemeSurveillance | null;
  /** The type's notes. */
  notes: string[];
  /** Clause-URN provenance (doc + clause). */
  source: SourceRef;
}
