import ConformanceTest, {
  TestVariable,
  TestObservable,
  AcceptanceCriterion,
  TestPrecondition,
  TestInstances,
} from '../../types/ConformanceTest';
import tokenize from '../tokenize';
import {
  escapeString,
  unwrapBlock,
  stripWrapping,
  tokenizePackage,
} from '../tokenize';
import {
  stripColon,
  parseApplicability,
  dumpApplicabilityEntries,
} from './field-parser';
import { parseSeriesDecl, dumpSeriesDecl } from './series';
import {
  parseSourceDiscrepancy,
  dumpSourceDiscrepancy,
} from './sourceDiscrepancy';
import { parseAcceptance, dumpAcceptance } from './acceptance';
import { parseDesign, dumpDesign } from './design';
import {
  parseRequiredCompetence,
  dumpRequiredCompetence,
} from './competenceKind';
import { forEachEntry, unwrapped } from '../parse-block';
import { Dumper, Parser } from '../types';

function readStringList(block: string): string[] {
  return tokenize(stripWrapping(block))
    .map(stripColon)
    .map(stripWrapping)
    .filter(x => x.length > 0);
}

/** Numeric-looking values parse as numbers, everything else stays a string. */
function numOrString(s: string): string | number {
  if (s.trim() !== '' && !isNaN(Number(s))) {
    return Number(s);
  }
  return s;
}

function parseTestVariables(block: string): TestVariable[] {
  const out: TestVariable[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'variable') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    const name = stripWrapping(t[i++]);
    const v: TestVariable = {
      name,
      type: '',
      unit: '',
      source: '',
      derivation: '',
      description: '',
      itemType: '',
      series: null,
    };
    if (i < t.length && t[i].startsWith('{')) {
      const vb = unwrapBlock(t[i++]);
      const vt = tokenize(vb);
      let j = 0;
      while (j < vt.length) {
        const vc = vt[j++];
        if (j >= vt.length) {
          break;
        }
        if (vc === 'type') {
          v.type = stripWrapping(vt[j++]);
        } else if (vc === 'unit') {
          v.unit = stripWrapping(vt[j++]);
        } else if (vc === 'source') {
          v.source = stripWrapping(vt[j++]);
        } else if (vc === 'derivation') {
          v.derivation = stripWrapping(vt[j++]);
        } else if (vc === 'description') {
          v.description = stripWrapping(vt[j++]);
        } else if (vc === 'item_type') {
          v.itemType = stripWrapping(vt[j++]);
        } else if (vc === 'series') {
          v.series = parseSeriesDecl(unwrapBlock(vt[j++]));
        } else {
          unwrapBlock(vt[j++]);
        }
      }
    }
    out.push(v);
  }
  return out;
}

function parsePreconditions(block: string): TestPrecondition[] {
  const out: TestPrecondition[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'precondition') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    const pid = stripWrapping(t[i++]);
    const p: TestPrecondition = {
      id: pid,
      check: '',
      description: '',
      onViolation: 'invalid',
    };
    if (i < t.length && t[i].startsWith('{')) {
      const pb = unwrapBlock(t[i++]);
      const pt = tokenize(pb);
      let j = 0;
      while (j < pt.length) {
        const pc = pt[j++];
        if (j >= pt.length) {
          break;
        }
        if (pc === 'check') {
          p.check = stripWrapping(pt[j++]);
        } else if (pc === 'description') {
          p.description = stripWrapping(pt[j++]);
        } else if (pc === 'on_violation') {
          p.onViolation = stripWrapping(pt[j++]);
        } else if (pc === 'on_unresolvable') {
          p.onUnresolvable = stripWrapping(pt[j++]);
        } else {
          unwrapBlock(pt[j++]);
        }
      }
    }
    out.push(p);
  }
  return out;
}

function parseObservables(block: string): TestObservable[] {
  const out: TestObservable[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'observable') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    const name = stripWrapping(t[i++]);
    const o: TestObservable = { name, quantityKind: '', unit: '', as: '' };
    if (i < t.length && t[i].startsWith('{')) {
      const ob = unwrapBlock(t[i++]);
      const ot = tokenize(ob);
      let j = 0;
      while (j < ot.length) {
        const oc = ot[j++];
        if (j >= ot.length) {
          break;
        }
        if (oc === 'quantity_kind' || oc === 'quantityKind') {
          o.quantityKind = stripWrapping(ot[j++]);
        } else if (oc === 'unit') {
          o.unit = stripWrapping(ot[j++]);
        } else if (oc === 'as') {
          o.as = stripWrapping(ot[j++]);
        } else {
          unwrapBlock(ot[j++]);
        }
      }
    }
    out.push(o);
  }
  return out;
}

function parseAcceptanceCriteria(block: string, result: ConformanceTest): void {
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd === 'type') {
      result.acceptanceCriteriaType = stripWrapping(t[i++]);
      continue;
    }
    if (cmd === 'description') {
      result.acceptanceCriteriaDescription = stripWrapping(t[i++]);
      continue;
    }
    if (cmd === 'pass_if') {
      result.acceptancePassIf = stripWrapping(t[i++]);
      continue;
    }
    if (cmd !== 'criterion' && cmd !== 'item') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    // The criterion name is optional — documentary criteria (description +
    // reference only) arrive as `criterion { ... }` or `criterion "" { ... }`.
    let item = '';
    if (i < t.length && !t[i].startsWith('{')) {
      item = stripWrapping(t[i++]);
    }
    const c: AcceptanceCriterion = {
      item,
      passIf: '',
      requirementId: '',
      criterion: '',
      optional: false,
      description: '',
      reference: '',
      sourceDiscrepancy: null,
    };
    if (i < t.length && t[i].startsWith('{')) {
      const cb = unwrapBlock(t[i++]);
      const ct = tokenize(cb);
      let j = 0;
      while (j < ct.length) {
        const cc = ct[j++];
        if (j >= ct.length) {
          break;
        }
        if (cc === 'pass_if') {
          c.passIf = stripWrapping(ct[j++]);
        } else if (cc === 'requirement' || cc === 'target') {
          // `target /req/x` is the cc.yaml alias of `requirement /req/x`.
          c.requirementId = stripWrapping(ct[j++]);
        } else if (cc === 'criterion') {
          c.criterion = stripWrapping(ct[j++]);
        } else if (cc === 'optional') {
          c.optional = stripWrapping(ct[j++]) === 'true';
        } else if (cc === 'description') {
          c.description = stripWrapping(ct[j++]);
        } else if (cc === 'reference') {
          c.reference = stripWrapping(ct[j++]);
        } else if (cc === 'accepts') {
          const ab = tokenize(unwrapBlock(ct[j++]));
          const accepts = { verdict: '', op: '', limit: '' };
          for (let k = 0; k + 1 < ab.length; k += 2) {
            if (ab[k] === 'verdict') {
              accepts.verdict = stripWrapping(ab[k + 1]);
            } else if (ab[k] === 'op') {
              accepts.op = stripWrapping(ab[k + 1]);
            } else if (ab[k] === 'limit') {
              accepts.limit = stripWrapping(ab[k + 1]);
            }
          }
          c.accepts = accepts;
        } else if (cc === 'source_discrepancy') {
          c.sourceDiscrepancy = parseSourceDiscrepancy(unwrapBlock(ct[j++]));
        } else {
          unwrapBlock(ct[j++]);
        }
      }
    }
    result.acceptanceCriteria.push(c);
  }
}

function parseDerivedValues(
  block: string,
): Array<{ name: string; expression: string }> {
  const out: Array<{ name: string; expression: string }> = [];
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
    const name = stripWrapping(t[i++]);
    let expression = '';
    if (i < t.length && t[i].startsWith('{')) {
      const vb = unwrapBlock(t[i++]);
      const vt = tokenize(vb);
      let j = 0;
      while (j < vt.length) {
        const vc = vt[j++];
        if (j >= vt.length) {
          break;
        }
        if (vc === 'expression') {
          expression = stripWrapping(vt[j++]);
        } else {
          unwrapBlock(vt[j++]);
        }
      }
    }
    out.push({ name, expression });
  }
  return out;
}

export function parseTestSubject(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const key = stripColon(t[i++]);
    if (i >= t.length) {
      break;
    }
    if (t[i] === ':') {
      i++;
    }
    if (i < t.length) {
      out[key] = stripWrapping(t[i++]);
    }
  }
  return out;
}

function parseInstances(block: string): TestInstances {
  const out: TestInstances = { by: '', values: {} };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'by') {
      out.by = stripWrapping(t[i++]);
    } else if (cmd === 'values') {
      const vt = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < vt.length) {
        const key = stripColon(vt[j++]);
        if (j >= vt.length) {
          break;
        }
        if (vt[j] === ':') {
          j++;
        }
        if (j < vt.length && vt[j].startsWith('{')) {
          const pt = tokenize(unwrapBlock(vt[j++]));
          const params: Record<string, string | number> = {};
          let k = 0;
          while (k < pt.length) {
            const pkey = stripColon(pt[k++]);
            if (k >= pt.length) {
              break;
            }
            if (pt[k] === ':') {
              k++;
            }
            if (k < pt.length) {
              params[pkey] = numOrString(stripWrapping(pt[k++]));
            }
          }
          out.values[key] = params;
        }
      }
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return out;
}

export const parseConformanceTest: Parser = function (id, data) {
  const result: ConformanceTest = {
    id,
    name: '',
    type: '',
    guidance: '',
    reference: '',
    targets: [],
    bindsTo: [],
    applicability: [],
    procedure: [],
    measurements: [],
    kind: '',
    obligation: '',
    obligationNote: '',
    testSubject: {},
    variables: [],
    observables: [],
    conditionsToEnforce: [],
    preconditions: [],
    referenceMaterials: [],
    requiredCompetence: [],
    acceptanceCriteria: [],
    acceptanceCriteriaType: '',
    acceptanceCriteriaDescription: '',
    acceptancePassIf: '',
    design: null,
    acceptance: null,
    dependencies: [],
    instances: null,
    inheritsFrom: '',
    resultForms: [],
    derivedValues: [],
    sourceDiscrepancy: null,
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'name') {
        result.name = unwrapped(value);
      } else if (keyword === 'purpose') {
        result.purpose = unwrapped(value);
      } else if (keyword === 'method') {
        result.method = unwrapped(value);
      } else if (keyword === 'method_ref') {
        result.methodRef = stripWrapping(value());
      } else if (keyword === 'guidance') {
        result.guidance = unwrapped(value);
      } else if (keyword === 'type') {
        result.type = value();
      } else if (keyword === 'reference') {
        const refValue = value();
        if (refValue.startsWith('{')) {
          const inner = tokenize(unwrapBlock(refValue));
          if (inner.includes('doc') || inner.includes('clause')) {
            // Structured block: reference { doc "urn:…" clause "2.5" } (v2).
            // The optional third field `fragment` is the sentence sub-address
            // (TODO.roadmap/26) — the dumper emits it, so the parser must
            // keep it (codec symmetry, TODO.refactor/16).
            const src: { doc: string; clause: string; fragment?: string } = {
              doc: '',
              clause: '',
            };
            for (let k = 0; k + 1 < inner.length; k += 2) {
              if (inner[k] === 'doc') {
                src.doc = stripWrapping(inner[k + 1]);
              } else if (inner[k] === 'clause') {
                src.clause = stripWrapping(inner[k + 1]);
              } else if (inner[k] === 'fragment') {
                src.fragment = stripWrapping(inner[k + 1]);
              }
            }
            if (!result.sourceRef) {
              result.sourceRef = src;
            }
            (result.sourceRefs ??= []).push(src);
            if (!result.reference) {
              result.reference = src.doc;
            }
          } else {
            // Legacy block: reference { R60doc#2.10.1 } — scalar inside braces.
            // Clear sourceRefs as well as sourceRef: a mixed construct
            // (structured blocks then a legacy scalar) must not dump
            // structured blocks its scalar fields deny.
            result.sourceRef = null;
            result.sourceRefs = undefined;
            result.reference = unwrapBlock(refValue).trim();
          }
        } else {
          result.sourceRef = null;
          result.sourceRefs = undefined;
          result.reference = refValue;
        }
      } else if (keyword === 'targets') {
        result.targets = tokenizePackage(value());
      } else if (keyword === 'binds_to') {
        result.bindsTo = tokenizePackage(value());
      } else if (keyword === 'applicability') {
        result.applicability = parseApplicability(unwrapBlock(value()));
      } else if (keyword === 'procedure') {
        const block = value();
        const tokens = tokenizePackage(block);
        let i = 0;
        while (i < tokens.length) {
          const order = parseInt(tokens[i], 10);
          if (!isNaN(order) && i + 1 < tokens.length) {
            const action = unwrapped(() => tokens[i + 1]);
            const step: {
              order: number;
              action: string;
              outputs: string[];
              inputs?: string[];
            } = {
              order,
              action,
              outputs: [],
            };
            i += 2;
            if (tokens[i] === 'inputs' && i + 1 < tokens.length) {
              step.inputs = readStringList(tokens[i + 1]);
              i += 2;
            }
            if (tokens[i] === 'outputs' && i + 1 < tokens.length) {
              step.outputs = readStringList(tokens[i + 1]);
              i += 2;
            }
            result.procedure.push(step);
          } else {
            i++;
          }
        }
      } else if (keyword === 'procedure_steps') {
        result.procedureSteps = readStringList(value());
      } else if (keyword === 'kind') {
        result.kind = stripWrapping(value());
      } else if (keyword === 'obligation') {
        result.obligation = stripWrapping(value());
      } else if (keyword === 'obligation_note') {
        result.obligationNote = unwrapped(value);
      } else if (keyword === 'test_subject') {
        result.testSubject = parseTestSubject(unwrapBlock(value()));
      } else if (keyword === 'variables') {
        result.variables = parseTestVariables(unwrapBlock(value()));
      } else if (keyword === 'observables') {
        result.observables = parseObservables(unwrapBlock(value()));
      } else if (
        keyword === 'conditions_to_enforce' ||
        keyword === 'conditionsToEnforce'
      ) {
        result.conditionsToEnforce = readStringList(value());
      } else if (keyword === 'preconditions') {
        result.preconditions = parsePreconditions(unwrapBlock(value()));
      } else if (keyword === 'reference_materials') {
        result.referenceMaterials = readStringList(value());
      } else if (keyword === 'required_competence') {
        result.requiredCompetence = parseRequiredCompetence(
          unwrapBlock(value()),
        );
      } else if (keyword === 'acceptance_criteria') {
        parseAcceptanceCriteria(unwrapBlock(value()), result);
      } else if (keyword === 'design') {
        result.design = parseDesign(unwrapBlock(value()));
      } else if (keyword === 'acceptance') {
        result.acceptance = parseAcceptance(unwrapBlock(value()));
      } else if (keyword === 'dependencies') {
        result.dependencies = readStringList(value());
      } else if (keyword === 'instances') {
        result.instances = parseInstances(unwrapBlock(value()));
      } else if (keyword === 'inherits_from') {
        result.inheritsFrom = stripWrapping(value());
      } else if (keyword === 'result_forms') {
        result.resultForms = readStringList(value());
      } else if (keyword === 'produces_artifacts') {
        result.producesArtifacts = readStringList(value());
      } else if (keyword === 'report_rows') {
        result.reportRows = readStringList(value());
      } else if (keyword === 'derived_values') {
        result.derivedValues = parseDerivedValues(unwrapBlock(value()));
      } else if (keyword === 'validate_measurement') {
        const block = value();
        const tokens = tokenizePackage(block);
        for (const t of tokens) {
          if (t.startsWith('"')) {
            result.measurements.push(unwrapBlock(t));
          }
        }
      } else if (keyword === 'source_discrepancy') {
        result.sourceDiscrepancy = parseSourceDiscrepancy(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'conformance_test', id },
  );

  return ctx => {
    ctx.conformanceTests[id] = result;
    return ctx;
  };
};

export const dumpConformanceTest: Dumper<ConformanceTest> = function (ct) {
  let out = 'conformance_test ' + ct.id + ' {\n';
  if (ct.name) {
    out += '  name "' + escapeString(ct.name) + '"\n';
  }
  if (ct.type) {
    out += '  type ' + ct.type + '\n';
  }
  if (ct.purpose) {
    out += '  purpose "' + escapeString(ct.purpose) + '"\n';
  }
  if (ct.method) {
    out += '  method "' + escapeString(ct.method) + '"\n';
  }
  if (ct.methodRef) {
    out += '  method_ref ' + ct.methodRef + '\n';
  }
  if (ct.guidance) {
    out += '  guidance "' + escapeString(ct.guidance) + '"\n';
  }
  if (ct.sourceRefs && ct.sourceRefs.length > 0) {
    for (const src of ct.sourceRefs) {
      out +=
        '  reference { doc "' +
        escapeString(src.doc) +
        '" clause "' +
        escapeString(src.clause) +
        '"' +
        (src.fragment ? ' fragment "' + escapeString(src.fragment) + '"' : '') +
        ' }\n';
    }
  } else if (ct.sourceRef && ct.sourceRef.doc) {
    out +=
      '  reference { doc "' +
      escapeString(ct.sourceRef.doc) +
      '" clause "' +
      escapeString(ct.sourceRef.clause) +
      '"' +
      (ct.sourceRef.fragment ? ' fragment "' + escapeString(ct.sourceRef.fragment) + '"' : '') +
      ' }\n';
  } else if (ct.reference) {
    out += '  reference ' + ct.reference + '\n';
  }
  if (ct.targets.length > 0) {
    out += '  targets {\n';
    for (const t of ct.targets) {
      out += '    ' + t + '\n';
    }
    out += '  }\n';
  }
  if (ct.bindsTo && ct.bindsTo.length > 0) {
    out += '  binds_to {\n';
    for (const b of ct.bindsTo) {
      out += '    ' + b + '\n';
    }
    out += '  }\n';
  }
  if (ct.applicability.length > 0) {
    out +=
      '  applicability {\n    ' +
      dumpApplicabilityEntries(ct.applicability).trim() +
      '\n  }\n';
  }
  if (ct.procedure.length > 0) {
    out += '  procedure {\n';
    for (const step of ct.procedure) {
      let line = '    ' + step.order + ' "' + escapeString(step.action) + '"';
      if (step.inputs && step.inputs.length > 0) {
        line += ' inputs { ' + step.inputs.join(' ') + ' }';
      }
      if (step.outputs.length > 0) {
        line += ' outputs { ' + step.outputs.join(' ') + ' }';
      }
      out += line + '\n';
    }
    out += '  }\n';
  }
  if (ct.procedureSteps && ct.procedureSteps.length > 0) {
    out += '  procedure_steps { ' + ct.procedureSteps.join(' ') + ' }\n';
  }
  if (ct.measurements.length > 0) {
    out += '  validate_measurement {\n';
    for (const m of ct.measurements) {
      out += '    "' + escapeString(m) + '"\n';
    }
    out += '  }\n';
  }
  if (ct.kind) {
    out += '  kind ' + ct.kind + '\n';
  }
  if (ct.obligation) {
    out += '  obligation ' + ct.obligation + '\n';
  }
  if (ct.obligationNote) {
    out += '  obligation_note "' + escapeString(ct.obligationNote) + '"\n';
  }
  if (Object.keys(ct.testSubject).length > 0) {
    out += '  test_subject {\n';
    for (const [k, v] of Object.entries(ct.testSubject)) {
      out += '    ' + k + ': "' + escapeString(v) + '"\n';
    }
    out += '  }\n';
  }
  if (ct.variables.length > 0) {
    out += '  variables {\n';
    for (const v of ct.variables) {
      let line = '    variable ' + v.name + ' { ';
      if (v.type) {
        line += 'type ' + v.type + ' ';
      }
      if (v.unit) {
        line += 'unit "' + escapeString(v.unit) + '" ';
      }
      if (v.source) {
        line += 'source ' + v.source + ' ';
      }
      if (v.derivation) {
        line += 'derivation "' + escapeString(v.derivation) + '" ';
      }
      if (v.description) {
        line += 'description "' + escapeString(v.description) + '" ';
      }
      if (v.itemType) {
        line += 'item_type "' + escapeString(v.itemType) + '" ';
      }
      if (v.series) {
        line += dumpSeriesDecl(v.series) + ' ';
      }
      out += line + '}\n';
    }
    out += '  }\n';
  }
  if (ct.observables.length > 0) {
    out += '  observables {\n';
    for (const o of ct.observables) {
      let line = '    observable ' + o.name + ' { ';
      if (o.quantityKind) {
        line += 'quantity_kind ' + o.quantityKind + ' ';
      }
      if (o.unit) {
        line += 'unit "' + escapeString(o.unit) + '" ';
      }
      if (o.as) {
        line += 'as "' + escapeString(o.as) + '" ';
      }
      out += line + '}\n';
    }
    out += '  }\n';
  }
  if (ct.conditionsToEnforce.length > 0) {
    out +=
      '  conditions_to_enforce { ' + ct.conditionsToEnforce.join(' ') + ' }\n';
  }
  if (ct.preconditions.length > 0) {
    out += '  preconditions {\n';
    for (const p of ct.preconditions) {
      let line = '    precondition ' + p.id + ' { ';
      if (p.check) {
        line += 'check "' + escapeString(p.check) + '" ';
      }
      if (p.description) {
        line += 'description "' + escapeString(p.description) + '" ';
      }
      line += 'on_violation ' + p.onViolation + ' ';
      if (p.onUnresolvable) {
        line += 'on_unresolvable ' + p.onUnresolvable + ' ';
      }
      out += line + '}\n';
    }
    out += '  }\n';
  }
  if (ct.referenceMaterials.length > 0) {
    out +=
      '  reference_materials { ' + ct.referenceMaterials.join(' ') + ' }\n';
  }
  if (ct.requiredCompetence.length > 0) {
    out += dumpRequiredCompetence(ct.requiredCompetence);
  }
  if (
    ct.acceptanceCriteria.length > 0 ||
    ct.acceptanceCriteriaType ||
    ct.acceptancePassIf
  ) {
    out += '  acceptance_criteria {\n';
    if (ct.acceptanceCriteriaType) {
      out += '    type ' + ct.acceptanceCriteriaType + '\n';
    }
    if (ct.acceptanceCriteriaDescription) {
      out +=
        '    description "' +
        escapeString(ct.acceptanceCriteriaDescription) +
        '"\n';
    }
    if (ct.acceptancePassIf) {
      out += '    pass_if "' + escapeString(ct.acceptancePassIf) + '"\n';
    }
    for (const c of ct.acceptanceCriteria) {
      // Documentary criteria carry no name — emit `criterion "" { ... }`
      // so the re-parse doesn't swallow the block as the name.
      let line = '    criterion ' + (c.item || '""') + ' { ';
      if (c.passIf) {
        line += 'pass_if "' + escapeString(c.passIf) + '" ';
      }
      if (c.requirementId) {
        line += 'requirement ' + c.requirementId + ' ';
      }
      if (c.criterion) {
        line += 'criterion ' + c.criterion + ' ';
      }
      if (c.optional) {
        line += 'optional true ';
      }
      if (c.description) {
        line += 'description "' + escapeString(c.description) + '" ';
      }
      if (c.reference) {
        line += 'reference "' + escapeString(c.reference) + '" ';
      }
      if (c.accepts) {
        line +=
          'accepts { verdict ' +
          c.accepts.verdict +
          ' op ' +
          c.accepts.op +
          ' limit "' +
          escapeString(c.accepts.limit) +
          '" } ';
      }
      if (c.sourceDiscrepancy) {
        line += dumpSourceDiscrepancy(c.sourceDiscrepancy, '') + ' ';
      }
      out += line + '}\n';
    }
    out += '  }\n';
  }
  if (ct.design) {
    out += dumpDesign(ct.design, '  ');
  }
  if (ct.acceptance) {
    out += dumpAcceptance(ct.acceptance, '  ') + '\n';
  }
  if (ct.dependencies.length > 0) {
    out += '  dependencies { ' + ct.dependencies.join(' ') + ' }\n';
  }
  if (ct.instances) {
    let line = '  instances { by ' + ct.instances.by + ' values { ';
    for (const [key, params] of Object.entries(ct.instances.values)) {
      line += key + ' { ';
      for (const [pk, pv] of Object.entries(params)) {
        line += pk + ': ' + pv + ' ';
      }
      line += '} ';
    }
    out += line + '} }\n';
  }
  if (ct.inheritsFrom) {
    out += '  inherits_from ' + ct.inheritsFrom + '\n';
  }
  if (ct.resultForms.length > 0) {
    out += '  result_forms { ' + ct.resultForms.join(' ') + ' }\n';
  }
  if (ct.producesArtifacts && ct.producesArtifacts.length > 0) {
    out += '  produces_artifacts { ' + ct.producesArtifacts.join(' ') + ' }\n';
  }
  if (ct.reportRows && ct.reportRows.length > 0) {
    out += '  report_rows { ' + ct.reportRows.join(' ') + ' }\n';
  }
  if (ct.derivedValues.length > 0) {
    out += '  derived_values {\n';
    for (const d of ct.derivedValues) {
      out +=
        '    value ' +
        d.name +
        ' { expression "' +
        escapeString(d.expression) +
        '" }\n';
    }
    out += '  }\n';
  }
  if (ct.sourceDiscrepancy) {
    out += dumpSourceDiscrepancy(ct.sourceDiscrepancy, '  ') + '\n';
  }
  out += '}\n';
  return out;
};
