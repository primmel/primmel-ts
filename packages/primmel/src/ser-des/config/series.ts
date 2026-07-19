// ─────────────────────────────────────────────────────────────────────
// Shared series-declaration parser + dumper.
//
// Symbols, conformance-test variables, and form datalist fields can all
// hold a SERIES (ordered rows of axis values + one measured cell). The
// OCL series ops (reading_at / window / drift_over /
// pairwise_max_difference / group_by / change_since) select over the
// declared axis/cell identifiers, so the shape is declared once here:
//
//   series {
//     axis elapsed_min { unit "min" role time }
//     axis cgm { type reference_material }
//     cell { symbol change_v unit "v" }
//   }
//
// Maps 1:1 to `series_declaration` in data/schemas/form.yaml.
// ─────────────────────────────────────────────────────────────────────

import type { SeriesAxis, SeriesDecl } from '../../types/Series';
import tokenize from '../tokenize';
import { escapeString, unwrapBlock, stripWrapping } from '../tokenize';

/** Parse the content of a `series { … }` block. */
export function parseSeriesDecl(block: string): SeriesDecl {
  const decl: SeriesDecl = { axes: [], cellSymbol: '', cellUnit: '' };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'axis' && cmd !== 'cell') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    if (cmd === 'axis') {
      const axis: SeriesAxis = {
        id: stripWrapping(t[i++]),
        unit: '',
        type: '',
        role: '',
      };
      if (i < t.length && t[i].startsWith('{')) {
        const ablock = unwrapBlock(t[i++]);
        const at = tokenize(ablock);
        let j = 0;
        while (j < at.length) {
          const ac = at[j++];
          if (j >= at.length) {
            break;
          }
          if (ac === 'unit') {
            axis.unit = stripWrapping(at[j++]);
          } else if (ac === 'type') {
            axis.type = stripWrapping(at[j++]);
          } else if (ac === 'role') {
            axis.role = stripWrapping(at[j++]);
          } else {
            unwrapBlock(at[j++]);
          }
        }
      }
      decl.axes.push(axis);
    } else {
      const cblock = unwrapBlock(t[i++]);
      const ct = tokenize(cblock);
      let j = 0;
      while (j < ct.length) {
        const cc = ct[j++];
        if (j >= ct.length) {
          break;
        }
        if (cc === 'symbol') {
          decl.cellSymbol = stripWrapping(ct[j++]);
        } else if (cc === 'unit') {
          decl.cellUnit = stripWrapping(ct[j++]);
        } else {
          unwrapBlock(ct[j++]);
        }
      }
    }
  }
  return decl;
}

/**
 * Dump a series declaration as a single-line `series { … }` block (no
 * trailing newline) — callers embed it in their own line layout.
 */
export function dumpSeriesDecl(decl: SeriesDecl): string {
  let out = 'series { ';
  for (const a of decl.axes) {
    out += 'axis ' + a.id + ' { ';
    if (a.unit) {
      out += 'unit "' + escapeString(a.unit) + '" ';
    }
    if (a.type) {
      out += 'type ' + a.type + ' ';
    }
    if (a.role) {
      out += 'role ' + a.role + ' ';
    }
    out += '} ';
  }
  out += 'cell { ';
  if (decl.cellSymbol) {
    out += 'symbol ' + decl.cellSymbol + ' ';
  }
  if (decl.cellUnit) {
    out += 'unit "' + escapeString(decl.cellUnit) + '" ';
  }
  out += '} }';
  return out;
}
