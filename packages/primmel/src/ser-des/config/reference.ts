import type { Dumper, Parser } from '../types';
import { escapeString, unwrapBlock, tokenizePackage } from '../tokenize';
import Reference from '../../types/Reference';

export const parseReference: Parser = (id: string, data: string) => {
  const ref: Reference = {
    id: id,
    document: '',
    clause: '',
  };
  if (data !== '') {
    const t: string[] = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const keyword: string = t[i++];
      if (i < t.length) {
        if (keyword === 'document') {
          ref.document = unwrapBlock(t[i++]);
        } else if (keyword === 'clause') {
          ref.clause = unwrapBlock(t[i++]);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: reference. ID ${id}: Expecting value for ${keyword}`,
        );
      }
    }
  }

  return ctx => {
    ctx.references[id] = ref;
    return ctx;
  };
};

export const dumpReference: Dumper<Reference> = function (ref) {
  let out: string = 'reference ' + ref.id + ' {\n';
  out += '  document "' + escapeString(ref.document) + '"\n';
  out += '  clause "' + escapeString(ref.clause) + '"\n';
  out += '}\n';
  return out;
};
