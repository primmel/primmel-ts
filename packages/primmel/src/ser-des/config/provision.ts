import type Provision from '../../types/Provision';
import type { Dumper, Parser, Resolver } from '../types';
import { escapeString, tokenizePackage } from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
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

  forEachEntry(
    data,
    (command, value) => {
      if (command === 'modality') {
        result.modality = value();
      } else if (command === 'condition') {
        result.condition = unwrapped(value);
      } else if (command === 'reference') {
        result._relations.ref = tokenizePackage(value());
      } else {
        // Unknown command becomes a subject key → its raw value.
        // (Provisions are intentionally extensible: free-form key/value
        // pairs are part of the spec.)
        result.subject.set(command, value());
      }
      return true;
    },
    { construct: 'provision', id },
  );

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
    out += '  ' + key + ' ' + value + '\n';
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
