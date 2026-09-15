// ─────────────────────────────────────────────────────────────────────
// Scheme architecture (smart TODO.roadmap/40; the packages-as-SSOT
// epic) — a certification framework's two-Scheme model (OIML-CS
// B 18:2025, 3.37/3.38, §5.4) and the per-category scheme lifecycle
// (clause 15: automatic Scheme-B entry on inclusion, automatic
// transition to Scheme A at two years).
//
//   - scheme_definition — one Scheme's definition with its
//     compliance-DEMONSTRATION method (the competence requirements
//     themselves are identical in both Schemes and delegated to the
//     ISO/IEC 17065/17025 packages — see participant_kind);
//   - scheme_lifecycle  — the per-instrument-category machine. It
//     follows the state_machine shape (initial + transitions) but
//     carries the framework facets the generic machine does not: the
//     entry block, per-transition deciding organs and clauses, and the
//     timer triggers with their windows and deferral notes.
//
// Cross-references (transition decided_by / on_proposal_of →
// governance_organ, entry conditions_ref → the auto-inclusion block of
// the documents model) resolve at check time; the codecs stay total.
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';

/** The compliance-demonstration facet of a Scheme (§5.4). */
export interface SchemeDemonstration {
  /** self_declaration | peer_evaluation. */
  method: string;
  /** The clause fixing the method. */
  clause: string;
  /** The peer-evaluation basis register (accreditation, peer_assessment);
   *  [] for self-declaration. */
  basis: string[];
  /** Reading note; '' = none. */
  note: string;
}

/** One Scheme of the framework's two-Scheme architecture. */
export interface SchemeDefinition {
  /** Snake-case scheme id (scheme_a | scheme_b). */
  id: string;
  /** The Scheme's name ("Scheme A"). */
  label: string;
  /** The source standard's definition number (e.g. "3.37"). */
  term: string;
  /** The clause defining the Scheme. */
  clause: string;
  /** Verbatim definition text. */
  definition: string;
  /** The demonstration facet; null = not modelled. */
  demonstration: SchemeDemonstration | null;
  /** Clause-URN provenance (doc + clause). */
  source: SourceRef;
}

/** The lifecycle entry block — inclusion in the scheme (§15.1). */
export interface SchemeLifecycleEntry {
  /** The entry action id (e.g. category_included). */
  action: string;
  /** Inclusion is automatic when the conditions hold (§15.1). */
  automatic: boolean;
  /** The clause governing entry. */
  clause: string;
  /** The auto-inclusion conditions block id of the documents model. */
  conditions_ref: string;
  /** Reading text; '' = none. */
  description: string;
}

/** One lifecycle transition with its framework facets. */
export interface SchemeTransition {
  /** Source state (SCHEME_B). */
  from: string;
  /** Target state (SCHEME_A). */
  to: string;
  /** The transition action id (trigger bindings reference it). */
  action: string;
  /** The clause governing the transition. */
  clause: string;
  /** governance_organ id deciding the transition; '' = automatic. */
  decided_by: string;
  /** governance_organ id proposing the transition; '' = none. */
  on_proposal_of: string;
  /** Reading text; '' = none. */
  description: string;
}

/** A lifecycle trigger — the timer that fires a transition action. */
export interface SchemeTrigger {
  /** Snake-case or hyphenated trigger id (e.g. two-year-transition). */
  id: string;
  /** The trigger kind (timer). */
  kind: string;
  /** The transition action this trigger fires. */
  action: string;
  /** The window in years; 0 = not stated in years. */
  windowYears: number;
  /** The window in months; 0 = not stated in months. */
  windowMonths: number;
  /** The clause fixing the window. */
  clause: string;
  /** Whether the transition may be deferred (§15.3). */
  deferrable: boolean;
  /** The deferral reading note; '' = none. */
  deferral_note: string;
  /** Reading text; '' = none. */
  description: string;
}

/** The per-instrument-category scheme lifecycle (B 18:2025 clause 15). */
export interface SchemeLifecycle {
  /** Snake-case machine id (e.g. category_scheme). */
  id: string;
  /** What the machine runs per (instrument_category). */
  applies_to: string;
  /** The initial state (SCHEME_B — §4.3, §15.1). */
  initial: string;
  /** The entry block; null = not modelled. */
  entry: SchemeLifecycleEntry | null;
  /** The transitions. */
  transitions: SchemeTransition[];
  /** The triggers. */
  triggers: SchemeTrigger[];
  /** Clause-URN provenance (doc + clause). */
  source: SourceRef;
}
