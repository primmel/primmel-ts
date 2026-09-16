// ─────────────────────────────────────────────────────────────────────
// `calculation_context` construct (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — the evaluation-side wiring of computation
// inputs to their subject-chain sources (types/CalculationContext.ts
// carries the banner and the grammar sketch). The source scalar stays
// parse-total (the legacy-token rejection is C133's, check-side); the
// codec stays total.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping, unwrapBlock } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, stripColon } from './field-parser';
import CalculationContext, {
  CalculationContextField,
} from '../../types/CalculationContext';

export const parseCalculationContext: Parser = (id: string, data: string) => {
  const context: CalculationContext = { id, fields: [] };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'field') {
        const field: CalculationContextField = {
          id: stripWrapping(stripColon(value())),
          source: '',
          expression: '',
        };
        forEachEntry(
          unwrapBlock(value()),
          (k2, v2) => {
            if (k2 === 'source') {
              field.source = stripWrapping(v2());
            } else if (k2 === 'expression') {
              field.expression = stripWrapping(v2());
            } else {
              return false;
            }
            return true;
          },
          { construct: 'calculation_context', id },
        );
        context.fields.push(field);
      } else {
        return false;
      }
      return true;
    },
    { construct: 'calculation_context', id },
  );

  return ctx => {
    ctx.calculationContexts[id] = context;
    return ctx;
  };
};

export const dumpCalculationContext: Dumper<CalculationContext> = function (c) {
  let out: string = 'calculation_context ' + dumpBareSafe(c.id) + ' {\n';
  for (const f of c.fields) {
    let entry =
      '  field ' + dumpBareSafe(f.id) + ' { source ' + dumpBareSafe(f.source);
    if (f.expression) {
      entry += ' expression "' + escapeString(f.expression) + '"';
    }
    out += entry + ' }\n';
  }
  out += '}\n';
  return out;
};
