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
//     ref derives-from "urn:oiml:pub:r:60-1:2021#clause-6.2.1"
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

// ── The datum unification's second rung (TODO.lang-gaps/04, spec
// [[datum-unification]]): the identity_slot is the inscription plane of
// the one "named, typed, unit-ed value" substrate, so its value core
// READS THE DATUM. The slot stays the carrier (the alias doctrine — the
// construct is not going away); the `datum { … }` block authored inside
// it carries the substrate facets, and the slot exposes the resolved
// view through the kernel accessor (`identitySlotDatumView`,
// ser-des/config/identitySlot.ts). The wire shape does not move: the
// dump emits the AUTHORED spelling, so the fixpoint holds.
/** The facets of the `datum { … }` block authored inside an identity
 *  slot — the substrate view of the inscription value. `type` '' = the
 *  block does not restate the type (the slot's flat `type` stands);
 *  origin defaults to `declared` (the datum's own default). */
export interface IdentitySlotDatum {
  /** The datum's type (the slot's type vocabulary — the block's type
   *  must agree with the flat `type` when both are declared; C191). */
  type: string;
  /** The unit the inscription value carries (unitsdb reference). */
  unit: string;
  /** The quantity kind (unitsdb reference). */
  quantityKind: string;
  /** declared | design-fixed | observed | computed (the datum's origin
   *  axis — the value's provenance, never the executor's). */
  origin: 'declared' | 'design-fixed' | 'observed' | 'computed';
  /** The scope axis (model | family | sample | run). */
  scope: string;
}

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
  /** The inline `datum { … }` block ([[datum-unification]] wave 04
   *  PR 2) — the substrate facets of the slot's inscription value;
   *  null when the slot declares none (the flat `type` alone). */
  datum: IdentitySlotDatum | null;
}
