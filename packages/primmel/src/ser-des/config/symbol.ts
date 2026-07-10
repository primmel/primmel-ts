import type { Dumper, Parser, Resolver } from '../types';
import { escapeString, tokenizePackage } from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
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

  forEachEntry(
    data,
    (command, value) => {
      if (command === 'name') {
        result.name = unwrapped(value);
      } else if (command === 'definition') {
        result.definition = unwrapped(value);
      } else if (command === 'type') {
        const v = value() as SymbolType;
        if (!VALID_SYMBOL_TYPES.includes(v)) {
          throw new Error(
            `Parsing error: symbol. ID ${id}: Unknown type ${v} (valid: ${VALID_SYMBOL_TYPES.join(
              ', ',
            )})`,
          );
        }
        result.type = v;
      } else if (command === 'unit') {
        result.unit = unwrapped(value);
      } else if (command === 'latex') {
        result.latex = unwrapped(value);
      } else if (command === 'values') {
        result.values = tokenizePackage(value());
      } else if (command === 'reference') {
        result._relations.ref = tokenizePackage(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'symbol', id },
  );

  return ctx => {
    ctx.symbols[id] = result;
    return ctx;
  };
};

export const resolveSymbol: Resolver<Symbol, ResolvableSymbol> = function (
  ctx,
  unresolved,
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
  out += '  name "' + escapeString(s.name) + '"\n';
  if (s.definition) {
    out += '  definition "' + escapeString(s.definition) + '"\n';
  }
  out += '  type ' + s.type + '\n';
  if (s.unit && s.unit !== '1') {
    out += '  unit "' + escapeString(s.unit) + '"\n';
  }
  if (s.latex) {
    out += '  latex "' + escapeString(s.latex) + '"\n';
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
