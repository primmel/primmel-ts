import type Provision from '../../types/Provision';
import type { Dumper, Parser, Resolver } from '../types';
import { removePackage, tokenizePackage } from '../tokenize';
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

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'modality') {
          result.modality = t[i++];
        } else if (command === 'condition') {
          result.condition = removePackage(t[i++]);
        } else if (command === 'reference') {
          result._relations.ref = tokenizePackage(t[i++]);
        } else {
          result.subject.set(command, t[i++]);
        }
      } else {
        throw new Error(
          'Parsing error: provision. ID ' +
            id +
            ': Expecting value for ' +
            command,
        );
      }
    }
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
    out += '  ' + key + ' ' + value + '\n';
  });
  out += '  condition "' + pro.condition + '"\n';
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
