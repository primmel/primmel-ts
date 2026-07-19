// ─────────────────────────────────────────────────────────────────────
// Verdict construct (OIML SMART TODO.refactor/04 — canonical verdict
// chain: "derive once, reference everywhere"):
//   verdict mdlo_normalized {
//     quantity { kind dimensionless }
//     derive "ocl{abs(c_m * t_f / delta_t * (d_max - d_min) / (n * v_min))}"
//     inputs { c_m t_f delta_t d_max d_min n v_min }
//     source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1.4" }
//   }
//
//   verdict drift_error {
//     quantity { kind volume-fraction unit "ppm" }
//     derive "ocl{indication - cgm_certified_value}"
//     inputs { indication cgm_certified_value }
//     series_reduction max_abs_over_window
//     source { doc "urn:oiml:pub:r:144-2:2013" clause "4.8" }
//   }
//
// Requirements (limit.accepts), conformance tests, and form fields
// reference the verdict id instead of restating the derivation.
// Maps 1:1 to verdicts.yaml (data/schemas/verdicts.yaml).
// ─────────────────────────────────────────────────────────────────────

import type Verdict from '../../types/Verdict';
import type { SeriesReduction } from '../../types/Verdict';
import type { SourceRef } from '../../types/Subject';
import tokenize from '../tokenize';
import { escapeString, unwrapBlock, stripWrapping } from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
import { stripColon } from './field-parser';
import type { Dumper, Parser } from '../types';

const VALID_SERIES_REDUCTIONS: SeriesReduction[] = [
  'none',
  'max',
  'mean',
  'worst_case',
  'max_abs_over_window',
];

function readSource(block: string): SourceRef {
  const src: SourceRef = { doc: '', clause: '' };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'doc') {
      src.doc = stripWrapping(t[i++]);
    } else if (cmd === 'clause') {
      src.clause = stripWrapping(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return src;
}

function readIdList(block: string): string[] {
  return tokenize(stripWrapping(block))
    .map(stripColon)
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

export const parseVerdict: Parser = function (id, data) {
  const result: Verdict = {
    id,
    quantityKind: '',
    unit: '',
    derive: '',
    inputs: [],
    seriesReduction: null,
    source: null,
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'quantity') {
        const qt = tokenize(unwrapBlock(value()));
        let j = 0;
        while (j < qt.length) {
          const qc = qt[j++];
          if (j >= qt.length) {
            break;
          }
          if (qc === 'kind') {
            result.quantityKind = stripWrapping(qt[j++]);
          } else if (qc === 'unit') {
            result.unit = stripWrapping(qt[j++]);
          } else {
            unwrapBlock(qt[j++]);
          }
        }
      } else if (keyword === 'derive' || keyword === 'expression') {
        result.derive = unwrapped(value);
      } else if (keyword === 'inputs' || keyword === 'uses') {
        result.inputs = readIdList(value());
      } else if (keyword === 'series_reduction') {
        const v = value() as SeriesReduction;
        if (!VALID_SERIES_REDUCTIONS.includes(v)) {
          throw new Error(
            `Parsing error: verdict. ID ${id}: Unknown series_reduction ${v} (valid: ${VALID_SERIES_REDUCTIONS.join(
              ', ',
            )})`,
          );
        }
        result.seriesReduction = v;
      } else if (keyword === 'source' || keyword === 'reference') {
        result.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'verdict', id },
  );

  return ctx => {
    ctx.verdicts[id] = result;
    return ctx;
  };
};

export const dumpVerdict: Dumper<Verdict> = function (v) {
  let out = 'verdict ' + v.id + ' {\n';
  if (v.quantityKind) {
    out += '  quantity { kind ' + v.quantityKind;
    if (v.unit) {
      out += ' unit "' + escapeString(v.unit) + '"';
    }
    out += ' }\n';
  }
  if (v.derive) {
    out += '  derive "' + escapeString(v.derive) + '"\n';
  }
  if (v.inputs.length > 0) {
    out += '  inputs { ' + v.inputs.join(' ') + ' }\n';
  }
  if (v.seriesReduction) {
    out += '  series_reduction ' + v.seriesReduction + '\n';
  }
  if (v.source && (v.source.doc || v.source.clause)) {
    out +=
      '  source { doc "' +
      escapeString(v.source.doc) +
      '" clause "' +
      escapeString(v.source.clause) +
      '" }\n';
  }
  out += '}\n';
  return out;
};
