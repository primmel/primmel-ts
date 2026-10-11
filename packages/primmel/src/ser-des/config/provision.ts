import type Provision from '../../types/Provision';
import type { Dumper, Parser, Resolver } from '../types';
import { escapeString, tokenizePackage } from '../tokenize';
import { unescapeString, unwrapBlock } from '../tokenize';
import { ResolvableProvision } from '../../types/Provision';
import type Reference from '../../types/Reference';
import { resolveFromContext } from '../resolve';

export const parseProvision: Parser = function (id, data) {
  const result: ResolvableProvision = {
    subject: new Map<string, string>(),
    id: id,
    modality: '',
    condition: '',
    ref: [],
    _relations: {
      ref: [],
    },
  };

  // The provision's own walk — NOT forEachEntry. The free-form
  // key/value pairs are part of the spec, and a free-form value may be
  // MULTI-TOKEN (`subject claims Sample#data`): the pairwise walk
  // cannot express that (the stray tokens abort the parse and poison
  // everything after). An unknown keyword opens a free-form entry whose
  // value is every token up to the next known keyword, joined;
  // single-token values parse byte-identically to the old form.
  const KNOWN = new Set(['modality', 'condition', 'reference']);

/** Unwrap one string token: quoted → unescape; brace block → strip the
 *  braces; bare → as-is. The string-form of parse-block's unwrapped(). */
const unwrapToken = (x: string): string => {
  if (x.length >= 2 && x.startsWith('"') && x.endsWith('"')) {
    return unescapeString(x.slice(1, -1));
  }
  if (x.length >= 2 && x.startsWith('{') && x.endsWith('}')) {
    return unwrapBlock(x);
  }
  return x;
};
  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const keyword = t[i++]!;
    if (keyword === 'modality') {
      if (i >= t.length) throw new Error(`Parsing error: provision. ID ${id}: Expecting value for modality`);
      result.modality = t[i++]!;
      continue;
    }
    if (keyword === 'condition') {
      if (i >= t.length) throw new Error(`Parsing error: provision. ID ${id}: Expecting value for condition`);
      result.condition = unwrapToken(t[i++]!);
      continue;
    }
    if (keyword === 'reference') {
      if (i >= t.length) throw new Error(`Parsing error: provision. ID ${id}: Expecting value for reference`);
      result._relations.ref = tokenizePackage(t[i++]!);
      continue;
    }
    // The free-form subject entry.
    const rest: string[] = [];
    while (i < t.length && !KNOWN.has(t[i]!)) rest.push(t[i++]!);
    if (rest.length === 0) {
      // A trailing bare keyword: a free-form key with an empty value.
      result.subject.set(keyword, '');
      break;
    }
    const value = rest.map(unwrapToken).join(' ');
    result.subject.set(keyword, value);
  }

  return ctx => {
    ctx.provisions[id] = result;
    return ctx;
  };
};

export const resolveProvision: Resolver<Provision, ResolvableProvision> =
  function (ctx, unresolved) {
    const ref: Reference[] = [];
    for (const id of unresolved._relations.ref) {
      const r = resolveFromContext<Reference>(ctx, 'references', id);
      if (r !== undefined) {
        ref.push(r);
      }
    }
    return { ...unresolved, ref };
  };

export const dumpProvision: Dumper<Provision> = function (pro) {
  let out: string = 'provision ' + pro.id + ' {\n';
  pro.subject.forEach((value: string, key: string) => {
    // A multi-word value dumps QUOTED — bare, it would reparse as
    // several free-form entries. Single-token values stay bare
    // (byte-identical to the corpus).
    const v = value.includes(' ') ? `"${escapeString(value)}"` : value;
    out += '  ' + key + ' ' + v + '\n';
  });
  out += '  condition "' + escapeString(pro.condition) + '"\n';
  if (pro.modality !== '') {
    out += '  modality ' + pro.modality + '\n';
  }
  if (pro.ref.length > 0) {
    out += '  reference {\n';
    for (const r of pro.ref) {
      out += '    ' + r.id + '\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};
