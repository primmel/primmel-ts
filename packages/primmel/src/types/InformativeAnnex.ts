// ─────────────────────────────────────────────────────────────────────
// The informative annex (smart TODO.roadmap/40 batch 2; the packages-as-
// SSOT epic) — a guidance document bound into a document module (the
// OIML-CS PD-xx annexes citing the OIML D guides):
//
//   informative_annex d032 {
//     document {
//       id "D 32"
//       title "General requirements for software controlled measuring instruments"
//       edition 2018
//       year 2018
//       role informative
//       source "data/oiml-d032/document.presentation.xml"
//     }
//     applies_to iso-iec-17065        # → the CASCO layer package (C123)
//     applied_by "PD-03, 4.3"
//     scope "…"
//     numbering_caution "…"           # optional
//     highlight design_evaluation_checklist {
//       clause "G.7.1.1-3"
//       title "Type evaluation includes design evaluation"
//       statement "…"
//       discharged_by "…"             # optional, documentary
//     }
//   }
//
// `highlight <id> { … }` is a two-token facet (the id, then the block).
// The document role vocabulary is parse-enforced (the fail-closed
// precedent) — single-valued today (informative), expected to grow.
// applies_to resolves against the composed package set at check time
// (C123); the codec stays total.
// ─────────────────────────────────────────────────────────────────────

/** The cited guidance document of an informative annex. */
export interface AnnexDocument {
  /** The document designation ("D 32"). */
  id: string;
  title: string;
  /** The edition designation as a number (2018; 0 = undeclared). */
  edition: number;
  /** The publication year (0 = undeclared). */
  year: number;
  /** The document's role in the module ('informative'; '' = undeclared). */
  role: string;
  /** The source path of the document's presentation form. */
  source: string;
}

/** One highlighted clause of the annexed document. */
export interface AnnexHighlight {
  /** Snake-case highlight id (design_evaluation_checklist). */
  id: string;
  /** The clause of the annexed document the highlight cites. */
  clause: string;
  /** The highlight's title ('' = none). */
  title: string;
  /** The normative point the highlight makes. */
  statement: string;
  /** How the module discharges the highlight ('' = none, documentary). */
  dischargedBy: string;
}

export default interface InformativeAnnex {
  /** Snake-case annex id (d032). */
  id: string;
  /** The cited guidance document. */
  document: AnnexDocument;
  /** The CASCO layer package the annex applies to (C123). */
  appliesTo: string;
  /** The parent-document clause applying the annex ("PD-03, 4.3"). */
  appliedBy: string;
  /** The annex's scope statement. */
  scope: string;
  /** The numbering caution ('' = none). */
  numberingCaution: string;
  /** The highlighted clauses. */
  highlights: AnnexHighlight[];
}
