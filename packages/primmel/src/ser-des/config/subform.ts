import type { Dumper, Parser } from '../types';
import { escapeString, unwrapBlock, tokenizePackage } from '../tokenize';
import { parseFormField as parseField } from './field-parser';
import type Subform from '../../types/Subform';
import type { ParameterDecl } from '../../types/Subform';

export const parseSubform: Parser = function (id, data) {
  const result: Subform = {
    id,
    description: '',
    shapeType: 'object',
    parameters: [],
    fields: [],
  };

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'description') {
          result.description = unwrapBlock(t[i++]);
        } else if (command === 'type') {
          const v = t[i++];
          if (v === 'object' || v === 'array') {
            result.shapeType = v;
          } else {
            throw new Error(
              `Parsing error: subform. ID ${id}: type must be object or array (got ${v})`,
            );
          }
        } else if (command === 'parameters') {
          result.parameters = parseParameters(unwrapBlock(t[i++]));
        } else if (command === 'field') {
          // field is followed by `name [: type] { ... }`
          const fieldName = t[i++];
          if (i < t.length) {
            const fieldBlock = unwrapBlock(t[i++]);
            // Determine if there's a type spec between name and {
            const field = parseField(fieldName, fieldBlock);
            result.fields.push(field);
          }
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: subform. ID ${id}: Expecting value for ${command}`,
        );
      }
    }
  }

  return ctx => {
    ctx.subforms[id] = result;
    return ctx;
  };
};

function parseParameters(block: string): ParameterDecl[] {
  const params: ParameterDecl[] = [];
  const t = tokenizePackage(block);
  let i = 0;
  while (i < t.length) {
    const name = t[i++];
    if (i >= t.length) {
      break;
    }
    if (t[i] === ':') {
      i++;
    }
    const type = i < t.length ? t[i++] : 'integer';
    let description = '';
    let hasDefault = false;
    let defaultValue = '';
    let mapping: Record<string, string | number> | null = null;
    if (i < t.length && t[i].startsWith('{')) {
      const propBlock = unwrapBlock(t[i++]);
      const pt = tokenizePackage(propBlock);
      let j = 0;
      while (j < pt.length) {
        const cmd = pt[j++];
        if (j < pt.length) {
          if (cmd === 'description') {
            description = unwrapBlock(pt[j++]);
          } else if (cmd === 'default') {
            defaultValue = unwrapBlock(pt[j++]);
            hasDefault = true;
          } else if (cmd === 'mapping') {
            const mapBlock = unwrapBlock(pt[j++]);
            mapping = {};
            // Map block format: { A: 5, B: 5, C: 3 }
            const mt = tokenizePackage(mapBlock);
            let k = 0;
            while (k < mt.length) {
              const key = mt[k++];
              if (k < mt.length) {
                if (mt[k] === ':') {
                  k++;
                }
                if (k < mt.length) {
                  mapping[key] = unwrapBlock(mt[k++]);
                }
              }
            }
          } else {
            j++;
          }
        }
      }
    }
    params.push({ name, type, description, hasDefault, defaultValue, mapping });
  }
  return params;
}

export const dumpSubformType: Dumper<Subform> = function (sf) {
  let out = 'subform ' + sf.id + ' {\n';
  out += '  type ' + sf.shapeType + '\n';
  if (sf.description) {
    out += '  description "' + escapeString(sf.description) + '"\n';
  }
  if (sf.parameters.length > 0) {
    out += '  parameters {\n';
    for (const p of sf.parameters) {
      let line = '    ' + p.name + ' : ' + p.type + ' { ';
      if (p.description) {
        line += 'description "' + escapeString(p.description) + '" ';
      }
      if (p.hasDefault) {
        line += 'default ' + p.defaultValue + ' ';
      }
      if (p.mapping) {
        line += 'mapping { ';
        for (const [k, v] of Object.entries(p.mapping)) {
          line += k + ': ' + v + ' ';
        }
        line += '} ';
      }
      line += '}\n';
      out += line;
    }
    out += '  }\n';
  }
  for (const f of sf.fields) {
    out += '  field ' + f.name + ' { ';
    if (f.label) {
      out += 'label "' + escapeString(f.label) + '" ';
    }
    if (f.unit) {
      out += 'unit "' + escapeString(f.unit) + '" ';
    }
    if (f.required) {
      out += 'required true ';
    }
    out += '}\n';
  }
  out += '}\n';
  return out;
};
