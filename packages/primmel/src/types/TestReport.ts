// ─────────────────────────────────────────────────────────────────────
// The test-report skeleton + the OIML-CS test-report checklist (smart
// TODO.roadmap/40 batch 3; the packages-as-SSOT epic) — two constructs,
// one file (the schemeType.ts precedent).
//
// The skeleton is the rec's evaluation-report structure — sections by
// clause, forms (the entry id IS the form construct id), and
// subsections:
//
//   test_report_skeleton r60-3/test-report {
//     title "OIML R 60 Type Evaluation Report"
//     description "…"
//     note "…"                             # optional (the r91 stub)
//     section 4 {                          # the clause token
//       title "Evaluation Report"
//       description "…"
//       form r60-3/sec-4.1 {               # id = the form construct (C140)
//         file "04-01-authority-info"      # the generated-file stem — NOT derivable from the id
//         title "Issuing Authority"
//         required always                  # always|conditional (parse-enforced)
//       }
//       form r60-3/sec-4.3.2-b {
//         file "04-03-02-b-performance-digital"
//         title "Summary of Performance Test Results (Digital)"
//         required conditional             # ⇒ applicability or notes (C140, warning)
//         applicability { technology: [digital, digital-with-processing] }
//       }
//       subsection "Base Metrological Tests" {
//         description "…"
//         form r60-3/table-6.5 {
//           file "load-cell-errors"
//           title "…"
//           conformance_test /conf/metrological-tests/measurement-error-repeatability-mdlo
//           requirements { /req/metrological/mpe }
//           required always
//         }
//       }
//     }
//   }
//
// The checklist is PD-05 §4.4.3's 18-element (a–r) required-content
// register, single-sourced in the oiml-cs package with the rec packages
// overlaying the four composition-point entries' rec-bound
// source/validation strings (the B3.1 deep merge — entry scalars land
// in place, the base order survives):
//
//   test_report_checklist oiml-cs-trf {    # the oiml-cs package
//     entry sample_identification {
//       element "h"
//       description "Specific samples tested, including their identification"
//       obligation shall                   # shall|may (parse-enforced)
//     }
//   }
//   # a rec package:
//   test_report_checklist oiml-cs-trf {
//     overlay true
//     entry sample_identification { validation "form_contains('04-07-sample-selection')" }
//   }
//
// C140 test-report-skeleton-references: the form entry id → the form
// construct, conformance_test → conformance_test, requirements →
// requirement (all per-register gated — the smart R29/R35 mirrors);
// required conditional ⇒ applicability or notes present (warning).
// C141 checklist-entry-shape: the element letter ∈ a–r (check-time
// WARNING — PD-05's element count can grow), the entry ids unique per
// checklist, and an overlay entry must name an upstream entry id (the
// orphan-overlay error — the census's R2 residue failure mode). The
// source/validation strings are engine expressions — documentary,
// never resolved.
// ─────────────────────────────────────────────────────────────────────

import type { ApplicabilityEntry } from './Form';

/** One form entry of a skeleton section (or subsection). */
export interface TestReportFormEntry {
  /** The form construct id (e.g. r60-3/sec-4.1 — C140). */
  id: string;
  /** The generated-file stem — NOT derivable from the id. */
  file: string;
  title: string;
  /** The binding conformance_test id ('' when unstated — C140). */
  conformanceTest: string;
  /** The binding requirement ids (C140). */
  requirements: string[];
  /** always | conditional (parse-enforced; '' when unstated). */
  required: string;
  /** The conditional-inclusion rule ([] when unconditional). */
  applicability: ApplicabilityEntry[];
  /** The documentary note ('' when unstated). */
  notes: string;
}

/** A titled subsection of a skeleton section. */
export interface TestReportSubsection {
  /** The subsection title (the heading — subsections carry no id). */
  title: string;
  description: string;
  applicability: ApplicabilityEntry[];
  forms: TestReportFormEntry[];
}

/** A clause-keyed skeleton section. */
export interface TestReportSection {
  /** The clause token (e.g. `4`). */
  id: string;
  title: string;
  description: string;
  forms: TestReportFormEntry[];
  subsections: TestReportSubsection[];
}

export interface TestReportSkeleton {
  /** e.g. `r60-3/test-report`. */
  id: string;
  title: string;
  description: string;
  /** The documentary note ('' when unstated — the r91 stub's facet). */
  note: string;
  sections: TestReportSection[];
}

/** One checklist entry. Every facet is NULL when unstated (never '')
 *  — the overlay deep merge reads null as "the overlay does not name
 *  this key" and keeps the base value. */
export interface TestReportChecklistEntry {
  id: string;
  /** The PD-05 element letter (a–r today; C141 warns outside — the
   *  element count can grow). */
  element: string | null;
  description: string | null;
  /** shall | may (parse-enforced when present). */
  obligation: string | null;
  /** The note qualifying the description (the may-entry's). */
  descriptionNote: string | null;
  /** The engine-expression source — documentary, never resolved. */
  source: string | null;
  /** The engine-expression validation — documentary, never resolved. */
  validation: string | null;
}

export interface TestReportChecklist {
  /** e.g. `oiml-cs-trf`. */
  id: string;
  /** The deep-merge overlay marker (B3.1; consumed by composition). */
  overlay: boolean;
  entries: TestReportChecklistEntry[];
}
