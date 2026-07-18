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
      } else if (command === 'vocab_ref') {
        // vocab_ref { register viml-2022 clause "0.10" } (v2 G7)
        const inner = tokenizePackage(value());
        const ref: { register: string; clause: string } = {
          register: '',
          clause: '',
        };
        for (let k = 0; k + 1 < inner.length; k += 2) {
          if (inner[k] === 'register') {
            ref.register = stripWrapping(inner[k + 1]);
          }
          if (inner[k] === 'clause') {
            ref.clause = stripWrapping(inner[k + 1]);
          }
        }
        result.vocabRef = ref;
      } else if (command === 'vocab_term') {
        result.vocabTerm = stripWrapping(value());
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
  if (term.vocabRef) {
    out +=
      '  vocab_ref { register ' +
      term.vocabRef.register +
      ' clause "' +
      escapeString(term.vocabRef.clause) +
      '" }\n';
  }
  if (term.vocabTerm) {
    out += '  vocab_term "' + escapeString(term.vocabTerm) + '"\n';
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
