// ─────────────────────────────────────────────────────────────────────
// `governance_organ` construct (smart TODO.roadmap/40; the packages-as-
// SSOT epic) — one organ of a certification framework (B 18:2025
// clauses 8–13):
//
//   governance_organ management_committee {
//     label "Management Committee (MC)"
//     term "3.22"
//     clause "11"
//     mandate "The MC manages the OIML-CS: it decides participation,
//       approves …"
//     source { doc "urn:oiml:pub:b:18:2025" clause "11" }
//   }
//
//   governance_organ review_committee {
//     label "Review Committee (RC)"
//     clause "12"
//     mandate "…"
//     sub_committee_of management_committee
//     source { doc "urn:oiml:pub:b:18:2025" clause "12" }
//   }
//
// Organs are the resolution target of the framework's decision facets
// (participant_kind approval.*, decision_rule organ, scheme-lifecycle
// transition decided_by); the checker owns resolution.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping, unwrapBlock } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, readSource } from './field-parser';
import GovernanceOrgan from '../../types/GovernanceOrgan';

export const parseGovernanceOrgan: Parser = (id: string, data: string) => {
  const organ: GovernanceOrgan = {
    id,
    label: '',
    term: '',
    clause: '',
    mandate: '',
    sub_committee_of: '',
    independent_of: '',
    source: { doc: '', clause: '' },
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'label') {
        organ.label = stripWrapping(value());
      } else if (keyword === 'term') {
        organ.term = stripWrapping(value());
      } else if (keyword === 'clause') {
        organ.clause = stripWrapping(value());
      } else if (keyword === 'mandate') {
        organ.mandate = stripWrapping(value());
      } else if (keyword === 'sub_committee_of') {
        organ.sub_committee_of = stripWrapping(value());
      } else if (keyword === 'independent_of') {
        organ.independent_of = stripWrapping(value());
      } else if (keyword === 'source') {
        organ.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'governance_organ', id },
  );

  return ctx => {
    ctx.governanceOrgans[id] = organ;
    return ctx;
  };
};

export const dumpGovernanceOrgan: Dumper<GovernanceOrgan> = function (o) {
  let out: string = 'governance_organ ' + o.id + ' {\n';
  if (o.label) {
    out += '  label "' + escapeString(o.label) + '"\n';
  }
  if (o.term) {
    out += '  term "' + escapeString(o.term) + '"\n';
  }
  if (o.clause) {
    out += '  clause "' + escapeString(o.clause) + '"\n';
  }
  if (o.mandate) {
    out += '  mandate "' + escapeString(o.mandate) + '"\n';
  }
  if (o.sub_committee_of) {
    out += '  sub_committee_of ' + dumpBareSafe(o.sub_committee_of) + '\n';
  }
  if (o.independent_of) {
    out += '  independent_of ' + dumpBareSafe(o.independent_of) + '\n';
  }
  if (o.source.doc || o.source.clause) {
    out += '  source {\n';
    if (o.source.doc) {
      out += '    doc "' + escapeString(o.source.doc) + '"\n';
    }
    if (o.source.clause) {
      out += '    clause "' + escapeString(o.source.clause) + '"\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};
