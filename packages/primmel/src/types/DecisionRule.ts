// ─────────────────────────────────────────────────────────────────────
// Decision rule (smart TODO.roadmap/40; the packages-as-SSOT epic) —
// one governance decision rule of a certification framework binding an
// organ to its outcomes (OIML-CS B 18:2025, clauses 9–16): MC
// participation decisions by qualified majority on RC recommendation,
// TLF advisory tasks, BoA appeal rulings, BIML registration with the
// registered-copy validity principle, legacy-certificate validity, and
// the financing rule.
//
// The `organ`, `on_recommendation_of` and `independent_of` facets
// resolve against the governance_organ register; `no_entrance_fees_for`
// entries resolve against participant_kind ids — the checker owns
// resolution, the codec stays total.
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';

/** One voting rule (threshold + base) of a participation decision. */
export interface VoteRule {
  /** The required support fraction (0.8 = the 80 % rule of §11.4.2). */
  threshold: number;
  /** The electorate base (mc_members_from_member_states). */
  base: string;
  /** The clause fixing the rule. */
  clause: string;
  /** Reading text; '' = none. */
  description: string;
}

/** The fallback rule for all other proposals (§11.4.2/§11.4.3). */
export interface OtherProposalsRule {
  /** The in-meeting support fraction (0.5 = simple majority). */
  in_meeting: number;
  /** The by-correspondence rule (two_thirds_of_votes_cast). */
  by_correspondence: string;
  /** Reading text; '' = none. */
  description: string;
}

/** The voting block of a participation decision rule. */
export interface VotingBlock {
  /** The in-meeting rule; null = not stated. */
  in_meeting: VoteRule | null;
  /** The by-correspondence rule; null = not stated. */
  by_correspondence: VoteRule | null;
  /** The all-other-proposals fallback; null = not stated. */
  other_proposals: OtherProposalsRule | null;
  /** Maximum proxies per member; 0 = none stated. */
  proxies_max: number;
  /** The abstention convention (not_voting); '' = none stated. */
  abstentions: string;
  /** Whether a vote against or an abstention requires a reason. */
  reason_on_against_or_abstain: boolean;
}

/** One legacy certificate system whose issuances remain valid. */
export interface LegacyKind {
  /** The system id (maa | basic). */
  id: string;
  /** The clause stating continued validity. */
  clause: string;
  /** The validity + acceptance regime. */
  description: string;
}

/** One governance decision rule of a certification framework. */
export default interface DecisionRule {
  /** Snake-case or hyphenated rule id (e.g. ia-tl-participation-decisions). */
  id: string;
  /** governance_organ id owning the rule. */
  organ: string;
  /** The rule family: participation | advisory | appeal_ruling |
   *  registration | legacy_validity | financing. */
  kind: string;
  /** The clause governing the rule. */
  clause: string;
  /** What the rule governs, in prose. */
  description: string;
  /** governance_organ id whose recommendation grounds the decision;
   *  '' = none. */
  on_recommendation_of: string;
  /** governance_organ id the deciding organ is independent of; '' = none. */
  independent_of: string;
  /** The decision outcomes governed (e.g. ia_approval, tl_suspension). */
  decides: string[];
  /** The voting block (participation rules); null = no voting rule. */
  voting: VotingBlock | null;
  /** The advisory platform's task register (advisory rules). */
  tasks: string[];
  /** The decision classes appealable to / ruled by the organ
   *  (appeal_ruling rules). */
  scope: string[];
  /** The registration principle (registered_copy_validity); '' = none. */
  principle: string;
  /** The legacy systems covered (legacy_validity rules). */
  legacy_kinds: LegacyKind[];
  /** The income source (certificate_registration_fees); '' = none. */
  income: string;
  /** participant_kind ids exempt from entrance fees (financing rules). */
  no_entrance_fees_for: string[];
  /** Clause-URN provenance (doc + clause). */
  source: SourceRef;
}
