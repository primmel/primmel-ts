// ─────────────────────────────────────────────────────────────────────
// `participant_kind` construct (smart TODO.roadmap/40; the packages-as-
// SSOT epic) — one entry of a certification framework's participant
// registry (B 18:2025 clause 5):
//
//   participant_kind issuing_authority {
//     label "OIML Issuing Authority"
//     term "3.28"
//     clause "5.2"
//     definition "Certification body or inspection body from an OIML
//       Member State approved by the Management Committee to issue OIML
//       certificates …"
//     member member_state
//     competence {
//       delegates_to iso-iec-17065
//       clause "5.2"
//       note "Compliance with ISO/IEC 17065 (B 18:2025, §5.2) — …"
//     }
//     approval {
//       decided_by management_committee
//       on_recommendation_of review_committee
//       procedure "PD-03"
//       clause "11.5 f)"
//     }
//     declaration issuing_authority_declaration
//     subkind internal {
//       label "Internal Test Laboratory"
//       term "3.15"
//       definition "Test Laboratory that is part of the same organization
//         as the OIML Issuing Authority."
//     }
//     source { doc "urn:oiml:pub:b:18:2025" clause "5.2" }
//   }
//
// Cross-references (approval.* → governance_organ, declaration →
// declaration_kind, designated_by/becomes → participant_kind) resolve at
// check time against the composed framework registers; the codec stays
// total.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping, unwrapBlock } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, readSource } from './field-parser';
import ParticipantKind, {
  ParticipantApproval,
  ParticipantCompetence,
  ParticipantSubkind,
} from '../../types/ParticipantKind';

function parseCompetence(block: string): ParticipantCompetence {
  const competence: ParticipantCompetence = {
    delegates_to: '',
    clause: '',
    note: '',
  };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'delegates_to') {
        competence.delegates_to = stripWrapping(value());
      } else if (keyword === 'clause') {
        competence.clause = stripWrapping(value());
      } else if (keyword === 'note') {
        competence.note = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'participant_kind competence', id: '' },
  );
  return competence;
}

function parseApproval(block: string): ParticipantApproval {
  const approval: ParticipantApproval = {
    decided_by: '',
    on_recommendation_of: '',
    procedure: '',
    clause: '',
  };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'decided_by') {
        approval.decided_by = stripWrapping(value());
      } else if (keyword === 'on_recommendation_of') {
        approval.on_recommendation_of = stripWrapping(value());
      } else if (keyword === 'procedure') {
        approval.procedure = stripWrapping(value());
      } else if (keyword === 'clause') {
        approval.clause = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'participant_kind approval', id: '' },
  );
  return approval;
}

function parseSubkind(id: string, block: string): ParticipantSubkind {
  const subkind: ParticipantSubkind = {
    id,
    label: '',
    term: '',
    definition: '',
    data_flag: '',
    acceptance: '',
    acceptance_note: '',
  };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'label') {
        subkind.label = stripWrapping(value());
      } else if (keyword === 'term') {
        subkind.term = stripWrapping(value());
      } else if (keyword === 'definition') {
        subkind.definition = stripWrapping(value());
      } else if (keyword === 'data_flag') {
        subkind.data_flag = stripWrapping(value());
      } else if (keyword === 'acceptance') {
        subkind.acceptance = stripWrapping(value());
      } else if (keyword === 'acceptance_note') {
        subkind.acceptance_note = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'participant_kind subkind', id },
  );
  return subkind;
}

export const parseParticipantKind: Parser = (id: string, data: string) => {
  const kind: ParticipantKind = {
    id,
    label: '',
    term: '',
    clause: '',
    definition: '',
    member: '',
    competence: null,
    approval: null,
    approved_by: '',
    designated_by: '',
    declaration: '',
    admission: '',
    becomes: '',
    procedure: '',
    subkinds: [],
    source: { doc: '', clause: '' },
  };

  // `subkind <id> { … }` is a two-token facet (the id, then the block), so
  // it claims through peek/value manually: value() reads the id, the next
  // token must be the block.
  forEachEntry(
    data,
    (keyword, value, peek) => {
      if (keyword === 'label') {
        kind.label = stripWrapping(value());
      } else if (keyword === 'term') {
        kind.term = stripWrapping(value());
      } else if (keyword === 'clause') {
        kind.clause = stripWrapping(value());
      } else if (keyword === 'definition') {
        kind.definition = stripWrapping(value());
      } else if (keyword === 'member') {
        kind.member = stripWrapping(value());
      } else if (keyword === 'competence') {
        kind.competence = parseCompetence(unwrapBlock(value()));
      } else if (keyword === 'approval') {
        kind.approval = parseApproval(unwrapBlock(value()));
      } else if (keyword === 'approved_by') {
        kind.approved_by = stripWrapping(value());
      } else if (keyword === 'designated_by') {
        kind.designated_by = stripWrapping(value());
      } else if (keyword === 'declaration') {
        kind.declaration = stripWrapping(value());
      } else if (keyword === 'admission') {
        kind.admission = stripWrapping(value());
      } else if (keyword === 'becomes') {
        kind.becomes = stripWrapping(value());
      } else if (keyword === 'procedure') {
        kind.procedure = stripWrapping(value());
      } else if (keyword === 'subkind') {
        const subId = stripWrapping(value());
        const head = peek();
        if (head === undefined || !head.startsWith('{')) {
          throw new Error(
            `Parsing error: participant_kind. ID ${id}: subkind ${subId} is missing its block`,
          );
        }
        kind.subkinds.push(parseSubkind(subId, unwrapBlock(value())));
      } else if (keyword === 'source') {
        kind.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'participant_kind', id },
  );

  return ctx => {
    ctx.participantKinds[id] = kind;
    return ctx;
  };
};

function dumpCompetence(c: ParticipantCompetence): string {
  let out = '  competence {\n';
  if (c.delegates_to) {
    out += '    delegates_to ' + dumpBareSafe(c.delegates_to) + '\n';
  }
  if (c.clause) {
    out += '    clause "' + escapeString(c.clause) + '"\n';
  }
  if (c.note) {
    out += '    note "' + escapeString(c.note) + '"\n';
  }
  out += '  }\n';
  return out;
}

function dumpApproval(a: ParticipantApproval): string {
  let out = '  approval {\n';
  if (a.decided_by) {
    out += '    decided_by ' + dumpBareSafe(a.decided_by) + '\n';
  }
  if (a.on_recommendation_of) {
    out +=
      '    on_recommendation_of ' + dumpBareSafe(a.on_recommendation_of) + '\n';
  }
  if (a.procedure) {
    out += '    procedure "' + escapeString(a.procedure) + '"\n';
  }
  if (a.clause) {
    out += '    clause "' + escapeString(a.clause) + '"\n';
  }
  out += '  }\n';
  return out;
}

function dumpSubkind(s: ParticipantSubkind): string {
  let out = '  subkind ' + dumpBareSafe(s.id) + ' {\n';
  if (s.label) {
    out += '    label "' + escapeString(s.label) + '"\n';
  }
  if (s.term) {
    out += '    term "' + escapeString(s.term) + '"\n';
  }
  if (s.definition) {
    out += '    definition "' + escapeString(s.definition) + '"\n';
  }
  if (s.data_flag) {
    out += '    data_flag "' + escapeString(s.data_flag) + '"\n';
  }
  if (s.acceptance) {
    out += '    acceptance ' + dumpBareSafe(s.acceptance) + '\n';
  }
  if (s.acceptance_note) {
    out += '    acceptance_note "' + escapeString(s.acceptance_note) + '"\n';
  }
  out += '  }\n';
  return out;
}

export const dumpParticipantKind: Dumper<ParticipantKind> = function (k) {
  let out: string = 'participant_kind ' + k.id + ' {\n';
  if (k.label) {
    out += '  label "' + escapeString(k.label) + '"\n';
  }
  if (k.term) {
    out += '  term "' + escapeString(k.term) + '"\n';
  }
  if (k.clause) {
    out += '  clause "' + escapeString(k.clause) + '"\n';
  }
  if (k.definition) {
    out += '  definition "' + escapeString(k.definition) + '"\n';
  }
  if (k.member) {
    out += '  member ' + dumpBareSafe(k.member) + '\n';
  }
  if (k.competence) {
    out += dumpCompetence(k.competence);
  }
  if (k.approval) {
    out += dumpApproval(k.approval);
  }
  if (k.approved_by) {
    out += '  approved_by ' + dumpBareSafe(k.approved_by) + '\n';
  }
  if (k.designated_by) {
    out += '  designated_by ' + dumpBareSafe(k.designated_by) + '\n';
  }
  if (k.declaration) {
    out += '  declaration ' + dumpBareSafe(k.declaration) + '\n';
  }
  if (k.admission) {
    out += '  admission "' + escapeString(k.admission) + '"\n';
  }
  if (k.becomes) {
    out += '  becomes ' + dumpBareSafe(k.becomes) + '\n';
  }
  if (k.procedure) {
    out += '  procedure "' + escapeString(k.procedure) + '"\n';
  }
  for (const s of k.subkinds) {
    out += dumpSubkind(s);
  }
  if (k.source.doc || k.source.clause) {
    out += '  source {\n';
    if (k.source.doc) {
      out += '    doc "' + escapeString(k.source.doc) + '"\n';
    }
    if (k.source.clause) {
      out += '    clause "' + escapeString(k.source.clause) + '"\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};
