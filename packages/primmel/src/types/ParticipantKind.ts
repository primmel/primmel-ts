// ─────────────────────────────────────────────────────────────────────
// Participant kind (smart TODO.roadmap/40; the packages-as-SSOT epic) —
// one entry of a certification framework's participant registry: who may
// act in the scheme, on what competence basis, admitted by whom (OIML-CS
// B 18:2025 clause 5 is the driving model). Instances (actual IAs, TLs,
// Utilizers) are platform-runtime data, never modelled here — this is
// the TYPE-level registry.
//
// Competence content is DELEGATED, never restated (MECE): B 18:2025
// §5.2/§5.3 delegate Issuing-Authority competence to ISO/IEC 17065 and
// Test-Laboratory competence to ISO/IEC 17025 — `competence.delegates_to`
// is a REFERENCE to the layer package carrying that model.
//
// Cross-references (approval.decided_by / on_recommendation_of →
// governance_organ; designated_by / becomes → participant_kind;
// declaration → declaration_kind) resolve against the framework registers
// in composition scope — the checker owns resolution (the framework
// link rule), the serializer stays total.
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';

/** The competence delegation facet — a REFERENCE to the CASCO layer
 *  package carrying the competence model (never a restatement). */
export interface ParticipantCompetence {
  /** The layer package id delegated to (e.g. iso-iec-17065, iso-iec-17025). */
  delegates_to: string;
  /** The framework clause stating the delegation (e.g. "5.2"). */
  clause: string;
  /** Reading note (what lives where); '' = none. */
  note: string;
}

/** The approval facet — which organs decide/recommend admission and under
 *  which procedural document. */
export interface ParticipantApproval {
  /** governance_organ id deciding the approval. */
  decided_by: string;
  /** governance_organ id recommending the decision; '' = none. */
  on_recommendation_of: string;
  /** Procedural document governing the approval process (e.g. "PD-03"). */
  procedure: string;
  /** The clause granting the decision power (e.g. "11.5 f)"). */
  clause: string;
}

/** A nested subkind of a participant kind (the Test Laboratory's internal /
 *  third-party / manufacturer's subkinds). */
export interface ParticipantSubkind {
  /** Snake-case subkind id. */
  id: string;
  /** The term as it appears in the source standard. */
  label: string;
  /** The source standard's definition number (e.g. "3.15"); '' = none. */
  term: string;
  /** Verbatim definition text. */
  definition: string;
  /** Reporting-flag obligation (MTL-originated data is flagged on the type
   *  evaluation report); '' = none. */
  data_flag: string;
  /** Acceptance regime of the subkind's outputs: voluntary | mandatory |
   *  '' (inherits the kind's default regime). */
  acceptance: string;
  /** Acceptance reading note; '' = none. */
  acceptance_note: string;
}

/** One participant kind of a certification framework (B 18:2025 cl. 5). */
export default interface ParticipantKind {
  /** Snake-case kind id — the value declarations, gates and rules reference. */
  id: string;
  /** The term as it appears in the source standard ("OIML Issuing Authority"). */
  label: string;
  /** The source standard's definition number (e.g. "3.28"); '' = none. */
  term: string;
  /** The clause governing this participant kind (official PDF numbering). */
  clause: string;
  /** Verbatim definition text from the source clause. */
  definition: string;
  /** OIML membership facet: member_state | corresponding_member | '' . */
  member: string;
  /** Competence delegation; null = the kind carries no delegation facet. */
  competence: ParticipantCompetence | null;
  /** Approval facet; null = the kind is not approved by an organ. */
  approval: ParticipantApproval | null;
  /** governance_organ id approving this kind (experts); '' = none. */
  approved_by: string;
  /** participant_kind id designating this participant (TLs are designated
   *  by IAs); '' = none. */
  designated_by: string;
  /** declaration_kind id this participant signs; '' = signs none (TLs —
   *  PD-04). */
  declaration: string;
  /** Procedural document governing admission (e.g. "PD-09"); '' = none. */
  admission: string;
  /** participant_kind id the holder becomes (applicant → certificate_owner);
   *  '' = terminal. */
  becomes: string;
  /** Free procedural reference; '' = none. */
  procedure: string;
  /** The nested subkinds (the Test Laboratory's three); [] = none. */
  subkinds: ParticipantSubkind[];
  /** Clause-URN provenance (doc + clause). */
  source: SourceRef;
}
