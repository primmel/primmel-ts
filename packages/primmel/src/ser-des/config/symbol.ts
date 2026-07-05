import type { Dumper, Parser, Resolver } from '../types';
import { removePackage, tokenizePackage } from '../tokenize';
import type Symbol from '../../types/Symbol';
import type { SymbolType, ResolvableSymbol } from '../../types/Symbol';
import type Reference from '../../types/Reference';
import { resolveFromContext } from '../resolve';

const VALID_SYMBOL_TYPES: SymbolType[] = [
  'number',
  'integer',
  'string',
  'boolean',
  'enum',
];

export const parseSymbol: Parser = function (id, data) {
  const result: ResolvableSymbol = {
    id,
    name: '',
    definition: '',
    type: 'number',
    unit: '1',
    latex: '',
    values: [],
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
        if (command === 'name') {
          result.name = removePackage(t[i++]);
        } else if (command === 'definition') {
          result.definition = removePackage(t[i++]);
        } else if (command === 'type') {
          const v = t[i++] as SymbolType;
          if (!VALID_SYMBOL_TYPES.includes(v)) {
            throw new Error(
              `Parsing error: symbol. ID ${id}: Unknown type ${v} (valid: ${VALID_SYMBOL_TYPES.join(
                ', '
              )})`
            );
          }
          result.type = v;
        } else if (command === 'unit') {
          result.unit = removePackage(t[i++]);
        } else if (command === 'latex') {
          result.latex = removePackage(t[i++]);
        } else if (command === 'values') {
          result.values = tokenizePackage(t[i++]);
        } else if (command === 'reference') {
          result._relations.ref = tokenizePackage(t[i++]);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: symbol. ID ${id}: Expecting value for ${command}`
        );
      }
    }
  }

  return ctx => {
    ctx.symbols[id] = result;
    return ctx;
  };
};

export const resolveSymbol: Resolver<Symbol, ResolvableSymbol> = function (
  ctx,
  unresolved
) {
  const ref: Reference[] = [];
  for (const id of unresolved._relations.ref) {
    const r = resolveFromContext<Reference>(ctx, 'references', id);
    if (r !== undefined) {
      ref.push(r);
    }
  }
  return { ...unresolved, ref };
};

export const dumpSymbol: Dumper<Symbol> = function (s) {
  let out = 'symbol ' + s.id + ' {\n';
  out += '  name "' + s.name + '"\n';
  if (s.definition) {
    out += '  definition "' + s.definition + '"\n';
  }
  out += '  type ' + s.type + '\n';
  if (s.unit && s.unit !== '1') {
    out += '  unit "' + s.unit + '"\n';
  }
  if (s.latex) {
    out += '  latex "' + s.latex + '"\n';
  }
  if (s.values.length > 0) {
    out += '  values ' + s.values.join(' ') + '\n';
  }
  if (s.ref.length > 0) {
    out += '  reference {\n';
    for (const r of s.ref) {
      out += '    ' + r.id + '\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};
