// ─────────────────────────────────────────────────────────────────────
// Governance organ (smart TODO.roadmap/40; the packages-as-SSOT epic) —
// one organ of a certification framework acting as a participant-registry
// actor (OIML-CS B 18:2025 clauses 8–13: the Management Committee, its
// Review Committee sub-committee, the Board of Appeal, the BIML, …).
//
// Organs are the resolution target of the framework's decision facets:
// a participant kind's approval.decided_by / on_recommendation_of, a
// decision_rule's organ, a scheme transition's decided_by. The checker
// owns reference resolution; the serializer stays total.
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';

/** One governance organ of a certification framework. */
export default interface GovernanceOrgan {
  /** Snake-case organ id (e.g. management_committee). */
  id: string;
  /** The organ's name as it appears in the source standard. */
  label: string;
  /** The source standard's definition number (e.g. "3.22"); '' = none. */
  term: string;
  /** The clause constituting the organ. */
  clause: string;
  /** The organ's mandate (responsibilities in prose). */
  mandate: string;
  /** Parent organ id when this organ is a sub-committee (the RC is an MC
   *  sub-committee); '' = independent constituting. */
  sub_committee_of: string;
  /** Organ id this organ is independent of (the BoA is independent of the
   *  MC); '' = none. */
  independent_of: string;
  /** Clause-URN provenance (doc + clause). */
  source: SourceRef;
}
