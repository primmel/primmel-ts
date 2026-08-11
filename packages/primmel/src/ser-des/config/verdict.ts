// ─────────────────────────────────────────────────────────────────────
// Verdict construct (OIML SMART TODO.refactor/04 — canonical verdict
// chain: "derive once, reference everywhere"):
//   verdict mdlo_normalized {
//     symbol "C_M"
//     behavior temp-effect-min-dead-load
//     quantity { kind dimensionless }
//     derive "ocl{abs(c_m * t_f / delta_t * (d_max - d_min) / (n * v_min))}"
//     inputs { c_m t_f delta_t d_max d_min n v_min }
//     source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1.4" }
//   }
//
// symbol/behavior (TODO.roadmap/10): the display symbol and the behavior
// the quantity is derived from (the behavior→I/O→characteristic link).
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
import tokenize from '../tokenize';
import { escapeString, unwrapBlock, stripWrapping } from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
import { readSource, stripColon } from './field-parser';
import { parseAcceptance, dumpAcceptance } from './acceptance';
import {
  parseRefFromReaders,
  foldRefIntoLegacy,
  dumpRefs,
  dumpSourceRefAsRef,
} from './ref';
import type { Dumper, Parser } from '../types';

const VALID_SERIES_REDUCTIONS: SeriesReduction[] = [
  'none',
  'max',
  'mean',
  'worst_case',
  'max_abs_over_window',
];

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
    acceptance: null,
    source: null,
  };

  forEachEntry(
    data,
    (keyword, value, peek) => {
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
      } else if (keyword === 'symbol') {
        result.symbol = unwrapped(value);
      } else if (keyword === 'behavior') {
        result.behavior = value();
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
      } else if (keyword === 'acceptance') {
        result.acceptance = parseAcceptance(unwrapBlock(value()));
      } else if (keyword === 'source' || keyword === 'reference') {
        // Repeated provenance blocks accumulate; `source` stays first.
        const src = readSource(unwrapBlock(value()));
        (result.sourceRefs ??= []).push(src);
        if (!result.source) {
          result.source = src;
        }
      } else if (keyword === 'ref') {
        // The unified typed reference (docs/primmel/18).
        const r = parseRefFromReaders(value, peek, stripWrapping, unwrapBlock);
        if (!foldRefIntoLegacy(result, r)) {
          (result.refs ??= []).push(r);
        }
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
  if (v.symbol) {
    out += '  symbol "' + escapeString(v.symbol) + '"\n';
  }
  if (v.behavior) {
    out += '  behavior ' + v.behavior + '\n';
  }
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
  if (v.acceptance) {
    out += dumpAcceptance(v.acceptance, '  ') + '\n';
  }
  const verdictSources =
    v.sourceRefs && v.sourceRefs.length > 0
      ? v.sourceRefs
      : v.source && (v.source.doc || v.source.clause)
        ? [v.source]
        : [];
  for (const s of verdictSources) {
    // The canonical provenance spelling (docs/primmel/18 §18.4).
    out += dumpSourceRefAsRef(s, '  ', escapeString);
  }
  out += dumpRefs(v.refs, '  ', escapeString);
  out += '}\n';
  return out;
};
