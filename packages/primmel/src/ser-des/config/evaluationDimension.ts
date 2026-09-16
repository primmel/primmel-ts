// ─────────────────────────────────────────────────────────────────────
// `evaluation_dimensions` construct (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — the form-facing classification field schema
// (types/EvaluationDimension.ts carries the banner and the grammar
// sketch). The type and setting vocabularies are parse-enforced (the
// fail-closed precedent); the enum/field-name resolutions are
// check-enforced (C134) — the codec stays total. `per_channel` is
// deliberately absent (the owner-settled single home is kernel
// Instrument.perChannel).
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping, unwrapBlock } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, stripColon } from './field-parser';
import EvaluationDimensions, {
  EvaluationDimensionField,
} from '../../types/EvaluationDimension';

const EVALUATION_FIELD_TYPES = [
  'integer',
  'number',
  'string',
  'text',
  'boolean',
  'date',
] as const;

const EVALUATION_FIELD_SETTINGS = [
  'MUST',
  'SHALL',
  'RECOMMEND',
  'SHOULD',
  'MAY',
  'OPTIONAL',
] as const;

export const parseEvaluationDimensions: Parser = (id: string, data: string) => {
  const dims: EvaluationDimensions = { id, label: '', fields: [] };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'label') {
        dims.label = stripWrapping(value());
      } else if (keyword === 'field') {
        const field: EvaluationDimensionField = {
          id: stripWrapping(stripColon(value())),
          label: '',
          type: '',
          enumRef: '',
          required: false,
          editable: true,
          setting: '',
          multiple: false,
        };
        forEachEntry(
          unwrapBlock(value()),
          (k2, v2) => {
            if (k2 === 'label') {
              field.label = stripWrapping(v2());
            } else if (k2 === 'type') {
              const t = stripWrapping(v2());
              if (!(EVALUATION_FIELD_TYPES as readonly string[]).includes(t)) {
                throw new Error(
                  `Parsing error: evaluation_dimensions. ID ${id}: Unknown field type "${t}" (valid: ${EVALUATION_FIELD_TYPES.join(', ')})`,
                );
              }
              field.type = t;
            } else if (k2 === 'enum') {
              field.enumRef = stripWrapping(v2());
            } else if (k2 === 'required') {
              field.required = v2() === 'true';
            } else if (k2 === 'editable') {
              field.editable = v2() === 'true';
            } else if (k2 === 'setting') {
              const s = stripWrapping(v2());
              if (
                !(EVALUATION_FIELD_SETTINGS as readonly string[]).includes(s)
              ) {
                throw new Error(
                  `Parsing error: evaluation_dimensions. ID ${id}: Unknown setting "${s}" (valid: ${EVALUATION_FIELD_SETTINGS.join(', ')})`,
                );
              }
              field.setting = s;
            } else if (k2 === 'multiple') {
              field.multiple = v2() === 'true';
            } else {
              return false;
            }
            return true;
          },
          { construct: 'evaluation_dimensions', id },
        );
        dims.fields.push(field);
      } else {
        return false;
      }
      return true;
    },
    { construct: 'evaluation_dimensions', id },
  );

  return ctx => {
    ctx.evaluationDimensions[id] = dims;
    return ctx;
  };
};

export const dumpEvaluationDimensions: Dumper<EvaluationDimensions> = function (
  d,
) {
  let out: string = 'evaluation_dimensions ' + dumpBareSafe(d.id) + ' {\n';
  if (d.label) {
    out += '  label "' + escapeString(d.label) + '"\n';
  }
  for (const f of d.fields) {
    out += '  field ' + dumpBareSafe(f.id) + ' {\n';
    if (f.label) {
      out += '    label "' + escapeString(f.label) + '"\n';
    }
    if (f.type) {
      out += '    type ' + dumpBareSafe(f.type) + '\n';
    }
    if (f.enumRef) {
      out += '    enum ' + dumpBareSafe(f.enumRef) + '\n';
    }
    out += '    required ' + (f.required ? 'true' : 'false') + '\n';
    out += '    editable ' + (f.editable ? 'true' : 'false') + '\n';
    if (f.setting) {
      out += '    setting ' + dumpBareSafe(f.setting) + '\n';
    }
    if (f.multiple) {
      out += '    multiple true\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};
