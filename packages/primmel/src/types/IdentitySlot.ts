// ─────────────────────────────────────────────────────────────────────
// The identity slot (smart TODO.roadmap/40 batch 3; the packages-as-
// SSOT epic; smart TODO.roadmap/47 subject enrichment) — the subject's
// DOCUMENTARY identity register (R 60-1, 6.2: the markings and
// accompanying-document entries), first-class what SubjectIs.metadata/
// provenance carry as free key/value pairs today:
//
//   identity_slot manufacturer {
//     label "Manufacturer's name or trade mark"
//     type string                        # string | designation | serial |
//                                        # year | mark | map — parse-enforced
//     presentation { marked-on-instrument accompanying-document }
//     optional true                      # optional flag
//     definition "…"
//     metamodel_class identity-provenance.Manufacturer   # dotted token —
//                                        # external ontology, documentary
//     source { doc "urn:oiml:pub:r:60-1:2021" clause "6.2.1" }
//   }
//
// Requirements bind to the slots as `model.identity.<slot>` (the smart
// R28 requirement-binding-targets mirror — C130). No quantities here: a
// marked quantity (E_max, v_min, …) stays an attribute_definition and
// is referenced, never redeclared (INV-3). The `presentation` facet
// realizes the location axis of the metamodel's Marking.items
// {content, location} pair (urn:ontology:mi:upper Module B
// identity-provenance): where the identity content is presented.
//
// Localized label/definition: the default spelling rides inline; the
// alternates ride l10n `text` blocks (the term/form precedent) and the
// projection re-joins.
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';

export default interface IdentitySlot {
  /** Snake-case slot id (manufacturer, model_designation, …). */
  id: string;
  /** The slot's short label (default spelling inline). */
  label: string;
  /** string | designation | serial | year | mark | map (parse-enforced;
   *  '' = undeclared). */
  type: string;
  /** marked-on-instrument | accompanying-document — the presentation
   *  channels (parse-enforced vocabulary; ≥1 — C130). */
  presentation: string[];
  /** True when the slot is optional content (the schema's `optional`). */
  optional: boolean;
  /** What the slot carries (default spelling inline). */
  definition: string;
  /** The metamodel realization token (identity-provenance.Manufacturer)
   *  — a dotted external-ontology citation, documentary, never resolved
   *  (the external-vocabulary skip precedent, smart R27). */
  metamodelClass: string;
  /** Clause-URN provenance (optional). */
  source: SourceRef | null;
}
