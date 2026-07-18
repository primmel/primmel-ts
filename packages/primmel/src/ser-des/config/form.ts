import type { Dumper, Parser } from '../types';
import tokenize from '../tokenize';
import {
  escapeString,
  unwrapBlock,
  stripWrapping,
  tokenizePackage,
} from '../tokenize';
import {
  parseFormField,
  parseApplicability,
  parseSubformRef,
  readFieldHead,
  dumpFormField,
  dumpApplicabilityEntries,
} from './field-parser';
import type Form from '../../types/Form';
import type { FormField, PassFail } from '../../types/Form';

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
          result.name = stripWrapping(t[i++]);
        } else if (command === 'description') {
          result.description = stripWrapping(t[i++]);
        } else if (command === 'data_class') {
          result.dataClassId = stripWrapping(t[i++]);
        } else if (command === 'header') {
          result.headerFormId = stripWrapping(t[i++]);
        } else if (command === 'conformance_process') {
          const tok = t[i++];
          if (tok.startsWith('{')) {
            // conformance_process { id1 id2 } — multi-test form
            result.conformanceProcessIds = tokenize(unwrapBlock(tok)).map(stripWrapping);
            result.conformanceProcessId = result.conformanceProcessIds[0] ?? '';
          } else {
            result.conformanceProcessId = stripWrapping(tok);
          }
        } else if (command === 'applicability') {
          result.applicability = parseApplicability(unwrapBlock(t[i++]));
        } else if (command === 'field') {
          // field <name> [: <type>] { … } — typed heads included (W1a repair)
          const head = readFieldHead(t, i);
          if (head) {
            result.fields.push(
              parseFormField(head.name, head.block, head.type || undefined),
            );
            i = head.next;
          } else {
            i++; // not a field head — skip the token, keep scanning
          }
        } else if (command === 'subform_ref') {
          // subform_ref SubformID { parameters { ... } applicability { ... } }
          const subformId = t[i++];
          const refBlock = i < t.length ? unwrapBlock(t[i++]) : '';
          result.fields.push(makeSubformRefField(subformId, refBlock));
        } else if (command === 'pass_fail') {
          result.passFail = parsePassFail(unwrapBlock(t[i++]));
        } else if (command === 'reference') {
          result.referenceIds = tokenizePackage(t[i++]).map(stripWrapping);
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

function parsePassFail(block: string): PassFail {
  const pf: PassFail = { criteria: '', passIf: '' };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i < t.length) {
      if (cmd === 'criteria') {
        pf.criteria = stripWrapping(t[i++]);
      } else if (cmd === 'pass_if') {
        pf.passIf = stripWrapping(t[i++]);
      } else {
        unwrapBlock(t[i++]);
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
  if (f.conformanceProcessIds && f.conformanceProcessIds.length > 1) {
    out += '  conformance_process { ' + f.conformanceProcessIds.join(' ') + ' }\n';
  } else if (f.conformanceProcessId) {
    out += '  conformance_process ' + f.conformanceProcessId + '\n';
  }
  if (f.applicability.length > 0) {
    out +=
      '  applicability {\n    ' +
      dumpApplicabilityEntries(f.applicability).trim() +
      '\n  }\n';
  }
  for (const field of f.fields) {
    out += dumpFormField(field, '  ');
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
