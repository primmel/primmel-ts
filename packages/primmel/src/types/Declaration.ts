// ─────────────────────────────────────────────────────────────────────
// Declaration model (smart TODO.roadmap/40; the packages-as-SSOT epic) —
// a certification framework's Declaration machinery as first-class model
// content (OIML-CS B 18:2025 §5.5–5.6; PD-08 semantics):
//
//   - declaration_kind    — one Declaration form a participant kind signs
//                           (IA / Utilizer / Associate), with its scope
//                           model and acceptance content slots;
//   - declaration_status  — one lifecycle state of a Declaration instance
//                           (draft / signed / suspended / withdrawn);
//   - declaration_gate    — the signing-gate invariant (PD-08 cl. 5): the
//                           holder issues nothing covered by the Declaration
//                           before it is signed; `blocks` names the gated
//                           abstract processes of the scheme process model.
//
// Cross-references (holder → participant_kind, declaration →
// declaration_kind, blocks → abstract process ids) resolve at check time
// against the composed framework registers; the codecs stay total.
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';

/** One acceptance content slot of a Declaration form (the Utilizer /
 *  Associate Declarations: additional national requirements, accepted
 *  participants, MTL acceptance policy, legacy MAA acceptance). */
export interface DeclarationContentSlot {
  /** Snake-case slot id (e.g. mtl_acceptance_policy). */
  id: string;
  /** The clause requiring the slot's content. */
  clause: string;
  /** What the slot declares. */
  description: string;
}

/** One Declaration form of a certification framework (B 18:2025 §5.5–5.6). */
export default interface DeclarationKind {
  /** Snake-case kind id — the value participant kinds and gates reference. */
  id: string;
  /** The form's name ("OIML Issuing Authority Declaration"). */
  label: string;
  /** participant_kind id signing this Declaration. */
  holder: string;
  /** The clause establishing the Declaration. */
  clause: string;
  /** The procedural document governing the signing (e.g. "PD-08"). */
  procedure: string;
  /** Verbatim definition text. */
  definition: string;
  /** The scope structure (categories_x_schemes — PD-08 cl. 4). */
  scope_model: string;
  /** The Scheme-A Utilizer-designation obligation (§5.5.1; IA Declarations
   *  only); '' = none. */
  scheme_a_obligation: string;
  /** Acceptance content slots; [] = none (the IA Declaration carries the
   *  obligation, not content slots). */
  content: DeclarationContentSlot[];
  /** Clause-URN provenance (doc + clause). */
  source: SourceRef;
}

/** One lifecycle state of a Declaration instance (PD-08 cl. 5). */
export interface DeclarationStatus {
  /** Snake-case status id (draft | signed | suspended | withdrawn). */
  id: string;
  /** What the state means for issuance/acceptance. */
  description: string;
}

/** The signing-gate invariant (PD-08 clause 5): the constrained holder
 *  issues nothing within the Declaration's scope before signature. */
export interface DeclarationGate {
  /** Snake-case or hyphenated gate id (e.g. declaration-signed-before-issuance). */
  id: string;
  /** The clause stating the gate. */
  clause: string;
  /** The gate statement (the invariant in prose). */
  statement: string;
  /** participant_kind id the gate constrains. */
  holder: string;
  /** declaration_kind id whose signature discharges the gate. */
  declaration: string;
  /** Abstract-process ids of the scheme process model the gate blocks while
   *  the Declaration is unsigned. */
  blocks: string[];
  /** Reading note for the blocks list; '' = none. */
  blocks_note: string;
  /** The Declaration scope facets the gate checks (category, scheme). */
  scope_checked: string[];
  /** Clause-URN provenance (doc + clause). */
  source: SourceRef;
}
