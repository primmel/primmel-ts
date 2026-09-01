import type { Dumper, Parser, Resolver } from '../types';
import tokenize from '../tokenize';
import {
  escapeString,
  tokenizePackage,
  unwrapBlock,
  stripWrapping,
} from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
import { foldRefIntoLegacy, parseRefFromReaders } from './ref';
import {
  dumpCorrespondences,
  parseCorrespondsFromReaders,
} from './correspondence';
import { dumpBareSafe } from './field-parser';
import { parseSeriesDecl, dumpSeriesDecl } from './series';
import { readSource } from './field-parser';
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
  'collection',
  'array',
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
    series: null,
    kind: '',
    quantityKind: '',
    origin: '',
    legacyId: '',
    attribute: '',
    calculation: '',
    profile: '',
    sourceRef: null,
    formula: null,
    notes: [],
    ref: [],
    _relations: {
      ref: [],
    },
  };

  forEachEntry(
    data,
    (command, value, peek) => {
      if (command === 'ref') {
        // The unified typed reference (docs/primmel/18).
        const r = parseRefFromReaders(value, peek, stripWrapping, unwrapBlock);
        if (!foldRefIntoLegacy(result, r)) {
          (result.refs ??= []).push(r);
        }
        return true;
      }
      if (command === 'corresponds') {
        // The per-node correspondence annotation (MN 114 clause 19.4).
        (result.correspondences ??= []).push(
          parseCorrespondsFromReaders(value, peek, stripWrapping),
        );
        return true;
      }

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
        // The canonical spelling is the brace block (`values { A B }`).
        // A bare single value reads whole — never through tokenizePackage,
        // whose unconditional unwrapBlock strips the token's first and
        // last characters (`values DRAFT` parsed to "RAF" — the editor
        // window-2 pin). Entries store unquoted (the term-alt codec);
        // the dump re-quotes whitespace-carrying entries.
        const v = value();
        result.values = v.startsWith('{')
          ? tokenizePackage(v).map(stripWrapping)
          : [stripWrapping(v)];
      } else if (command === 'series') {
        result.series = parseSeriesDecl(unwrapBlock(value()));
      } else if (command === 'kind') {
        result.kind = stripWrapping(value());
      } else if (command === 'quantity_kind') {
        result.quantityKind = stripWrapping(value());
      } else if (command === 'origin') {
        result.origin = stripWrapping(value());
      } else if (command === 'legacy_id') {
        result.legacyId = stripWrapping(value());
      } else if (command === 'attribute') {
        result.attribute = stripWrapping(value());
      } else if (command === 'calculation') {
        result.calculation = stripWrapping(value());
      } else if (command === 'profile') {
        result.profile = stripWrapping(value());
      } else if (command === 'source') {
        result.sourceRef = readSource(unwrapBlock(value()));
      } else if (command === 'formula') {
        const ft = tokenize(unwrapBlock(value()));
        const formula = { display: '', expression: '', inputs: [] as string[] };
        let j = 0;
        while (j < ft.length) {
          const fc = ft[j++];
          if (j >= ft.length) {
            break;
          }
          if (fc === 'display') {
            formula.display = stripWrapping(ft[j++]);
          } else if (fc === 'expression') {
            formula.expression = stripWrapping(ft[j++]);
          } else if (fc === 'inputs') {
            formula.inputs = tokenize(stripWrapping(ft[j++]))
              .map(stripWrapping)
              .filter(s => s.length > 0);
          } else {
            unwrapBlock(ft[j++]);
          }
        }
        result.formula = formula;
      } else if (command === 'note') {
        result.notes.push(unwrapped(value));
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
    // The canonical spelling carries the braces: an unbraced dump
    // reparsed to one char-stripped entry and silently dropped the rest
    // (the editor window-2 pin). Whitespace-carrying entries re-quote.
    out += '  values { ' + s.values.map(dumpBareSafe).join(' ') + ' }\n';
  }
  if (s.series) {
    out += '  ' + dumpSeriesDecl(s.series) + '\n';
  }
  if (s.kind) {
    out += '  kind ' + s.kind + '\n';
  }
  if (s.quantityKind) {
    out += '  quantity_kind ' + s.quantityKind + '\n';
  }
  if (s.origin) {
    out += '  origin ' + s.origin + '\n';
  }
  if (s.legacyId) {
    out += '  legacy_id ' + s.legacyId + '\n';
  }
  if (s.attribute) {
    out += '  attribute ' + s.attribute + '\n';
  }
  if (s.calculation) {
    out += '  calculation ' + s.calculation + '\n';
  }
  if (s.profile) {
    out += '  profile ' + s.profile + '\n';
  }
  if (s.sourceRef && (s.sourceRef.doc || s.sourceRef.clause)) {
    out +=
      '  source { doc "' +
      escapeString(s.sourceRef.doc) +
      '" clause "' +
      escapeString(s.sourceRef.clause) +
      '"' +
      (s.sourceRef.fragment
        ? ' fragment "' + escapeString(s.sourceRef.fragment) + '"'
        : '') +
      ' }\n';
  }
  if (s.formula) {
    let line = '  formula { ';
    if (s.formula.display) {
      line += 'display "' + escapeString(s.formula.display) + '" ';
    }
    if (s.formula.expression) {
      line += 'expression "' + escapeString(s.formula.expression) + '" ';
    }
    if (s.formula.inputs.length > 0) {
      line += 'inputs { ' + s.formula.inputs.join(' ') + ' } ';
    }
    out += line + '}\n';
  }
  for (const note of s.notes) {
    out += '  note "' + escapeString(note) + '"\n';
  }
  if (s.ref.length > 0) {
    out += '  reference {\n';
    for (const r of s.ref) {
      out += '    ' + r.id + '\n';
    }
    out += '  }\n';
  }
  out += dumpCorrespondences(
    s.correspondences,
    '  ',
    escapeString,
    dumpBareSafe,
  );
  out += '}\n';
  return out;
};
