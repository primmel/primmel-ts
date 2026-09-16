// ─────────────────────────────────────────────────────────────────────
// The common test condition (smart TODO.roadmap/40 batch 4; the
// packages-as-SSOT epic) — the model-wide test-conditions register
// (r60: 18 entries, r144: 9, r129: 1; the r91 keyed-map form flattens
// to entries, map key → id), one construct per entry:
//
//   common_test_condition test_equipment {
//     title "Test equipment"
//     reference "urn:oiml:pub:r:60-2:2021#clause-2.7.2"
//     description "Test equipment used for the tests shall be
//                 calibrated and traceable to …"
//   }
//
// The `reference` urn#clause string stays a FREE quoted citation scalar
// (the citation-string precedent) — no doc-URN splitting; the app-side
// linker owns the citation semantics (its coverage oracle consumes the
// register per condition). The optional source {} block carries the
// clause-URN provenance (the r91 entries' per-entry source).
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';

export default interface CommonTestCondition {
  /** Snake-case condition id (test_equipment). */
  id: string;
  /** The condition's title. */
  title: string;
  /** The free citation string (urn#clause form; '' = undeclared). */
  reference: string;
  /** The condition's normative text. */
  description: string;
  /** Clause-URN provenance (null = undeclared; the r91 keyed-map
   *  entries carry a per-entry source { doc, clause }). */
  source?: SourceRef | null;
}
