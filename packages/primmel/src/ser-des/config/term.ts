import type { Dumper, Parser } from '../types';
import { removePackage, tokenizePackage } from '../tokenize';
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

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'label') {
          result.label = removePackage(t[i++]);
        } else if (command === 'definition') {
          result.definition = removePackage(t[i++]);
        } else if (command === 'symbol') {
          // symbol reference is a bare ID (e.g., `symbol Emax`).
          // Strip wrapping quotes if present (defensive — most models use bare IDs).
          const raw = t[i++];
          result.symbolId =
            raw.length >= 2 && raw.charAt(0) === '"' && raw.charAt(raw.length - 1) === '"'
              ? raw.slice(1, -1)
              : raw;
        } else if (command === 'reference') {
          result.referenceIds = tokenizePackage(t[i++]);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: term. ID ${id}: Expecting value for ${command}`,
        );
      }
    }
  }

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
