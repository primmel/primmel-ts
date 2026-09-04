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
        } else if (keyword === 'title') {
          ref.title = unwrapBlock(t[i++]);
        } else if (keyword === 'org') {
          ref.org = unwrapBlock(t[i++]);
        } else if (keyword === 'edition') {
          ref.edition = unwrapBlock(t[i++]);
        } else if (keyword === 'urn') {
          ref.urn = unwrapBlock(t[i++]);
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
  if (ref.title) {
    out += '  title "' + escapeString(ref.title) + '"\n';
  }
  if (ref.org) {
    out += '  org "' + escapeString(ref.org) + '"\n';
  }
  if (ref.edition) {
    out += '  edition "' + escapeString(ref.edition) + '"\n';
  }
  if (ref.urn) {
    out += '  urn "' + escapeString(ref.urn) + '"\n';
  }
  out += '}\n';
  return out;
};
