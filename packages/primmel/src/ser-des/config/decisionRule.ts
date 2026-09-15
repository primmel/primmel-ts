// ─────────────────────────────────────────────────────────────────────
// The `decision_rule` construct (smart TODO.roadmap/40; the packages-
// as-SSOT epic) — B 18:2025 clauses 9–16:
//
//   decision_rule ia-tl-participation-decisions {
//     organ management_committee
//     kind participation
//     clause "11.4.2"
//     description "The Management Committee decides the participation
//       of OIML Issuing Authorities and Test Laboratories — …"
//     on_recommendation_of review_committee
//     decides { ia_approval ia_reapproval ia_suspension tl_approval
//       tl_reapproval tl_suspension }
//     voting {
//       in_meeting {
//         threshold 0.8
//         base mc_members_from_member_states
//         clause "11.4.2"
//         description "Approval, re-approval or suspension … requires
//           the support of at least 80 % of the Management Committee
//           Members from OIML Member States (§11.4.2)."
//       }
//       by_correspondence {
//         threshold 0.8
//         base mc_members_from_member_states
//         clause "11.4.3"
//       }
//       other_proposals {
//         in_meeting 0.5
//         by_correspondence two_thirds_of_votes_cast
//         description "All other proposals require at least half of
//           the MC Members from OIML Member States in a meeting …"
//       }
//       proxies_max 2
//       abstentions not_voting
//       reason_on_against_or_abstain true
//     }
//     source { doc "urn:oiml:pub:b:18:2025" clause "11.4" }
//   }
//
// The advisory / appeal / registration / legacy / financing families
// carry their own facets (tasks, scope, principle, legacy_kind blocks,
// income, no_entrance_fees_for) instead of the voting block.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import {
  escapeString,
  stripWrapping,
  tokenizePackage,
  unwrapBlock,
} from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, readSource } from './field-parser';
import DecisionRule, {
  LegacyKind,
  OtherProposalsRule,
  VoteRule,
  VotingBlock,
} from '../../types/DecisionRule';

function parseVoteRule(block: string): VoteRule {
  const rule: VoteRule = {
    threshold: 0,
    base: '',
    clause: '',
    description: '',
  };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'threshold') {
        rule.threshold = parseFloat(stripWrapping(value())) || 0;
      } else if (keyword === 'base') {
        rule.base = stripWrapping(value());
      } else if (keyword === 'clause') {
        rule.clause = stripWrapping(value());
      } else if (keyword === 'description') {
        rule.description = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'decision_rule voting rule', id: '' },
  );
  return rule;
}

function parseOtherProposals(block: string): OtherProposalsRule {
  const rule: OtherProposalsRule = {
    in_meeting: 0,
    by_correspondence: '',
    description: '',
  };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'in_meeting') {
        rule.in_meeting = parseFloat(stripWrapping(value())) || 0;
      } else if (keyword === 'by_correspondence') {
        rule.by_correspondence = stripWrapping(value());
      } else if (keyword === 'description') {
        rule.description = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'decision_rule other_proposals', id: '' },
  );
  return rule;
}

function parseVoting(block: string): VotingBlock {
  const voting: VotingBlock = {
    in_meeting: null,
    by_correspondence: null,
    other_proposals: null,
    proxies_max: 0,
    abstentions: '',
    reason_on_against_or_abstain: false,
  };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'in_meeting') {
        voting.in_meeting = parseVoteRule(unwrapBlock(value()));
      } else if (keyword === 'by_correspondence') {
        voting.by_correspondence = parseVoteRule(unwrapBlock(value()));
      } else if (keyword === 'other_proposals') {
        voting.other_proposals = parseOtherProposals(unwrapBlock(value()));
      } else if (keyword === 'proxies_max') {
        voting.proxies_max = parseInt(stripWrapping(value()), 10) || 0;
      } else if (keyword === 'abstentions') {
        voting.abstentions = stripWrapping(value());
      } else if (keyword === 'reason_on_against_or_abstain') {
        voting.reason_on_against_or_abstain = value() === 'true';
      } else {
        return false;
      }
      return true;
    },
    { construct: 'decision_rule voting', id: '' },
  );
  return voting;
}

function parseLegacyKind(id: string, block: string): LegacyKind {
  const kind: LegacyKind = { id, clause: '', description: '' };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'clause') {
        kind.clause = stripWrapping(value());
      } else if (keyword === 'description') {
        kind.description = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'decision_rule legacy_kind', id },
  );
  return kind;
}

function parseIdList(value: string): string[] {
  return tokenizePackage(unwrapBlock(value)).filter(s => s.length > 0);
}

export const parseDecisionRule: Parser = (id: string, data: string) => {
  const rule: DecisionRule = {
    id,
    organ: '',
    kind: '',
    clause: '',
    description: '',
    on_recommendation_of: '',
    independent_of: '',
    decides: [],
    voting: null,
    tasks: [],
    scope: [],
    principle: '',
    legacy_kinds: [],
    income: '',
    no_entrance_fees_for: [],
    source: { doc: '', clause: '' },
  };

  forEachEntry(
    data,
    (keyword, value, peek) => {
      if (keyword === 'organ') {
        rule.organ = stripWrapping(value());
      } else if (keyword === 'kind') {
        rule.kind = stripWrapping(value());
      } else if (keyword === 'clause') {
        rule.clause = stripWrapping(value());
      } else if (keyword === 'description') {
        rule.description = stripWrapping(value());
      } else if (keyword === 'on_recommendation_of') {
        rule.on_recommendation_of = stripWrapping(value());
      } else if (keyword === 'independent_of') {
        rule.independent_of = stripWrapping(value());
      } else if (keyword === 'decides') {
        rule.decides = parseIdList(value());
      } else if (keyword === 'voting') {
        rule.voting = parseVoting(unwrapBlock(value()));
      } else if (keyword === 'tasks') {
        rule.tasks = parseIdList(value());
      } else if (keyword === 'scope') {
        rule.scope = parseIdList(value());
      } else if (keyword === 'principle') {
        rule.principle = stripWrapping(value());
      } else if (keyword === 'legacy_kind') {
        const kindId = stripWrapping(value());
        const head = peek();
        if (head === undefined || !head.startsWith('{')) {
          throw new Error(
            `Parsing error: decision_rule. ID ${id}: legacy_kind ${kindId} is missing its block`,
          );
        }
        rule.legacy_kinds.push(parseLegacyKind(kindId, unwrapBlock(value())));
      } else if (keyword === 'income') {
        rule.income = stripWrapping(value());
      } else if (keyword === 'no_entrance_fees_for') {
        rule.no_entrance_fees_for = parseIdList(value());
      } else if (keyword === 'source') {
        rule.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'decision_rule', id },
  );

  return ctx => {
    ctx.decisionRules[id] = rule;
    return ctx;
  };
};

function dumpVoteRule(label: string, rule: VoteRule): string {
  let out = '    ' + label + ' {\n';
  if (rule.threshold > 0) {
    out += '      threshold ' + rule.threshold + '\n';
  }
  if (rule.base) {
    out += '      base ' + dumpBareSafe(rule.base) + '\n';
  }
  if (rule.clause) {
    out += '      clause "' + escapeString(rule.clause) + '"\n';
  }
  if (rule.description) {
    out += '      description "' + escapeString(rule.description) + '"\n';
  }
  out += '    }\n';
  return out;
}

function dumpVoting(v: VotingBlock): string {
  let out = '  voting {\n';
  if (v.in_meeting) {
    out += dumpVoteRule('in_meeting', v.in_meeting);
  }
  if (v.by_correspondence) {
    out += dumpVoteRule('by_correspondence', v.by_correspondence);
  }
  if (v.other_proposals) {
    const o = v.other_proposals;
    out += '    other_proposals {\n';
    if (o.in_meeting > 0) {
      out += '      in_meeting ' + o.in_meeting + '\n';
    }
    if (o.by_correspondence) {
      out +=
        '      by_correspondence ' + dumpBareSafe(o.by_correspondence) + '\n';
    }
    if (o.description) {
      out += '      description "' + escapeString(o.description) + '"\n';
    }
    out += '    }\n';
  }
  if (v.proxies_max > 0) {
    out += '    proxies_max ' + v.proxies_max + '\n';
  }
  if (v.abstentions) {
    out += '    abstentions ' + dumpBareSafe(v.abstentions) + '\n';
  }
  if (v.reason_on_against_or_abstain) {
    out += '    reason_on_against_or_abstain true\n';
  }
  out += '  }\n';
  return out;
}

function dumpIdList(label: string, ids: string[], indent: string): string {
  return indent + label + ' { ' + ids.map(dumpBareSafe).join(' ') + ' }\n';
}

export const dumpDecisionRule: Dumper<DecisionRule> = function (r) {
  let out: string = 'decision_rule ' + r.id + ' {\n';
  if (r.organ) {
    out += '  organ ' + dumpBareSafe(r.organ) + '\n';
  }
  if (r.kind) {
    out += '  kind ' + dumpBareSafe(r.kind) + '\n';
  }
  if (r.clause) {
    out += '  clause "' + escapeString(r.clause) + '"\n';
  }
  if (r.description) {
    out += '  description "' + escapeString(r.description) + '"\n';
  }
  if (r.on_recommendation_of) {
    out +=
      '  on_recommendation_of ' + dumpBareSafe(r.on_recommendation_of) + '\n';
  }
  if (r.independent_of) {
    out += '  independent_of ' + dumpBareSafe(r.independent_of) + '\n';
  }
  if (r.decides.length > 0) {
    out += dumpIdList('decides', r.decides, '  ');
  }
  if (r.voting) {
    out += dumpVoting(r.voting);
  }
  if (r.tasks.length > 0) {
    out += dumpIdList('tasks', r.tasks, '  ');
  }
  if (r.scope.length > 0) {
    out += dumpIdList('scope', r.scope, '  ');
  }
  if (r.principle) {
    out += '  principle ' + dumpBareSafe(r.principle) + '\n';
  }
  for (const k of r.legacy_kinds) {
    out += '  legacy_kind ' + dumpBareSafe(k.id) + ' {\n';
    if (k.clause) {
      out += '    clause "' + escapeString(k.clause) + '"\n';
    }
    if (k.description) {
      out += '    description "' + escapeString(k.description) + '"\n';
    }
    out += '  }\n';
  }
  if (r.income) {
    out += '  income ' + dumpBareSafe(r.income) + '\n';
  }
  if (r.no_entrance_fees_for.length > 0) {
    out += dumpIdList('no_entrance_fees_for', r.no_entrance_fees_for, '  ');
  }
  if (r.source.doc || r.source.clause) {
    out += '  source {\n';
    if (r.source.doc) {
      out += '    doc "' + escapeString(r.source.doc) + '"\n';
    }
    if (r.source.clause) {
      out += '    clause "' + escapeString(r.source.clause) + '"\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};
