// ─────────────────────────────────────────────────────────────────────
// dimension (top-level form — Primmel v3.2, TODO.primmel/11; MN 114
// clause 10.6, primmel/spec#18 ask 2): the free-standing applicability
// axis. One grammar, two placements — the facet set is exactly the
// instrument inline dimension's (label, scope, description, cardinality
// (parse-enforced single|set), label_separator, reference/source
// provenance, values { … } with label/description/payload/implies/
// term_ref), plus the top-level-only `values_of <register>` (0..1)
// naming a program register whose members ARE the value domain (the
// documented register is `capabilities`):
//
//   dimension power-supply-axis {
//     label "Power supply"
//     cardinality single
//     values {
//       ac-mains { label "AC mains" }
//       ac-and-battery { label "AC mains and battery" implies { ac-mains battery } }
//     }
//     ref derives-from "urn:oiml:pub:r:144-1:2013#clause-4.5.1"
//   }
//
//   dimension capabilities {
//     label "Capabilities"
//     cardinality set
//     values_of capabilities
//   }
//
// A dimension carries either `values` or `values_of`, never both (C111
// dimension-shape). The declaration populates the merged package's
// applicability dimension namespace (clause 11.1.1) — the resolution
// domain of every applicability entry (C3).
// ─────────────────────────────────────────────────────────────────────

import type { ConstructDefinition } from './index';
import type { Parser } from '../types';
import type { ClassificationDimension } from '../../types/Subject';
import { unwrapBlock } from '../tokenize';
import { dumpDimension, parseDimension } from './subject';

export const parseTopLevelDimension: Parser = function (id, data) {
  const dim = parseDimension(id, unwrapBlock(data));
  return ctx => {
    ctx.dimensions[id] = dim;
    return ctx;
  };
};

export const dumpTopLevelDimension = function (d: ClassificationDimension) {
  return dumpDimension(d, '');
};

export const dimensionConstruct = {
  keyword: 'dimension',
  field: 'dimensions',
  takesID: true,
  parse: parseTopLevelDimension,
  dump: dumpTopLevelDimension,
} as const satisfies ConstructDefinition;
