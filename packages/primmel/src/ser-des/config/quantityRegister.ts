// ─────────────────────────────────────────────────────────────────────
// quantity_register (Primmel v3, TODO.roadmap/06) — the typed
// unit/quantity-kind registry of a package (doctrine §6.3), upgrading
// bare string unit ids into typed register entries:
//
//   quantity_register si {
//     kind mass { dimensions { M 1 } si_unit kg description "Mass." }
//     kind temperature { dimensions { Θ 1 } si_unit K }
//     unit kg { symbol "kg" label "kilogram" kind mass factor 1 }
//     unit g { symbol "g" label "gram" kind mass factor 0.001 }
//     unit degC { symbol "°C" label "degree Celsius" kind temperature
//                 factor 1 offset 273.15 }
//   }
//
// A kind carries the dimension vector (SI base-dimension exponents) and
// the SI coherent unit; a unit carries its symbol, its kind, and the
// conversion to SI (multiplicative factor, affine offset for degC).
// Comparison coherence is judged on KINDS, not unit strings (linter C33).
// A rec package EXTENDS the register with domain units; it never
// redefines SI entries (C33 duplicate-unit rule).
// ─────────────────────────────────────────────────────────────────────

import tokenize, {
  escapeString,
  stripWrapping,
  tokenizePackage,
  unwrapBlock,
} from '../tokenize';
import { dumpBareSafe, stripColon } from './field-parser';
import { parseCorresponds } from './correspondence';
import type { ConstructDefinition } from './index';
import type { Correspondence } from '../../types/Correspondence';
import type {
  QuantityKindDef,
  QuantityRegister,
  UnitDef,
} from '../../types/Quantity';

function readDimensions(block: string): Record<string, number> {
  const out: Record<string, number> = {};
  const t = tokenize(block);
  for (let i = 0; i + 1 < t.length; i += 2) {
    const dim = stripColon(t[i]);
    const exp = Number(t[i + 1]);
    if (dim && !Number.isNaN(exp)) {
      out[dim] = exp;
    }
  }
  return out;
}

function readNumber(raw: string, fallback: number): number {
  const n = Number(stripWrapping(raw));
  return Number.isNaN(n) ? fallback : n;
}

function parseKind(id: string, block: string): QuantityKindDef {
  const out: QuantityKindDef = {
    id,
    dimensions: {},
    siUnit: '',
    description: '',
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'dimensions') {
      out.dimensions = readDimensions(unwrapBlock(t[i++]));
    } else if (cmd === 'si_unit') {
      out.siUnit = stripWrapping(t[i++]);
    } else if (cmd === 'description') {
      out.description = stripWrapping(t[i++]);
    } else if (cmd === 'corresponds') {
      const { corr, next } = parseCorresponds(t, i, stripWrapping);
      (out.correspondences ??= []).push(corr);
      i = next;
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return out;
}

function parseUnit(id: string, block: string): UnitDef {
  const out: UnitDef = {
    id,
    symbol: '',
    label: '',
    kind: '',
    factorToSI: 1,
    offsetToSI: 0,
    definition: '',
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'symbol') {
      out.symbol = stripWrapping(t[i++]);
    } else if (cmd === 'label') {
      out.label = stripWrapping(t[i++]);
    } else if (cmd === 'kind') {
      out.kind = stripWrapping(t[i++]);
    } else if (cmd === 'factor') {
      out.factorToSI = readNumber(t[i++], 1);
    } else if (cmd === 'offset') {
      out.offsetToSI = readNumber(t[i++], 0);
    } else if (cmd === 'definition') {
      out.definition = stripWrapping(t[i++]);
    } else if (cmd === 'corresponds') {
      const { corr, next } = parseCorresponds(t, i, stripWrapping);
      (out.correspondences ??= []).push(corr);
      i = next;
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return out;
}

const parseQuantityRegister: ConstructDefinition['parse'] = function (
  id,
  data,
) {
  const result: QuantityRegister = {
    id,
    kinds: [],
    units: [],
    referenceIds: [],
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'kind') {
      result.kinds.push(parseKind(stripColon(t[i++]), unwrapBlock(t[i++])));
    } else if (cmd === 'unit') {
      result.units.push(parseUnit(stripColon(t[i++]), unwrapBlock(t[i++])));
    } else if (cmd === 'reference') {
      result.referenceIds = tokenize(stripWrapping(t[i++]))
        .map(stripWrapping)
        .filter(s => s.length > 0);
    } else {
      unwrapBlock(t[i++]);
    }
  }

  return ctx => {
    ctx.quantityRegisters[id] = result;
    return ctx;
  };
};

// ── dump ─────────────────────────────────────────────────────────────

/** The inline corresponds form — register entries dump on ONE line, so
 *  the facet rides inside the entry's braces (v3.2, clause 13.4). */
function dumpCorrespondencesInline(
  corrs: Correspondence[] | undefined,
): string {
  let out = '';
  for (const c of corrs ?? []) {
    out +=
      ' corresponds ' +
      dumpBareSafe(c.scheme) +
      ' "' +
      escapeString(c.concept) +
      '"';
    if (c.projections.length > 0) {
      out += ' {';
      for (const p of c.projections) {
        out += ' projection ' + dumpBareSafe(p.codec) + ' {';
        for (const e of p.entries) {
          out += ' ' + dumpBareSafe(e.key) + ' ' + dumpBareSafe(e.value);
        }
        out += ' }';
      }
      out += ' }';
    }
  }
  return out;
}

function dumpDimensions(dimensions: Record<string, number>): string {
  const keys = Object.keys(dimensions);
  if (keys.length === 0) {
    return '';
  }
  return (
    ' dimensions { ' + keys.map(k => k + ' ' + dimensions[k]).join(' ') + ' }'
  );
}

const dumpQuantityRegister = function (reg: QuantityRegister): string {
  let out = 'quantity_register ' + reg.id + ' {\n';
  for (const k of reg.kinds) {
    let line = '  kind ' + k.id + ' {' + dumpDimensions(k.dimensions);
    if (k.siUnit) {
      line += ' si_unit "' + escapeString(k.siUnit) + '"';
    }
    if (k.description) {
      line += ' description "' + escapeString(k.description) + '"';
    }
    line += dumpCorrespondencesInline(k.correspondences);
    out += line + ' }\n';
  }
  for (const u of reg.units) {
    let line = '  unit ' + dumpBareSafe(u.id) + ' {';
    if (u.symbol) {
      line += ' symbol "' + escapeString(u.symbol) + '"';
    }
    if (u.label) {
      line += ' label "' + escapeString(u.label) + '"';
    }
    if (u.kind) {
      line += ' kind ' + u.kind;
    }
    if (u.factorToSI !== 1) {
      line += ' factor ' + u.factorToSI;
    }
    if (u.offsetToSI !== 0) {
      line += ' offset ' + u.offsetToSI;
    }
    if (u.definition) {
      line += ' definition "' + escapeString(u.definition) + '"';
    }
    line += dumpCorrespondencesInline(u.correspondences);
    out += line + ' }\n';
  }
  if (reg.referenceIds.length > 0) {
    out += '  reference { ' + reg.referenceIds.join(' ') + ' }\n';
  }
  out += '}\n';
  return out;
};

export const quantityRegisterConstruct = {
  keyword: 'quantity_register',
  field: 'quantityRegisters',
  takesID: true,
  parse: parseQuantityRegister,
  dump: dumpQuantityRegister,
} as const;
