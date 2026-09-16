// ─────────────────────────────────────────────────────────────────────
// The aspect (smart TODO.roadmap/40 batch 3; the packages-as-SSOT epic;
// smart TODO.roadmap/47 subject enrichment) — the QUALITATIVE HAS
// inventory: the aspects of the subject that requirements and
// conformance tests constrain without being quantities (R 60-1, 6;
// R 60-2, 2.5/2.6):
//
//   aspect markings {
//     label "Markings on the load cell"
//     kind marking                       # marking | inscription | sealing |
//                                        # display | control | interface |
//                                        # power-supply | enclosure |
//                                        # construction | documentation |
//                                        # other — parse-enforced
//     definition "…"
//     metamodel_class identity-provenance.Marking
//     term_ref marking                   # → term (C130)
//     contains { model.identity.manufacturer … e_max accuracy_class }
//     source { doc "urn:oiml:pub:r:60-1:2021" clause "6.2.1" }
//   }
//
//   aspect software {
//     kind other
//     attribute software_identification  # → attribute_definition (C130) —
//                                        # never a redeclaration (INV-3)
//   }
//
// Requirements and tests bind to the aspects as `model.aspects.<id>`
// (the smart R28 mirror — C130). The `contains` list mixes two
// namespaces — `model.identity.<slot>` paths AND bare attribute or
// dimension ids — and C130 tries both before erroring (each leg checked
// only when its target register composes, per-register gating).
// Quantitative facets stay in attribute_definitions and are pointed at
// via `attribute`/`contains` — never redeclared (INV-3).
//
// The passport content classes reference "aspects" conceptually (C86);
// this register is what they resolve against.
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';

export default interface Aspect {
  /** Snake-case aspect id (markings, software, …). */
  id: string;
  /** The aspect's short label. */
  label: string;
  /** marking | inscription | sealing | display | control | interface |
   *  power-supply | enclosure | construction | documentation | other
   *  (parse-enforced; '' = undeclared). */
  kind: string;
  /** What the aspect covers. */
  definition: string;
  /** The metamodel realization token — documentary, never resolved. */
  metamodelClass: string;
  /** The glossary term the aspect realizes (→ term; C130). */
  termRef: string;
  /** The instrument component the aspect localizes to (→ instrument
   *  component; C130; '' = undeclared). */
  component: string;
  /** The quantitative facet the aspect points at (→
   *  attribute_definition; C130; '' = undeclared) — a reference, never
   *  a redeclaration (INV-3). */
  attribute: string;
  /** The aspect's content: `model.identity.<slot>` paths and/or bare
   *  attribute/dimension ids (C130 tries both namespaces). */
  contains: string[];
  /** Clause-URN provenance (optional). */
  source: SourceRef | null;
}
