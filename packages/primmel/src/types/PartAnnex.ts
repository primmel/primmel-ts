// ─────────────────────────────────────────────────────────────────────
// The part annex (smart TODO.roadmap/40 batch 4; the packages-as-SSOT
// epic) — the rec's OWN annex-volume index (r60 Part 4: annexes A–F),
// a verdict-neutral documentary registry:
//
//   part_annex annex_a {
//     letter "A"
//     title "Definitions from other applicable international publications"
//     obligation normative          # normative | informative —
//                                   # parse-enforced (the fail-closed
//                                   # precedent)
//     summary "…"
//     realization "…"
//     source { doc "urn:oiml:pub:r:60-4:2021" clause "A" }
//   }
//
// NOT the batch-2 informative_annex — that construct is an external
// guidance document (D 32) bound into a CS document module with clause
// highlights; this register indexes the rec's own printed annexes, and
// its whole point is the normative/informative mark the annex
// vocabulary carries (informative_annex's role is single-valued).
//
// The construct is part-agnostic — the part survives as the .prl
// filename (specification/annexes/part4.prl; specification/ is
// recursively collected, so no loader change) and the provenance URN.
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';

export default interface PartAnnex {
  /** Snake-case annex id (annex_a). */
  id: string;
  /** The annex letter as printed ("A"). */
  letter: string;
  /** The annex title. */
  title: string;
  /** normative | informative (parse-enforced; '' = undeclared). */
  obligation: string;
  /** What the annex covers. */
  summary: string;
  /** How the rec realizes the annex's content. */
  realization: string;
  /** Clause-URN provenance (required — C128). */
  source: SourceRef;
}
