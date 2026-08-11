// ─────────────────────────────────────────────────────────────────────
// Test point set construct (specification/test-point-sets.yaml):
//   test_point_set r144-cgm-points {
//     description "..."
//     source { doc "urn:oiml:pub:r:144-2:2013" clause "1.2" }
//     cardinality {
//       linear { min_points 3 rule "min +10 %, mid ±10 %, max −10 % of the measuring range" }
//       nonlinear { min_points 5 rule "uniformly distributed" }
//     }
//     repetitions_per_point 3
//     points {
//       point min-10pct { fraction 0.10 anchor range_min offset "+10 % of range" }
//       point mid { fraction 0.50 anchor range_mid offset "±10 %" }
//     }
//   }
//
// Conformance tests reference the set via `design { test_points { ref … } }`.
// ─────────────────────────────────────────────────────────────────────

import type TestPointSet from '../../types/TestPointSet';
import type { TestPoint } from '../../types/TestPointSet';
import tokenize from '../tokenize';
import { escapeString, unwrapBlock, stripWrapping } from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
import { readSource, stripColon } from './field-parser';
import {
  parseRefFromReaders,
  foldRefIntoLegacy,
  dumpRefs,
  dumpSourceRefAsRef,
} from './ref';
import type { Dumper, Parser } from '../types';

function parseCardinality(
  block: string,
): Record<string, { minPoints: number | null; rule: string }> {
  const out: Record<string, { minPoints: number | null; rule: string }> = {};
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const name = stripColon(t[i++]);
    if (!name) {
      break;
    }
    if (i < t.length && t[i] === ':') {
      i++;
    }
    if (i < t.length && t[i].startsWith('{')) {
      const ct = tokenize(unwrapBlock(t[i++]));
      const entry = { minPoints: null as number | null, rule: '' };
      let j = 0;
      while (j < ct.length) {
        const cc = ct[j++];
        if (j >= ct.length) {
          break;
        }
        if (cc === 'min_points') {
          entry.minPoints = Number(stripWrapping(ct[j++]));
        } else if (cc === 'rule') {
          entry.rule = stripWrapping(ct[j++]);
        } else {
          unwrapBlock(ct[j++]);
        }
      }
      out[name] = entry;
    }
  }
  return out;
}

function parsePoints(block: string): TestPoint[] {
  const out: TestPoint[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'point') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    const point: TestPoint = {
      id: stripWrapping(t[i++]),
      fraction: null,
      anchor: '',
      offset: '',
    };
    if (i < t.length && t[i].startsWith('{')) {
      const pt = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < pt.length) {
        const pc = pt[j++];
        if (j >= pt.length) {
          break;
        }
        if (pc === 'fraction') {
          point.fraction = Number(stripWrapping(pt[j++]));
        } else if (pc === 'anchor') {
          point.anchor = stripWrapping(pt[j++]);
        } else if (pc === 'offset') {
          point.offset = stripWrapping(pt[j++]);
        } else {
          unwrapBlock(pt[j++]);
        }
      }
    }
    out.push(point);
  }
  return out;
}

export const parseTestPointSet: Parser = function (id, data) {
  const result: TestPointSet = {
    id,
    description: '',
    source: null,
    cardinality: {},
    repetitionsPerPoint: null,
    points: [],
  };

  forEachEntry(
    data,
    (keyword, value, peek) => {
      if (keyword === 'description') {
        result.description = unwrapped(value);
      } else if (keyword === 'source') {
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
      } else if (keyword === 'cardinality') {
        result.cardinality = parseCardinality(unwrapBlock(value()));
      } else if (keyword === 'repetitions_per_point') {
        result.repetitionsPerPoint = Number(stripWrapping(value()));
      } else if (keyword === 'points') {
        result.points = parsePoints(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'test_point_set', id },
  );

  return ctx => {
    ctx.testPointSets[id] = result;
    return ctx;
  };
};

export const dumpTestPointSet: Dumper<TestPointSet> = function (s) {
  let out = 'test_point_set ' + s.id + ' {\n';
  if (s.description) {
    out += '  description "' + escapeString(s.description) + '"\n';
  }
  const tpsSources =
    s.sourceRefs && s.sourceRefs.length > 0
      ? s.sourceRefs
      : s.source && (s.source.doc || s.source.clause)
        ? [s.source]
        : [];
  for (const src of tpsSources) {
    // The canonical provenance spelling (docs/primmel/18 §18.4).
    out += dumpSourceRefAsRef(src, '  ', escapeString);
  }
  out += dumpRefs(s.refs, '  ', escapeString);
  const ckeys = Object.keys(s.cardinality);
  if (ckeys.length > 0) {
    out += '  cardinality {\n';
    for (const name of ckeys) {
      const c = s.cardinality[name];
      let line = '    ' + name + ' { ';
      if (c.minPoints !== null) {
        line += 'min_points ' + c.minPoints + ' ';
      }
      if (c.rule) {
        line += 'rule "' + escapeString(c.rule) + '" ';
      }
      out += line + '}\n';
    }
    out += '  }\n';
  }
  if (s.repetitionsPerPoint !== null) {
    out += '  repetitions_per_point ' + s.repetitionsPerPoint + '\n';
  }
  if (s.points.length > 0) {
    out += '  points {\n';
    for (const p of s.points) {
      let line = '    point ' + p.id + ' { ';
      if (p.fraction !== null) {
        line += 'fraction ' + p.fraction + ' ';
      }
      if (p.anchor) {
        line += 'anchor ' + p.anchor + ' ';
      }
      if (p.offset) {
        line += 'offset "' + escapeString(p.offset) + '" ';
      }
      out += line + '}\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};
