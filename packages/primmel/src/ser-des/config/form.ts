import type { Dumper, Parser } from '../types';
import { escapeString, removePackage, stripWrapping, tokenizePackage } from '../tokenize';
import { parseFormField } from './field-parser';
import type Form from '../../types/Form';
import type {
  FormField,
  ApplicabilityEntry,
  PassFail,
  SubformRef,
} from '../../types/Form';

export const parseForm: Parser = function (id, data) {
  const result: Form = {
    id,
    name: '',
    description: '',
    dataClassId: '',
    headerFormId: '',
    conformanceProcessId: '',
    applicability: [],
    fields: [],
    passFail: null,
    referenceIds: [],
    ref: [],
  };

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'name') {
          result.name = removePackage(t[i++]);
        } else if (command === 'description') {
          result.description = removePackage(t[i++]);
        } else if (command === 'data_class') {
          result.dataClassId = stripWrapping(t[i++]);
        } else if (command === 'header') {
          result.headerFormId = stripWrapping(t[i++]);
        } else if (command === 'conformance_process') {
          result.conformanceProcessId = stripWrapping(t[i++]);
        } else if (command === 'applicability') {
          result.applicability = parseApplicability(removePackage(t[i++]));
        } else if (command === 'field') {
          const fieldName = t[i++];
          if (i < t.length) {
            const fieldBlock = removePackage(t[i++]);
            result.fields.push(parseFormField(fieldName, fieldBlock));
          }
        } else if (command === 'subform_ref') {
          // subform_ref SubformID { parameters { ... } applicability { ... } }
          const subformId = t[i++];
          const refBlock = i < t.length ? removePackage(t[i++]) : '';
          result.fields.push(makeSubformRefField(subformId, refBlock));
        } else if (command === 'pass_fail') {
          result.passFail = parsePassFail(removePackage(t[i++]));
        } else if (command === 'reference') {
          result.referenceIds = tokenizePackage(t[i++]);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: form. ID ${id}: Expecting value for ${command}`,
        );
      }
    }
  }

  return ctx => {
    ctx.forms[id] = result;
    return ctx;
  };
};

function parseApplicability(block: string): ApplicabilityEntry[] {
  const entries: ApplicabilityEntry[] = [];
  const t = tokenizePackage(block);
  let i = 0;
  while (i < t.length) {
    const dimension = t[i++];
    if (i >= t.length) {
      break;
    }
    if (t[i] === ':') {
      i++;
    }
    if (i < t.length) {
      const valueBlock = removePackage(t[i++]);
      // valueBlock is `[A, B]` or `{ A: 5, B: 5 }`
      const trimmed = valueBlock.trim();
      if (trimmed.startsWith('[')) {
        const inner = trimmed.slice(1, -1);
        const values = inner.split(/[,\s]+/).filter(s => s.length > 0);
        entries.push({ dimension, values, mapping: null });
      } else if (trimmed.startsWith('{')) {
        // Mapping form
        const inner = trimmed.slice(1, -1);
        const mapping: Record<string, string | number> = {};
        for (const pair of inner
          .split(/[,\n]+/)
          .map(s => s.trim())
          .filter(s => s)) {
          const m = pair.match(/^(\w+)\s*:\s*(.+)$/);
          if (m) {
            mapping[m[1]] = m[2].trim();
          }
        }
        entries.push({ dimension, values: [], mapping });
      } else {
        // Single value
        entries.push({ dimension, values: [trimmed], mapping: null });
      }
    }
  }
  return entries;
}

function parsePassFail(block: string): PassFail {
  const pf: PassFail = { criteria: '', passIf: '' };
  const t = tokenizePackage(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i < t.length) {
      if (cmd === 'criteria') {
        pf.criteria = removePackage(t[i++]);
      } else if (cmd === 'pass_if') {
        pf.passIf = removePackage(t[i++]);
      } else {
        removePackage(t[i++]);
      }
    }
  }
  return pf;
}

function makeSubformRefField(subformId: string, block: string): FormField {
  const field: FormField = {
    name: '', // caller wraps this in a named field
    type: 'array',
    label: '',
    definition: '',
    unit: '',
    required: false,
    measurementMethod: '',
    calculationId: null,
    calculationBindings: [],
    derivation: '',
    evaluation: null,
    values: [],
    defaultValue: '',
    hasDefault: false,
    referenceIds: [],
    fields: [],
    itemsType: '',
    subformRef: parseSubformRef(subformId, block),
  };
  return field;
}

function parseSubformRef(subformId: string, block: string): SubformRef {
  const ref: SubformRef = {
    subformId,
    parameters: {},
    applicability: [],
  };
  if (block && block.trim()) {
    const t = tokenizePackage(block);
    let i = 0;
    while (i < t.length) {
      const cmd = t[i++];
      if (i < t.length) {
        if (cmd === 'parameters') {
          const pblock = removePackage(t[i++]);
          const pt = tokenizePackage(pblock);
          let j = 0;
          while (j < pt.length) {
            const key = pt[j++];
            if (j < pt.length) {
              if (pt[j] === ':') {
                j++;
              }
              if (j < pt.length) {
                ref.parameters[key] = removePackage(pt[j++]);
              }
            }
          }
        } else if (cmd === 'applicability') {
          ref.applicability = parseApplicability(removePackage(t[i++]));
        } else {
          removePackage(t[i++]);
        }
      }
    }
  }
  return ref;
}

export const dumpForm: Dumper<Form> = function (f) {
  let out = 'form ' + f.id + ' {\n';
  out += '  name "' + escapeString(f.name) + '"\n';
  if (f.description) {
    out += '  description "' + escapeString(f.description) + '"\n';
  }
  if (f.dataClassId) {
    out += '  data_class ' + f.dataClassId + '\n';
  }
  if (f.headerFormId) {
    out += '  header ' + f.headerFormId + '\n';
  }
  if (f.conformanceProcessId) {
    out += '  conformance_process ' + f.conformanceProcessId + '\n';
  }
  if (f.applicability.length > 0) {
    out += '  applicability {\n';
    for (const a of f.applicability) {
      if (a.mapping) {
        out += '    ' + a.dimension + ': { ';
        for (const [k, v] of Object.entries(a.mapping)) {
          out += k + ': ' + v + ' ';
        }
        out += '}\n';
      } else {
        out += '    ' + a.dimension + ': [' + a.values.join(', ') + ']\n';
      }
    }
    out += '  }\n';
  }
  for (const field of f.fields) {
    if (field.subformRef) {
      const sr = field.subformRef;
      out += '  subform_ref ' + sr.subformId + ' { ';
      const pkeys = Object.keys(sr.parameters);
      if (pkeys.length > 0) {
        out += 'parameters { ';
        for (const k of pkeys) {
          out += k + ': ' + sr.parameters[k] + ' ';
        }
        out += '} ';
      }
      out += '}\n';
    } else {
      out += '  field ' + field.name + ' { ';
      if (field.label) {
        out += 'label "' + escapeString(field.label) + '" ';
      }
      if (field.unit) {
        out += 'unit "' + escapeString(field.unit) + '" ';
      }
      if (field.required) {
        out += 'required true ';
      }
      out += '}\n';
    }
  }
  if (f.passFail) {
    out +=
      '  pass_fail { criteria "' +
      escapeString(f.passFail.criteria) +
      '" pass_if "' +
      escapeString(f.passFail.passIf) +
      '" }\n';
  }
  out += '}\n';
  return out;
};
