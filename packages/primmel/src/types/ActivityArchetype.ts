// ─────────────────────────────────────────────────────────────────────
// Activity archetype (TODO.roadmap/39) — a classifiable activity kind of
// the ISO/IEC 17000 functional approach (selection; determination —
// testing/inspection/audit/validation/verification/peer assessment;
// review; decision; attestation — declaration/certification/accreditation;
// surveillance and the statement-of-conformity lifecycle terms).
//
// An abstract (or executable) process CLASSIFIES itself against an
// archetype register via `activity_kind { <id>+ }` — classification, not
// inheritance. The linter (C58 activity-kind-resolves) resolves every
// tagged kind against the declared archetypes when a register is in scope.
// `parent` records only the type-of relationships the standard itself
// states (A.3.2 determination types, A.4.3 attestation types).
// ─────────────────────────────────────────────────────────────────────

/** One entry of an ISO/IEC 17000 activity-archetype register. */
export default interface ActivityArchetype {
  /** Snake-case kind id — the value a process's activity_kind references. */
  id: string;
  /** The term as it appears in the source standard (e.g. "peer assessment"). */
  label: string;
  /** Clause of the source standard the definition comes from ("6.2", "A.3"). */
  clause: string;
  /** Verbatim definition text from the source clause. */
  definition: string;
  /** Parent kind id (a stated type-of relationship only); '' = top-level. */
  parent: string;
}
