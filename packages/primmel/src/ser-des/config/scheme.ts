// ─────────────────────────────────────────────────────────────────────
// The scheme-architecture constructs (smart TODO.roadmap/40; the
// packages-as-SSOT epic) — B 18:2025 3.37/3.38, §5.4, clause 15:
//
//   scheme_definition scheme_a {
//     label "Scheme A"
//     term "3.37"
//     clause "5.4.3"
//     definition "Advanced level of the OIML-CS where accreditation or
//       peer assessment is used as the basis for demonstrating
//       compliance."
//     demonstration {
//       method peer_evaluation
//       clause "5.4.3.1"
//       basis { accreditation peer_assessment }
//       note "Compliance demonstrated by peer evaluation on the basis
//         of an accreditation assessment or a peer assessment …"
//     }
//     source { doc "urn:oiml:pub:b:18:2025" clause "3.37" }
//   }
//
//   scheme_lifecycle category_scheme {
//     applies_to instrument_category
//     initial SCHEME_B
//     entry {
//       action category_included
//       automatic true
//       clause "15.1"
//       conditions_ref auto_inclusion
//       description "A category of measuring instrument … is
//         automatically included in the OIML-CS in Scheme B when the
//         conditions of §4.2 are met (§15.1) …"
//     }
//     transition SCHEME_B -> SCHEME_A action transition_period_elapsed {
//       clause "15.2"
//       description "Two years after inclusion in the OIML-CS, the
//         category automatically transitions to Scheme A (§15.2) …"
//     }
//     trigger two-year-transition {
//       kind timer
//       action transition_period_elapsed
//       window { years 2 }
//       clause "15.2"
//       deferrable true
//       deferral_note "The Management Committee may propose to the CIML
//         that a category does not automatically transition …"
//       description "The two-year Scheme-B window opened by the
//         category's inclusion …"
//     }
//     source { doc "urn:oiml:pub:b:18:2025" clause "15" }
//   }
//
// The transition surface deliberately mirrors the state_machine grammar
// (`transition <From> -> <To> action <Action> { … }`).
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
import {
  SchemeDefinition,
  SchemeDemonstration,
  SchemeLifecycle,
  SchemeLifecycleEntry,
  SchemeTransition,
  SchemeTrigger,
} from '../../types/Scheme';

function parseDemonstration(block: string): SchemeDemonstration {
  const demonstration: SchemeDemonstration = {
    method: '',
    clause: '',
    basis: [],
    note: '',
  };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'method') {
        demonstration.method = stripWrapping(value());
      } else if (keyword === 'clause') {
        demonstration.clause = stripWrapping(value());
      } else if (keyword === 'basis') {
        demonstration.basis = tokenizePackage(unwrapBlock(value())).filter(
          s => s.length > 0,
        );
      } else if (keyword === 'note') {
        demonstration.note = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'scheme_definition demonstration', id: '' },
  );
  return demonstration;
}

export const parseSchemeDefinition: Parser = (id: string, data: string) => {
  const scheme: SchemeDefinition = {
    id,
    label: '',
    term: '',
    clause: '',
    definition: '',
    demonstration: null,
    source: { doc: '', clause: '' },
  };
  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'label') {
        scheme.label = stripWrapping(value());
      } else if (keyword === 'term') {
        scheme.term = stripWrapping(value());
      } else if (keyword === 'clause') {
        scheme.clause = stripWrapping(value());
      } else if (keyword === 'definition') {
        scheme.definition = stripWrapping(value());
      } else if (keyword === 'demonstration') {
        scheme.demonstration = parseDemonstration(unwrapBlock(value()));
      } else if (keyword === 'source') {
        scheme.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'scheme_definition', id },
  );
  return ctx => {
    ctx.schemeDefinitions[id] = scheme;
    return ctx;
  };
};

function dumpSourceBlock(src: { doc: string; clause: string }): string {
  let out = '  source {\n';
  if (src.doc) {
    out += '    doc "' + escapeString(src.doc) + '"\n';
  }
  if (src.clause) {
    out += '    clause "' + escapeString(src.clause) + '"\n';
  }
  out += '  }\n';
  return out;
}

export const dumpSchemeDefinition: Dumper<SchemeDefinition> = function (s) {
  let out: string = 'scheme_definition ' + s.id + ' {\n';
  if (s.label) {
    out += '  label "' + escapeString(s.label) + '"\n';
  }
  if (s.term) {
    out += '  term "' + escapeString(s.term) + '"\n';
  }
  if (s.clause) {
    out += '  clause "' + escapeString(s.clause) + '"\n';
  }
  if (s.definition) {
    out += '  definition "' + escapeString(s.definition) + '"\n';
  }
  if (s.demonstration) {
    const d = s.demonstration;
    out += '  demonstration {\n';
    if (d.method) {
      out += '    method ' + dumpBareSafe(d.method) + '\n';
    }
    if (d.clause) {
      out += '    clause "' + escapeString(d.clause) + '"\n';
    }
    if (d.basis.length > 0) {
      out += '    basis { ' + d.basis.map(dumpBareSafe).join(' ') + ' }\n';
    }
    if (d.note) {
      out += '    note "' + escapeString(d.note) + '"\n';
    }
    out += '  }\n';
  }
  if (s.source.doc || s.source.clause) {
    out += dumpSourceBlock(s.source);
  }
  out += '}\n';
  return out;
};

function parseEntry(block: string): SchemeLifecycleEntry {
  const entry: SchemeLifecycleEntry = {
    action: '',
    automatic: false,
    clause: '',
    conditions_ref: '',
    description: '',
  };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'action') {
        entry.action = stripWrapping(value());
      } else if (keyword === 'automatic') {
        entry.automatic = value() === 'true';
      } else if (keyword === 'clause') {
        entry.clause = stripWrapping(value());
      } else if (keyword === 'conditions_ref') {
        entry.conditions_ref = stripWrapping(value());
      } else if (keyword === 'description') {
        entry.description = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'scheme_lifecycle entry', id: '' },
  );
  return entry;
}

function parseTransition(
  block: string,
): Pick<
  SchemeTransition,
  'clause' | 'decided_by' | 'on_proposal_of' | 'description'
> {
  const facets = {
    clause: '',
    decided_by: '',
    on_proposal_of: '',
    description: '',
  };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'clause') {
        facets.clause = stripWrapping(value());
      } else if (keyword === 'decided_by') {
        facets.decided_by = stripWrapping(value());
      } else if (keyword === 'on_proposal_of') {
        facets.on_proposal_of = stripWrapping(value());
      } else if (keyword === 'description') {
        facets.description = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'scheme_lifecycle transition', id: '' },
  );
  return facets;
}

function parseTrigger(id: string, block: string): SchemeTrigger {
  const trigger: SchemeTrigger = {
    id,
    kind: '',
    action: '',
    windowYears: 0,
    windowMonths: 0,
    clause: '',
    deferrable: false,
    deferral_note: '',
    description: '',
  };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'kind') {
        trigger.kind = stripWrapping(value());
      } else if (keyword === 'action') {
        trigger.action = stripWrapping(value());
      } else if (keyword === 'window') {
        const wt = tokenizePackage(unwrapBlock(value()));
        for (let i = 0; i + 1 < wt.length; i += 2) {
          if (wt[i] === 'years') {
            trigger.windowYears = parseInt(stripWrapping(wt[i + 1]!), 10) || 0;
          } else if (wt[i] === 'months') {
            trigger.windowMonths = parseInt(stripWrapping(wt[i + 1]!), 10) || 0;
          }
        }
      } else if (keyword === 'clause') {
        trigger.clause = stripWrapping(value());
      } else if (keyword === 'deferrable') {
        trigger.deferrable = value() === 'true';
      } else if (keyword === 'deferral_note') {
        trigger.deferral_note = stripWrapping(value());
      } else if (keyword === 'description') {
        trigger.description = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'scheme_lifecycle trigger', id },
  );
  return trigger;
}

export const parseSchemeLifecycle: Parser = (id: string, data: string) => {
  const lifecycle: SchemeLifecycle = {
    id,
    applies_to: '',
    initial: '',
    entry: null,
    transitions: [],
    triggers: [],
    source: { doc: '', clause: '' },
  };

  forEachEntry(
    data,
    (keyword, value, peek) => {
      if (keyword === 'applies_to') {
        lifecycle.applies_to = stripWrapping(value());
      } else if (keyword === 'initial') {
        lifecycle.initial = stripWrapping(value());
      } else if (keyword === 'entry') {
        lifecycle.entry = parseEntry(unwrapBlock(value()));
      } else if (keyword === 'transition') {
        // transition <From> -> <To> action <ActionName> { … } — the
        // state_machine surface, with framework facets in the block.
        const from = stripWrapping(value());
        const arrow = peek();
        if (arrow === undefined || (arrow !== '->' && arrow !== '→')) {
          throw new Error(
            `Parsing error: scheme_lifecycle. ID ${id}: transition ${from} is missing its '->'`,
          );
        }
        value(); // the arrow
        const to = stripWrapping(value());
        let action = '';
        if (peek() === 'action') {
          value(); // 'action'
          action = stripWrapping(value());
        }
        const head = peek();
        if (head === undefined || !head.startsWith('{')) {
          throw new Error(
            `Parsing error: scheme_lifecycle. ID ${id}: transition ${from} -> ${to} is missing its block`,
          );
        }
        const facets = parseTransition(unwrapBlock(value()));
        lifecycle.transitions.push({ from, to, action, ...facets });
      } else if (keyword === 'trigger') {
        const trigId = stripWrapping(value());
        const head = peek();
        if (head === undefined || !head.startsWith('{')) {
          throw new Error(
            `Parsing error: scheme_lifecycle. ID ${id}: trigger ${trigId} is missing its block`,
          );
        }
        lifecycle.triggers.push(parseTrigger(trigId, unwrapBlock(value())));
      } else if (keyword === 'source') {
        lifecycle.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'scheme_lifecycle', id },
  );

  return ctx => {
    ctx.schemeLifecycles[id] = lifecycle;
    return ctx;
  };
};

export const dumpSchemeLifecycle: Dumper<SchemeLifecycle> = function (l) {
  let out: string = 'scheme_lifecycle ' + l.id + ' {\n';
  if (l.applies_to) {
    out += '  applies_to ' + dumpBareSafe(l.applies_to) + '\n';
  }
  if (l.initial) {
    out += '  initial ' + dumpBareSafe(l.initial) + '\n';
  }
  if (l.entry) {
    const e = l.entry;
    out += '  entry {\n';
    if (e.action) {
      out += '    action ' + dumpBareSafe(e.action) + '\n';
    }
    out += '    automatic ' + (e.automatic ? 'true' : 'false') + '\n';
    if (e.clause) {
      out += '    clause "' + escapeString(e.clause) + '"\n';
    }
    if (e.conditions_ref) {
      out += '    conditions_ref ' + dumpBareSafe(e.conditions_ref) + '\n';
    }
    if (e.description) {
      out += '    description "' + escapeString(e.description) + '"\n';
    }
    out += '  }\n';
  }
  for (const t of l.transitions) {
    out += '  transition ' + dumpBareSafe(t.from) + ' -> ' + dumpBareSafe(t.to);
    if (t.action) {
      out += ' action ' + dumpBareSafe(t.action);
    }
    out += ' {\n';
    if (t.clause) {
      out += '    clause "' + escapeString(t.clause) + '"\n';
    }
    if (t.decided_by) {
      out += '    decided_by ' + dumpBareSafe(t.decided_by) + '\n';
    }
    if (t.on_proposal_of) {
      out += '    on_proposal_of ' + dumpBareSafe(t.on_proposal_of) + '\n';
    }
    if (t.description) {
      out += '    description "' + escapeString(t.description) + '"\n';
    }
    out += '  }\n';
  }
  for (const tr of l.triggers) {
    out += '  trigger ' + dumpBareSafe(tr.id) + ' {\n';
    if (tr.kind) {
      out += '    kind ' + dumpBareSafe(tr.kind) + '\n';
    }
    if (tr.action) {
      out += '    action ' + dumpBareSafe(tr.action) + '\n';
    }
    if (tr.windowYears > 0 || tr.windowMonths > 0) {
      let w = '    window {';
      if (tr.windowYears > 0) {
        w += ' years ' + tr.windowYears;
      }
      if (tr.windowMonths > 0) {
        w += ' months ' + tr.windowMonths;
      }
      out += w + ' }\n';
    }
    if (tr.clause) {
      out += '    clause "' + escapeString(tr.clause) + '"\n';
    }
    if (tr.deferrable) {
      out += '    deferrable true\n';
    }
    if (tr.deferral_note) {
      out += '    deferral_note "' + escapeString(tr.deferral_note) + '"\n';
    }
    if (tr.description) {
      out += '    description "' + escapeString(tr.description) + '"\n';
    }
    out += '  }\n';
  }
  if (l.source.doc || l.source.clause) {
    out += dumpSourceBlock(l.source);
  }
  out += '}\n';
  return out;
};
