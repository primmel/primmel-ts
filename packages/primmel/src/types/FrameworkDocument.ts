// ─────────────────────────────────────────────────────────────────────
// Framework documents (smart TODO.roadmap/40; the packages-as-SSOT
// epic) — a certification framework's governing-document model
// (OIML-CS B 18:2025, clause 6 and §4.2):
//
//   - framework_document   — one rank of the governing-document
//     hierarchy (B 18 > CID-01 > OD-xx > PD-xx > Guidance/Forms/
//     Templates); lower rank prevails;
//   - document_precedence  — the precedence rule binding the hierarchy
//     (higher_position_prevails, clause 6);
//   - auto_inclusion       — the §4.2 automatic-inclusion conditions a
//     category's Recommendation must satisfy for the category to enter
//     the system (the scheme lifecycle's entry.conditions_ref targets
//     this block).
//
// approved_by resolves against the governance_organ register at check
// time; the codecs stay total.
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';

/** One rank of the governing-document hierarchy (B 18:2025 clause 6). */
export default interface FrameworkDocument {
  /** Document-family id (b18, cid-01, od, pd, guidance). */
  id: string;
  /** Position in the clause-6 list — lower rank prevails. */
  rank: number;
  /** The document designation as cited ("OIML B 18"). */
  doc: string;
  /** The document family's title. */
  title: string;
  /** governance_organ id approving the document family. */
  approved_by: string;
  /** The clause-6 list item (e.g. "6 a)"). */
  clause: string;
  /** Reading note (CID-01's non-supersession, clause 2); '' = none. */
  note: string;
  /** Clause-URN provenance (doc + clause). */
  source: SourceRef;
}

/** The precedence rule binding the hierarchy (clause 6). */
export interface DocumentPrecedence {
  /** The rule id (higher_position_prevails). */
  id: string;
  /** The clause stating the rule. */
  clause: string;
  /** The rule statement. */
  statement: string;
  /** Clause-URN provenance (doc + clause). */
  source: SourceRef;
}

/** One automatic-inclusion condition (§4.2 a)–d)). */
export interface AutoInclusionCondition {
  /** Snake-case or hyphenated condition id. */
  id: string;
  /** The §4.2 list item (e.g. "4.2 a)"). */
  clause: string;
  /** What the Recommendation must specify. */
  description: string;
}

/** The §4.2 automatic-inclusion block (the scheme lifecycle's entry
 *  conditions_ref target). */
export interface AutoInclusion {
  /** Snake-case block id (auto_inclusion). */
  id: string;
  /** The clause governing inclusion. */
  clause: string;
  /** The inclusion statement. */
  statement: string;
  /** The conditions (all must hold). */
  conditions: AutoInclusionCondition[];
  /** Reading note (the §4.2 Note + the §4.5 BIML list); '' = none. */
  note: string;
  /** Clause-URN provenance (doc + clause). */
  source: SourceRef;
}
