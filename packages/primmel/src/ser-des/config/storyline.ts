// ─────────────────────────────────────────────────────────────────────
// `demo_world` + `storyline` constructs (smart TODO.roadmap/40 batch 4;
// the packages-as-SSOT epic) — the sample-data demo seeds as native
// constructs (types/Storyline.ts carries the banner, the grammar
// sketch, and the deliberate instance-non-unification note).
//
// The record-value sub-grammar follows the quantity.ts dumpScalarToken
// conventions: numbers bare, whitespace/brace-carrying strings quoted,
// `{ … }` lists of scalars. The participants sections and the subject
// slot kinds are OPEN — the grammar never enumerates program content.
//
// Cross-references stay strings at parse and resolve at check time
// (C129); the codecs stay total.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import tokenize, {
  escapeString,
  stripWrapping,
  unwrapBlock,
} from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, stripColon } from './field-parser';
import { coerceValueToken, dumpScalarToken } from './quantity';
import Storyline, {
  DemoWorld,
  ParticipantsSection,
  RecordValue,
  StorylineSubjectEntry,
} from '../../types/Storyline';

// ── the record-value sub-grammar ─────────────────────────────────────

/** Read one field value: `{ … }` list of scalars, or one scalar. */
function readRecordValue(token: string): RecordValue {
  if (token.startsWith('{')) {
    return tokenize(unwrapBlock(token))
      .filter(s => s.length > 0)
      .map(coerceValueToken);
  }
  return coerceValueToken(token);
}

/** Read a record-shaped block (`key value` pairs, values scalar or
 *  braced list), preserving authored order. */
function readRecordFields(block: string): Record<string, RecordValue> {
  const fields: Record<string, RecordValue> = {};
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const key = t[i++];
    if (i >= t.length) {
      break;
    }
    fields[stripColon(key)] = readRecordValue(t[i++]);
  }
  return fields;
}

function dumpRecordFields(
  fields: Record<string, RecordValue>,
  indent: string,
): string {
  let out = '';
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      out +=
        indent + key + ' { ' + value.map(dumpScalarToken).join(' ') + ' }\n';
    } else {
      out += indent + key + ' ' + dumpScalarToken(value) + '\n';
    }
  }
  return out;
}

// ── demo_world ───────────────────────────────────────────────────────

function parseParticipants(block: string): ParticipantsSection[] {
  const sections: ParticipantsSection[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const sid = stripWrapping(t[i++]);
    if (i >= t.length || !t[i].startsWith('{')) {
      break;
    }
    const section: ParticipantsSection = { id: sid, entries: [] };
    const st = tokenize(unwrapBlock(t[i++]));
    let j = 0;
    while (j < st.length) {
      const eid = stripWrapping(st[j++]);
      if (j >= st.length || !st[j].startsWith('{')) {
        break;
      }
      section.entries.push({
        id: eid,
        fields: readRecordFields(unwrapBlock(st[j++])),
      });
    }
    sections.push(section);
  }
  return sections;
}

export const parseDemoWorld: Parser = (id: string, data: string) => {
  const world: DemoWorld = {
    id,
    standard: '',
    description: '',
    participants: [],
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'standard') {
        world.standard = stripWrapping(value());
      } else if (keyword === 'description') {
        world.description = stripWrapping(value());
      } else if (keyword === 'participants') {
        world.participants = parseParticipants(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'demo_world', id },
  );

  return ctx => {
    ctx.demoWorlds[id] = world;
    return ctx;
  };
};

export const dumpDemoWorld: Dumper<DemoWorld> = function (w) {
  let out: string = 'demo_world ' + w.id + ' {\n';
  if (w.standard) {
    out += '  standard ' + dumpBareSafe(w.standard) + '\n';
  }
  if (w.description) {
    out += '  description "' + escapeString(w.description) + '"\n';
  }
  if (w.participants.length > 0) {
    out += '  participants {\n';
    for (const s of w.participants) {
      out += '    ' + dumpBareSafe(s.id) + ' {\n';
      for (const e of s.entries) {
        out += '      ' + dumpBareSafe(e.id) + ' {\n';
        out += dumpRecordFields(e.fields, '        ');
        out += '      }\n';
      }
      out += '    }\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

// ── storyline ────────────────────────────────────────────────────────

function parseSubjectEntries(block: string): StorylineSubjectEntry[] {
  const entries: StorylineSubjectEntry[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const kind = stripWrapping(t[i++]);
    if (i >= t.length) {
      break;
    }
    const eid = stripWrapping(t[i++]);
    const entry: StorylineSubjectEntry = { kind, id: eid, fields: {} };
    if (i < t.length && t[i].startsWith('{')) {
      entry.fields = readRecordFields(unwrapBlock(t[i++]));
    }
    entries.push(entry);
  }
  return entries;
}

export const parseStoryline: Parser = (id: string, data: string) => {
  const storyline: Storyline = {
    id,
    name: '',
    idPrefix: '',
    party: { laboratory: '', authority: '' },
    subject: [],
    records: [],
    notes: [],
  };

  forEachEntry(
    data,
    (keyword, value, peek) => {
      if (keyword === 'name') {
        storyline.name = stripWrapping(value());
      } else if (keyword === 'id_prefix') {
        storyline.idPrefix = stripWrapping(value());
      } else if (keyword === 'party') {
        const pt = tokenize(unwrapBlock(value()));
        for (let j = 0; j + 1 < pt.length; j += 2) {
          if (pt[j] === 'laboratory') {
            storyline.party.laboratory = stripWrapping(pt[j + 1]);
          } else if (pt[j] === 'authority') {
            storyline.party.authority = stripWrapping(pt[j + 1]);
          }
        }
      } else if (keyword === 'subject') {
        storyline.subject = parseSubjectEntries(unwrapBlock(value()));
      } else if (keyword === 'record') {
        // record <store> <id> { … } — a three-token facet claiming
        // through peek/value manually (value() consumes one token per
        // call).
        const store = stripWrapping(value());
        const idHead = peek();
        if (idHead === undefined || idHead.startsWith('{')) {
          throw new Error(
            `Parsing error: storyline. ID ${id}: record ${store} is missing its id and block`,
          );
        }
        const rid = stripWrapping(value());
        const blockHead = peek();
        if (blockHead === undefined || !blockHead.startsWith('{')) {
          throw new Error(
            `Parsing error: storyline. ID ${id}: record ${store} ${rid} is missing its block`,
          );
        }
        storyline.records.push({
          store,
          id: rid,
          fields: readRecordFields(unwrapBlock(value())),
        });
      } else if (keyword === 'note') {
        storyline.notes.push(stripWrapping(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'storyline', id },
  );

  return ctx => {
    ctx.storylines[id] = storyline;
    return ctx;
  };
};

export const dumpStoryline: Dumper<Storyline> = function (s) {
  let out: string = 'storyline ' + s.id + ' {\n';
  if (s.name) {
    out += '  name "' + escapeString(s.name) + '"\n';
  }
  if (s.idPrefix) {
    out += '  id_prefix ' + dumpBareSafe(s.idPrefix) + '\n';
  }
  if (s.party.laboratory || s.party.authority) {
    out += '  party {';
    if (s.party.laboratory) {
      out += ' laboratory ' + dumpBareSafe(s.party.laboratory);
    }
    if (s.party.authority) {
      out += ' authority ' + dumpBareSafe(s.party.authority);
    }
    out += ' }\n';
  }
  if (s.subject.length > 0) {
    out += '  subject {\n';
    for (const e of s.subject) {
      out += '    ' + dumpBareSafe(e.kind) + ' ' + dumpBareSafe(e.id) + ' {\n';
      out += dumpRecordFields(e.fields, '      ');
      out += '    }\n';
    }
    out += '  }\n';
  }
  for (const r of s.records) {
    out +=
      '  record ' + dumpBareSafe(r.store) + ' ' + dumpBareSafe(r.id) + ' {\n';
    out += dumpRecordFields(r.fields, '    ');
    out += '  }\n';
  }
  for (const n of s.notes) {
    out += '  note "' + escapeString(n) + '"\n';
  }
  out += '}\n';
  return out;
};
