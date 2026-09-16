// ─────────────────────────────────────────────────────────────────────
// `formula_note` construct (smart TODO.roadmap/40 batch 4; the
// packages-as-SSOT epic) — a symbol-annotation register: one note text
// applying to MANY symbols (the formulas_used/invariant registry
// precedent; types/Symbol.ts carries the type, folded beside the
// symbols it annotates):
//
//   formula_note note-1 {
//     text "Observe extreme caution by referring to calculation
//          procedure for correct application of these formulae."
//     applies_to { c_c c_c_30_20 c_dr conversion_factor_f r_i }
//   }
//
// The applies_to targets resolve at check time (C126), per-register
// gated (the C58 doctrine); the codec stays total.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import tokenize, { escapeString, stripWrapping } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, stripColon } from './field-parser';
import type { FormulaNote } from '../../types/Symbol';

function readIdList(block: string): string[] {
  // Wrap-tolerant: `{ a b }` block OR bare scalar (the subject.ts idiom).
  return tokenize(stripWrapping(block))
    .map(stripColon)
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

export const parseFormulaNote: Parser = (id: string, data: string) => {
  const note: FormulaNote = {
    id,
    text: '',
    appliesTo: [],
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'text') {
        note.text = stripWrapping(value());
      } else if (keyword === 'applies_to') {
        note.appliesTo = readIdList(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'formula_note', id },
  );

  return ctx => {
    ctx.formulaNotes[id] = note;
    return ctx;
  };
};

export const dumpFormulaNote: Dumper<FormulaNote> = function (n) {
  let out: string = 'formula_note ' + n.id + ' {\n';
  if (n.text) {
    out += '  text "' + escapeString(n.text) + '"\n';
  }
  if (n.appliesTo.length > 0) {
    out += '  applies_to { ' + n.appliesTo.map(dumpBareSafe).join(' ') + ' }\n';
  }
  out += '}\n';
  return out;
};
