/**
 * Corpus-level source-discrepancy record (TODO.roadmap/54 — BUG.R60-SSOT
 * gap 13's corpus-level extension): a named, top-level record that two or
 * more source fragments CONFLICT, characterizing the conflict and recording
 * the corpus's adjudication — which source governs, why, and the authority
 * that decided. The node-attached `source_discrepancy` facet
 * (rc.yaml $defs/source_discrepancy — requirements, conformance tests,
 * tables, …) covers conflicts a model node can carry; corpus-level
 * conflicts attach to DOCUMENTS, not nodes (e.g. PD-02, 11.1's four-year
 * expert-review cycle vs OD-01, 13.4's 3-yearly cycle — no model node owns
 * that disagreement), so they live here as first-class records. The record
 * is the corpus's own errata memory: a coverage gap or clause
 * reconciliation never re-litigates a settled disagreement from scratch,
 * and an `open` record is audit-visible instead of hiding in a comment.
 *
 * The facet fields (summary / sources / resolution / rationale) are
 * IDENTICAL to the shipped source_discrepancy construct; the corpus
 * wrapper adds `status` (open | resolved) and `governing` (the source that
 * governs — required when resolution is follows_clause_x, meaningless for
 * annotated_only).
 */
export default interface DiscrepancyRecord {
  id: string;
  /** open (undispositioned — prints at audit level) | resolved (the
   *  corpus's treatment is settled). */
  status: string;
  /** One-sentence statement of the contradiction. */
  summary: string;
  /** The conflicting clause/document URNs (≥2 — both sides). */
  sources: string[];
  /** follows_clause_x (the corpus follows one cited source — named by
   *  `governing`) | annotated_only (the conflict is recorded; no side
   *  picked). Empty while status is open. */
  resolution: string;
  /** The governing source — one of `sources`. Required iff resolution is
   *  follows_clause_x; empty otherwise. */
  governing: string;
  /** Why the corpus treats the conflict this way + the deciding authority
   *  (audit task, edition, verification date). */
  rationale: string;
}
