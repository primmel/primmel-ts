// ─────────────────────────────────────────────────────────────────────
// Uncertainty-budget construct (register W5 — the language side of the
// GUM plane): one measured quantity's uncertainty components and the
// coverage factor of the expansion. The budget is a DECLARATION — the
// propagation law is the GUM's, computed by the evaluation plane
// (plurimath#488); the model names the components, their kinds, and
// their provenance, never the arithmetic:
//   uncertainty_budget u_ref {
//     target mpe_error
//     coverage k 2
//     component u_cal {
//       type B
//       distribution rectangular
//       half_width 0.5
//       unit "kg"
//       ref derives-from "urn:...#clause-..."
//     }
//     component u_rep {
//       type A
//       series reference_pair_error
//     }
//   }
// ─────────────────────────────────────────────────────────────────────

import type UncertaintyBudget from '../../types/UncertaintyBudget';
import type { UncertaintyBudgetComponent } from '../../types/UncertaintyBudget';
import {
  escapeString,
  stripWrapping,
  unwrapBlock,
  tokenizePackage,
} from '../tokenize';
import { readSource, dumpBareSafe } from './field-parser';
import { parseRef, foldRefIntoLegacy, dumpSourceRefAsRef } from './ref';
import { dumpCorrespondences, parseCorresponds } from './correspondence';
import { skipUnknownValue } from '../parse-block';
import type { Dumper, Parser } from '../types';

const DISTRIBUTIONS = new Set([
  'rectangular',
  'triangular',
  'normal',
  'ushape',
]);

function readComponent(block: string): UncertaintyBudgetComponent {
  const c: UncertaintyBudgetComponent = {
    id: '',
    type: 'B',
    series: '',
    distribution: '',
    halfWidth: '',
    unit: '',
    source: null,
    description: '',
  };
  const t = tokenizePackage(block);
  let i = 0;
  while (i < t.length) {
    const kw = t[i++];
    if (i >= t.length) {
      throw new Error(
        `Parsing error: uncertainty_budget component. ID ${c.id}: Expecting value for ${kw}`,
      );
    }
    if (kw === 'type') {
      const v = stripWrapping(t[i++]);
      if (v !== 'A' && v !== 'B') {
        throw new Error(
          `Parsing error: uncertainty_budget component. ID ${c.id}: unknown type "${v}" (A evaluates the statistics of a series; B states a distribution)`,
        );
      }
      c.type = v;
    } else if (kw === 'series') {
      c.series = stripWrapping(t[i++]);
    } else if (kw === 'distribution') {
      const v = stripWrapping(t[i++]);
      if (!DISTRIBUTIONS.has(v)) {
        throw new Error(
          `Parsing error: uncertainty_budget component. ID ${c.id}: unknown distribution "${v}" (rectangular | triangular | normal | ushape)`,
        );
      }
      c.distribution = v;
    } else if (kw === 'half_width') {
      c.halfWidth = stripWrapping(t[i++]);
    } else if (kw === 'unit') {
      c.unit = stripWrapping(t[i++]);
    } else if (kw === 'description') {
      c.description = stripWrapping(t[i++]);
    } else if (kw === 'source') {
      c.source = readSource(unwrapBlock(t[i++]));
    } else {
      i = skipUnknownValue(t, i, kw);
    }
  }
  return c;
}

export const parseUncertaintyBudget: Parser = function (id, data) {
  const result: UncertaintyBudget = {
    id,
    target: '',
    coverageK: '',
    components: [],
    source: null,
  };
  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const kw = t[i++];
    if (i >= t.length) {
      throw new Error(
        `Parsing error: uncertainty_budget. ID ${id}: Expecting value for ${kw}`,
      );
    }
    if (kw === 'target') {
      result.target = stripWrapping(t[i++]);
    } else if (kw === 'coverage') {
      const head = stripWrapping(t[i++]);
      if (head !== 'k') {
        throw new Error(
          `Parsing error: uncertainty_budget. ID ${id}: coverage states its factor — coverage k <number>`,
        );
      }
      result.coverageK = stripWrapping(t[i++]);
    } else if (kw === 'component') {
      // the entry shape: `component <id> { … }` — the id is the bare
      // token between the keyword and the block
      if (t[i].startsWith('{')) {
        throw new Error(
          `Parsing error: uncertainty_budget. ID ${id}: a component carries an id — component <id> { … }`,
        );
      }
      const cid = stripWrapping(t[i++]);
      const c = readComponent(unwrapBlock(t[i++]));
      c.id = cid;
      result.components.push(c);
    } else if (kw === 'source') {
      result.source = readSource(unwrapBlock(t[i++]));
    } else if (kw === 'ref') {
      const rr = parseRef(t, i, stripWrapping, unwrapBlock);
      if (!foldRefIntoLegacy(result, rr.ref)) {
        (result.refs ??= []).push(rr.ref);
      }
      i = rr.next;
    } else if (kw === 'corresponds') {
      const cc = parseCorresponds(t, i, stripWrapping);
      (result.correspondences ??= []).push(cc.corr);
      i = cc.next;
    } else {
      i = skipUnknownValue(t, i, kw);
    }
  }
  return ctx => {
    ctx.uncertaintyBudgets[id] = result;
    return ctx;
  };
};

export const dumpUncertaintyBudget: Dumper<UncertaintyBudget> = function (b) {
  let out = 'uncertainty_budget ' + b.id + ' {\n';
  if (b.target) {
    out += '  target ' + b.target + '\n';
  }
  if (b.coverageK) {
    out += '  coverage k ' + b.coverageK + '\n';
  }
  for (const c of b.components) {
    out += '  component ' + c.id + ' {\n';
    out += '    type ' + c.type + '\n';
    if (c.type === 'A' && c.series) {
      out += '    series ' + c.series + '\n';
    }
    if (c.type === 'B') {
      if (c.distribution) {
        out += '    distribution ' + c.distribution + '\n';
      }
      if (c.halfWidth) {
        out += '    half_width ' + c.halfWidth + '\n';
      }
      if (c.unit) {
        out += '    unit "' + escapeString(c.unit) + '"\n';
      }
    }
    if (c.description) {
      out += '    description "' + escapeString(c.description) + '"\n';
    }
    if (c.source && (c.source.doc || c.source.clause)) {
      out += dumpSourceRefAsRef(c.source, '    ', escapeString);
    }
    out += '  }\n';
  }
  if (b.source && (b.source.doc || b.source.clause)) {
    out += dumpSourceRefAsRef(b.source, '  ', escapeString);
  }
  out += dumpCorrespondences(
    b.correspondences,
    '  ',
    escapeString,
    dumpBareSafe,
  );
  out += '}\n';
  return out;
};
