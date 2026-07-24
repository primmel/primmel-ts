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
  parseRoleReferences,
  readFieldHead,
  dumpFormField,
  dumpApplicabilityEntries,
  dumpRoleReferences,
} from './field-parser';
import type Form from '../../types/Form';
import type {
  FormConstraint,
  FormField,
  FormInstance,
  PassFail,
  PassFailDerivation,
} from '../../types/Form';
import type { SourceRef } from '../../types/Subject';

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
    } else if (cmd === 'fragment') {
      src.fragment = stripWrapping(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return src;
}

export const parseForm: Parser = function (id, data) {
  const result: Form = {
    id,
    name: '',
    description: '',
    dataClassId: '',
    headerFormId: '',
    conformanceProcessId: '',
    section: '',
    requirements: [],
    formNotes: [],
    scope: '',
    formReferences: [],
    calculationContext: null,
    formInstances: [],
    formConstraints: [],
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
        } else if (command === 'section') {
          result.section = stripWrapping(t[i++]);
        } else if (command === 'requirements') {
          result.requirements = tokenizePackage(t[i++]).map(stripWrapping);
        } else if (command === 'note') {
          result.formNotes.push(stripWrapping(t[i++]));
        } else if (command === 'scope') {
          result.scope = stripWrapping(t[i++]);
        } else if (command === 'report_rows') {
          // report_rows { field examination_items item_key item }
          const rb = tokenize(unwrapBlock(t[i++]));
          const rr: { field: string; itemKey: string } = {
            field: '',
            itemKey: '',
          };
          for (let k = 0; k + 1 < rb.length; k += 2) {
            if (rb[k] === 'field') {
              rr.field = stripWrapping(rb[k + 1]);
            } else if (rb[k] === 'item_key') {
              rr.itemKey = stripWrapping(rb[k + 1]);
            }
          }
          result.reportRows = rr;
        } else if (command === 'references') {
          result.formReferences = parseRoleReferences(unwrapBlock(t[i++]));
        } else if (command === 'calculation_context') {
          result.calculationContext = parseCalculationContext(
            unwrapBlock(t[i++]),
          );
        } else if (command === 'instances') {
          result.formInstances = parseFormInstances(unwrapBlock(t[i++]));
        } else if (command === 'constraints') {
          result.formConstraints = parseFormConstraints(unwrapBlock(t[i++]));
        } else if (command === 'conformance_process') {
          const tok = t[i++];
          if (tok.startsWith('{')) {
            // conformance_process { id1 id2 } — multi-test form
            result.conformanceProcessIds = tokenize(unwrapBlock(tok)).map(
              stripWrapping,
            );
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

function parseCalculationContext(
  block: string,
): NonNullable<Form['calculationContext']> {
  const ctx: NonNullable<Form['calculationContext']> = {
    header: '',
    dimensions: false,
    tables: [],
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'header') {
      ctx.header = stripWrapping(t[i++]);
    } else if (cmd === 'dimensions') {
      ctx.dimensions = stripWrapping(t[i++]) === 'true';
    } else if (cmd === 'tables') {
      ctx.tables = tokenize(stripWrapping(t[i++]))
        .map(stripWrapping)
        .filter(s => s.length > 0);
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return ctx;
}

function parseFormInstances(block: string): FormInstance[] {
  const out: FormInstance[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'instance') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    const inst: FormInstance = { id: stripWrapping(t[i++]), name: '' };
    if (i < t.length && t[i].startsWith('{')) {
      const it = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < it.length) {
        const ic = it[j++];
        if (j >= it.length) {
          break;
        }
        if (ic === 'name') {
          inst.name = stripWrapping(it[j++]);
        } else {
          unwrapBlock(it[j++]);
        }
      }
    }
    out.push(inst);
  }
  return out;
}

function parseFormConstraints(block: string): FormConstraint[] {
  const out: FormConstraint[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'constraint') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    const c: FormConstraint = {
      id: stripWrapping(t[i++]),
      rule: '',
      onViolation: '',
      notes: '',
      source: null,
    };
    if (i < t.length && t[i].startsWith('{')) {
      const ct = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < ct.length) {
        const cc = ct[j++];
        if (j >= ct.length) {
          break;
        }
        if (cc === 'rule') {
          c.rule = stripWrapping(ct[j++]);
        } else if (cc === 'on_violation') {
          c.onViolation = stripWrapping(ct[j++]);
        } else if (cc === 'notes') {
          c.notes = stripWrapping(ct[j++]);
        } else if (cc === 'source') {
          c.source = readSource(unwrapBlock(ct[j++]));
        } else {
          unwrapBlock(ct[j++]);
        }
      }
    }
    out.push(c);
  }
  return out;
}

function parsePassFail(block: string): PassFail {
  const pf: PassFail = { criteria: '', passIf: '', derivations: [] };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i < t.length) {
      if (cmd === 'criteria') {
        pf.criteria = stripWrapping(t[i++]);
      } else if (cmd === 'pass_if') {
        pf.passIf = stripWrapping(t[i++]);
      } else if (cmd === 'derivation') {
        pf.derivations = parsePassFailDerivations(unwrapBlock(t[i++]));
      } else {
        unwrapBlock(t[i++]);
      }
    }
  }
  return pf;
}

function parsePassFailDerivations(block: string): PassFailDerivation[] {
  const out: PassFailDerivation[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'value') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    const d: PassFailDerivation = {
      name: stripWrapping(t[i++]),
      calculation: '',
      forEach: '',
      unit: '',
    };
    if (i < t.length && t[i].startsWith('{')) {
      const dt = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < dt.length) {
        const dc = dt[j++];
        if (j >= dt.length) {
          break;
        }
        if (dc === 'calculation') {
          d.calculation = stripWrapping(dt[j++]);
        } else if (dc === 'for_each') {
          d.forEach = stripWrapping(dt[j++]);
        } else if (dc === 'unit') {
          d.unit = stripWrapping(dt[j++]);
        } else {
          unwrapBlock(dt[j++]);
        }
      }
    }
    out.push(d);
  }
  return out;
}

function makeSubformRefField(subformId: string, block: string): FormField {
  const field: FormField = {
    name: '', // caller wraps this in a named field
    type: 'array',
    label: '',
    definition: '',
    unit: '',
    symbol: '',
    verdict: '',
    targets: [],
    dimension: '',
    enumRef: '',
    pattern: '',
    required: false,
    measurementMethod: '',
    calculationId: null,
    calculationBindings: [],
    derivation: '',
    evaluation: null,
    values: [],
    trueLabel: '',
    falseLabel: '',
    enumValues: [],
    defaultValue: '',
    hasDefault: false,
    referenceIds: [],
    fieldReferences: [],
    specificationReference: '',
    applicability: [],
    sourceDiscrepancy: null,
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
  if (f.section) {
    out += '  section "' + escapeString(f.section) + '"\n';
  }
  if (f.requirements.length > 0) {
    out += '  requirements { ' + f.requirements.join(' ') + ' }\n';
  }
  for (const note of f.formNotes) {
    out += '  note "' + escapeString(note) + '"\n';
  }
  if (f.scope) {
    out += '  scope ' + f.scope + '\n';
  }
  if (f.reportRows && (f.reportRows.field || f.reportRows.itemKey)) {
    out +=
      '  report_rows { field ' +
      f.reportRows.field +
      ' item_key ' +
      f.reportRows.itemKey +
      ' }\n';
  }
  if (f.formReferences.length > 0) {
    out += '  references { ' + dumpRoleReferences(f.formReferences) + ' }\n';
  }
  if (f.calculationContext) {
    const cc = f.calculationContext;
    let line = '  calculation_context { ';
    if (cc.header) {
      line += 'header ' + cc.header + ' ';
    }
    if (cc.dimensions) {
      line += 'dimensions true ';
    }
    if (cc.tables.length > 0) {
      line += 'tables { ' + cc.tables.join(' ') + ' } ';
    }
    out += line + '}\n';
  }
  if (f.formInstances.length > 0) {
    out += '  instances {\n';
    for (const inst of f.formInstances) {
      out +=
        '    instance ' +
        inst.id +
        ' { name "' +
        escapeString(inst.name) +
        '" }\n';
    }
    out += '  }\n';
  }
  if (f.formConstraints.length > 0) {
    out += '  constraints {\n';
    for (const c of f.formConstraints) {
      out += '    constraint ' + c.id + ' { ';
      if (c.rule) {
        out += 'rule "' + escapeString(c.rule) + '" ';
      }
      if (c.onViolation) {
        out += 'on_violation ' + c.onViolation + ' ';
      }
      if (c.notes) {
        out += 'notes "' + escapeString(c.notes) + '" ';
      }
      if (c.source && (c.source.doc || c.source.clause)) {
        out +=
          'source { doc "' +
          escapeString(c.source.doc) +
          '" clause "' +
          escapeString(c.source.clause) +
          '"' +
          (c.source.fragment ? ' fragment "' + escapeString(c.source.fragment) + '"' : '') +
          ' } ';
      }
      out += '}\n';
    }
    out += '  }\n';
  }
  if (f.conformanceProcessIds && f.conformanceProcessIds.length > 1) {
    out +=
      '  conformance_process { ' + f.conformanceProcessIds.join(' ') + ' }\n';
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
    out += dumpPassFail(f.passFail);
  }
  out += '}\n';
  return out;
};

function dumpPassFail(pf: PassFail): string {
  if (pf.derivations.length === 0) {
    return (
      '  pass_fail { criteria "' +
      escapeString(pf.criteria) +
      '" pass_if "' +
      escapeString(pf.passIf) +
      '" }\n'
    );
  }
  let out = '  pass_fail {\n';
  out += '    criteria "' + escapeString(pf.criteria) + '"\n';
  out += '    pass_if "' + escapeString(pf.passIf) + '"\n';
  out += '    derivation {\n';
  for (const d of pf.derivations) {
    let line = '      value ' + d.name + ' { ';
    if (d.calculation) {
      line += 'calculation "' + escapeString(d.calculation) + '" ';
    }
    if (d.forEach) {
      line += 'for_each ' + d.forEach + ' ';
    }
    if (d.unit) {
      line += 'unit "' + escapeString(d.unit) + '" ';
    }
    out += line + '}\n';
  }
  out += '    }\n';
  out += '  }\n';
  return out;
}
