import type { Dumper, Parser } from '../types';
import { tokenizePackage } from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
import type Term from '../../types/Term';

export const parseTerm: Parser = function (id, data) {
  const result: Term = {
    id,
    label: '',
    definition: '',
    symbolId: '',
    referenceIds: [],
    ref: [],
  };

  forEachEntry(
    data,
    (command, value) => {
      if (command === 'label') {
        result.label = unwrapped(value);
      } else if (command === 'definition') {
        result.definition = unwrapped(value);
      } else if (command === 'symbol') {
        // symbol reference is a bare ID (e.g., `symbol Emax`).
        // Strip wrapping quotes if present (defensive — most models use bare IDs).
        const raw = value();
        result.symbolId =
          raw.length >= 2 &&
          raw.charAt(0) === '"' &&
          raw.charAt(raw.length - 1) === '"'
            ? raw.slice(1, -1)
            : raw;
      } else if (command === 'reference') {
        result.referenceIds = tokenizePackage(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'term', id },
  );

  return ctx => {
    ctx.terms[id] = result;
    return ctx;
  };
};

export const dumpTerm: Dumper<Term> = function (term) {
  let out: string = 'term ' + term.id + ' {\n';
  if (term.label) {
    out += '  label "' + term.label + '"\n';
  }
  if (term.definition) {
    out += '  definition "' + term.definition + '"\n';
  }
  if (term.symbolId) {
    out += '  symbol ' + term.symbolId + '\n';
  }
  if (term.referenceIds.length > 0) {
    out += '  reference {\n';
    for (const r of term.referenceIds) {
      out += '    ' + r + '\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};
