import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping, tokenizePackage } from '../tokenize';
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
        // symbol reference may be a bare ID (e.g. `symbol Emax`) or a
        // quoted string (`symbol "Emax"`). stripWrapping handles both.
        result.symbolId = stripWrapping(value());
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
    out += '  label "' + escapeString(term.label) + '"\n';
  }
  if (term.definition) {
    out += '  definition "' + escapeString(term.definition) + '"\n';
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
