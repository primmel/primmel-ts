// ─────────────────────────────────────────────────────────────────────
// The promise set (smart TODO.roadmap/40 batch 3; the packages-as-SSOT
// epic) — the rec's promise REGISTER as a file-grade construct. The
// subject's is.promises block cannot span files (a same-id subject
// redeclaration in one package overwrites; mergeSubject is the
// extends-chain merge only), so the 46 rec promise registers
// (payload/promises.yaml, the verbatim-payload codec exclusion this
// construct retires) need their own file-level home:
//
//   promise_set loadcell {                 # id = the owning subject
//     promise e_max_values {
//       target e_max
//       statement "Maximum capacity E_max per model — …"
//       certificate {                      # the print projection (C131)
//         attribute e_max                  # XOR attribute | attributes
//                                          # {…} | dimension | none
//         type string
//         label "E_max values"
//         obligation mandatory             # mandatory | optional —
//                                          # parse-enforced
//       }
//       source { doc "urn:oiml:pub:r:60-1:2021" clause "3.5.5" }
//     }
//   }
//
// The promise sub-grammar is the subject's OWN (readPromiseEntry /
// dumpPromiseEntry, config/subject.ts) reused verbatim — level,
// conditions, verified_by and all. C42–C44 fire on the set's entries
// exactly as on subject promises (the set id binds the subject;
// characteristic resolution gates on that subject composing — the C58
// doctrine). C131 checks the certificate projection.
// ─────────────────────────────────────────────────────────────────────

import type { SubjectPromise } from './Subject';

export default interface PromiseSet {
  /** The owning subject's id (the set binds the subject). */
  id: string;
  /** The register's promises (the subject-promise sub-grammar). */
  promises: SubjectPromise[];
}
