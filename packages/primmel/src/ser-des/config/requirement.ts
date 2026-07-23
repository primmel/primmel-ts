// ─────────────────────────────────────────────────────────────────────
// Requirement constructs (Primmel v2, gap G3):
//   requirement_class /req/metrological { name "…" subject "…" guidance "…" }
//   requirement /req/metrological/mpe {
//     name "…"  statement "…"  guidance "…"
//     binds_to { model.parameters.mpe model.classification.accuracy_class }
//     subjects { subject 1 { entity_id "dimensions.p_LC" label "Apportioning factor" } }
//     parameters { param n_runs: integer { description "…" default 20 range { min 0 max 100 } } }
//     limit {
//       expression "ocl{…}"  uses { mpe accuracy_class p_lc }
//       modality should  relative_to reference_speed  notes "…"
//       accepts { verdict mdlo_normalized op lte limit "ocl{p_lc}" source_discrepancy { … } }
//       acceptance { rule guarded guard_band { kind NSFa value 0.5 } }
//       source_discrepancy { … }
//     }
//     applicability { accuracy_class: [A, B, C, D] }
//     channel measurand_components  obligation should
//     acceptance_criteria { threshold { operator "<=" value "ocl{…}" } }
//     verification { method testing }
//     dependencies { /req/other }
//     source_discrepancy { summary "…" sources { "urn:…" } resolution follows_clause_x rationale "…" }
//     source { doc "urn:…" clause "5.3.2" }
//   }
// ─────────────────────────────────────────────────────────────────────

import tokenize from '../tokenize';
import {
  escapeString,
  unwrapBlock,
  stripWrapping,
  tokenizePackage,
} from '../tokenize';
import {
  parseApplicability,
  dumpApplicabilityEntries,
  dumpBareSafe,
  stripColon,
} from './field-parser';
import {
  parseSourceDiscrepancy,
  dumpSourceDiscrepancy,
} from './sourceDiscrepancy';
import { parseAcceptance, dumpAcceptance } from './acceptance';
import type { ConstructDefinition } from './index';
import type {
  Requirement,
  RequirementClass,
  RequirementLimit,
  RequirementLimitAccepts,
  RequirementParameter,
  RequirementSubject,
} from '../../types/Requirement';
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
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return src;
}

function readIdList(block: string): string[] {
  return tokenize(stripWrapping(block))
    .map(stripColon)
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

function readAccepts(block: string): RequirementLimitAccepts {
  const accepts: RequirementLimitAccepts = {
    verdict: '',
    op: '',
    limit: '',
    sourceDiscrepancy: null,
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'verdict') {
      accepts.verdict = stripWrapping(t[i++]);
    } else if (cmd === 'op') {
      accepts.op = stripWrapping(t[i++]);
    } else if (cmd === 'limit') {
      accepts.limit = stripWrapping(t[i++]);
    } else if (cmd === 'source_discrepancy') {
      accepts.sourceDiscrepancy = parseSourceDiscrepancy(unwrapBlock(t[i++]));
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return accepts;
}

function readLimit(block: string): RequirementLimit {
  const limit: RequirementLimit = {
    expression: '',
    uses: [],
    modality: '',
    relativeTo: '',
    notes: '',
    accepts: null,
    acceptance: null,
    sourceDiscrepancy: null,
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'expression') {
      limit.expression = stripWrapping(t[i++]);
    } else if (cmd === 'uses') {
      limit.uses = readIdList(t[i++]);
    } else if (cmd === 'modality') {
      limit.modality = stripWrapping(t[i++]);
    } else if (cmd === 'relative_to') {
      limit.relativeTo = stripWrapping(t[i++]);
    } else if (cmd === 'notes') {
      limit.notes = stripWrapping(t[i++]);
    } else if (cmd === 'accepts') {
      limit.accepts = readAccepts(unwrapBlock(t[i++]));
    } else if (cmd === 'acceptance') {
      limit.acceptance = parseAcceptance(unwrapBlock(t[i++]));
    } else if (cmd === 'source_discrepancy') {
      limit.sourceDiscrepancy = parseSourceDiscrepancy(unwrapBlock(t[i++]));
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return limit;
}

function readSubjects(block: string): RequirementSubject[] {
  const out: RequirementSubject[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'subject') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    const subject: RequirementSubject = {
      slot: Number(stripWrapping(t[i++])),
      entityId: '',
      label: '',
    };
    if (i < t.length && t[i].startsWith('{')) {
      const st = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < st.length) {
        const sc = st[j++];
        if (j >= st.length) {
          break;
        }
        if (sc === 'entity_id') {
          subject.entityId = stripWrapping(st[j++]);
        } else if (sc === 'label') {
          subject.label = stripWrapping(st[j++]);
        } else {
          unwrapBlock(st[j++]);
        }
      }
    }
    out.push(subject);
  }
  return out;
}

function readParameters(block: string): RequirementParameter[] {
  const out: RequirementParameter[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'param') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    const param: RequirementParameter = {
      name: stripColon(stripWrapping(t[i++])),
      type: '',
      description: '',
      unit: '',
      defaultValue: '',
      hasDefault: false,
      rangeMin: '',
      rangeMax: '',
      hasRange: false,
      enumValues: [],
    };
    if (i < t.length && !t[i].startsWith('{')) {
      param.type = stripWrapping(t[i++]);
    }
    if (i < t.length && t[i].startsWith('{')) {
      const pt = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < pt.length) {
        const pc = pt[j++];
        if (j >= pt.length) {
          break;
        }
        if (pc === 'description') {
          param.description = stripWrapping(pt[j++]);
        } else if (pc === 'unit') {
          param.unit = stripWrapping(pt[j++]);
        } else if (pc === 'default') {
          param.defaultValue = stripWrapping(pt[j++]);
          param.hasDefault = true;
        } else if (pc === 'range') {
          const rt = tokenize(unwrapBlock(pt[j++]));
          let k = 0;
          while (k < rt.length) {
            const rc = rt[k++];
            if (k >= rt.length) {
              break;
            }
            if (rc === 'min') {
              param.rangeMin = stripWrapping(rt[k++]);
              param.hasRange = true;
            } else if (rc === 'max') {
              param.rangeMax = stripWrapping(rt[k++]);
              param.hasRange = true;
            } else {
              unwrapBlock(rt[k++]);
            }
          }
        } else if (pc === 'enum_values') {
          param.enumValues = readIdList(pt[j++]);
        } else {
          unwrapBlock(pt[j++]);
        }
      }
    }
    out.push(param);
  }
  return out;
}

const parseRequirement: ConstructDefinition['parse'] = function (id, data) {
  const result: Requirement = {
    id,
    name: '',
    statement: '',
    guidance: '',
    bindsTo: [],
    limit: null,
    applicability: [],
    channel: '',
    subjects: [],
    parameters: [],
    obligation: '',
    acceptanceCriteria: '',
    verificationMethod: '',
    dependencies: [],
    sourceDiscrepancy: null,
    source: null,
    referenceIds: [],
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'name') {
      result.name = stripWrapping(t[i++]);
    } else if (cmd === 'statement') {
      result.statement = stripWrapping(t[i++]);
    } else if (cmd === 'guidance') {
      result.guidance = stripWrapping(t[i++]);
    } else if (cmd === 'binds_to') {
      result.bindsTo = readIdList(t[i++]);
    } else if (cmd === 'subjects') {
      result.subjects = readSubjects(unwrapBlock(t[i++]));
    } else if (cmd === 'parameters') {
      result.parameters = readParameters(unwrapBlock(t[i++]));
    } else if (cmd === 'limit') {
      result.limit = readLimit(unwrapBlock(t[i++]));
    } else if (cmd === 'applicability') {
      result.applicability = parseApplicability(unwrapBlock(t[i++]));
    } else if (cmd === 'channel') {
      result.channel = stripWrapping(t[i++]);
    } else if (cmd === 'report_row') {
      result.reportRow = stripWrapping(t[i++]);
    } else if (cmd === 'obligation') {
      result.obligation = stripWrapping(t[i++]);
    } else if (cmd === 'acceptance_criteria') {
      result.acceptanceCriteria = unwrapBlock(t[i++]).trim();
    } else if (cmd === 'verification') {
      const vblock = unwrapBlock(t[i++]);
      const vt = tokenize(vblock);
      let j = 0;
      while (j < vt.length) {
        const vc = vt[j++];
        if (j >= vt.length) {
          break;
        }
        if (vc === 'method') {
          result.verificationMethod = stripWrapping(vt[j++]);
        } else if (vc === 'description') {
          result.verificationDescription = stripWrapping(vt[j++]);
        } else {
          unwrapBlock(vt[j++]);
        }
      }
    } else if (cmd === 'dependencies') {
      result.dependencies = readIdList(t[i++]);
    } else if (cmd === 'source_discrepancy') {
      result.sourceDiscrepancy = parseSourceDiscrepancy(unwrapBlock(t[i++]));
    } else if (cmd === 'source' || cmd === 'reference') {
      // Repeated source blocks collect into sourceRefs (TODO.roadmap/24);
      // source stays the first entry for back-compatibility.
      const src = readSource(unwrapBlock(t[i++]));
      if (!result.source) result.source = src;
      (result.sourceRefs ??= []).push(src);
    } else {
      unwrapBlock(t[i++]);
    }
  }

  return ctx => {
    ctx.requirements[id] = result;
    return ctx;
  };
};

function dumpLimit(limit: RequirementLimit): string {
  let out = '  limit {\n';
  if (limit.expression) {
    out += '    expression "' + escapeString(limit.expression) + '"\n';
  }
  if (limit.uses.length > 0) {
    out += '    uses { ' + limit.uses.join(' ') + ' }\n';
  }
  if (limit.modality) {
    out += '    modality ' + limit.modality + '\n';
  }
  if (limit.relativeTo) {
    out += '    relative_to ' + limit.relativeTo + '\n';
  }
  if (limit.notes) {
    out += '    notes "' + escapeString(limit.notes) + '"\n';
  }
  if (limit.accepts) {
    const a = limit.accepts;
    let line = '    accepts { verdict ' + a.verdict;
    if (a.op) {
      line += ' op ' + a.op;
    }
    if (a.limit) {
      line += ' limit "' + escapeString(a.limit) + '"';
    }
    if (a.sourceDiscrepancy) {
      line += ' ' + dumpSourceDiscrepancy(a.sourceDiscrepancy, '');
    }
    out += line + ' }\n';
  }
  if (limit.acceptance) {
    out += dumpAcceptance(limit.acceptance, '    ') + '\n';
  }
  if (limit.sourceDiscrepancy) {
    out += dumpSourceDiscrepancy(limit.sourceDiscrepancy, '    ') + '\n';
  }
  out += '  }\n';
  return out;
}

const dumpRequirement = function (r: Requirement): string {
  let out = 'requirement ' + r.id + ' {\n';
  if (r.name) {
    out += '  name "' + escapeString(r.name) + '"\n';
  }
  if (r.statement) {
    out += '  statement "' + escapeString(r.statement) + '"\n';
  }
  if (r.guidance) {
    out += '  guidance "' + escapeString(r.guidance) + '"\n';
  }
  if (r.bindsTo.length > 0) {
    out += '  binds_to { ' + r.bindsTo.join(' ') + ' }\n';
  }
  if (r.subjects.length > 0) {
    out += '  subjects { ';
    for (const s of r.subjects) {
      out += 'subject ' + s.slot + ' { ';
      if (s.entityId) {
        out += 'entity_id "' + escapeString(s.entityId) + '" ';
      }
      if (s.label) {
        out += 'label "' + escapeString(s.label) + '" ';
      }
      out += '} ';
    }
    out += '}\n';
  }
  if (r.parameters.length > 0) {
    out += '  parameters {\n';
    for (const p of r.parameters) {
      let line = '    param ' + p.name + ': ' + p.type + ' { ';
      if (p.description) {
        line += 'description "' + escapeString(p.description) + '" ';
      }
      if (p.unit) {
        line += 'unit "' + escapeString(p.unit) + '" ';
      }
      if (p.hasDefault) {
        line += 'default ' + dumpBareSafe(p.defaultValue) + ' ';
      }
      if (p.hasRange) {
        line += 'range { ';
        if (p.rangeMin) {
          line += 'min ' + dumpBareSafe(p.rangeMin) + ' ';
        }
        if (p.rangeMax) {
          line += 'max ' + dumpBareSafe(p.rangeMax) + ' ';
        }
        line += '} ';
      }
      if (p.enumValues.length > 0) {
        line += 'enum_values { ' + p.enumValues.join(' ') + ' } ';
      }
      out += line + '}\n';
    }
    out += '  }\n';
  }
  if (r.limit) {
    out += dumpLimit(r.limit);
  }
  if (r.applicability.length > 0) {
    out +=
      '  applicability {\n    ' +
      dumpApplicabilityEntries(r.applicability).trim() +
      '\n  }\n';
  }
  if (r.channel) {
    out += '  channel ' + r.channel + '\n';
  }
  if (r.reportRow) {
    out += '  report_row ' + r.reportRow + '\n';
  }
  if (r.obligation) {
    out += '  obligation ' + r.obligation + '\n';
  }
  if (r.acceptanceCriteria) {
    out += '  acceptance_criteria {\n    ' + r.acceptanceCriteria + '\n  }\n';
  }
  if (r.verificationMethod) {
    let vline = '  verification { method ' + r.verificationMethod;
    if (r.verificationDescription) {
      vline += ' description "' + escapeString(r.verificationDescription) + '"';
    }
    out += vline + ' }\n';
  }
  if (r.dependencies.length > 0) {
    out += '  dependencies { ' + r.dependencies.join(' ') + ' }\n';
  }
  if (r.sourceDiscrepancy) {
    out += dumpSourceDiscrepancy(r.sourceDiscrepancy, '  ') + '\n';
  }
  for (const src of r.sourceRefs ?? (r.source && (r.source.doc || r.source.clause) ? [r.source] : [])) {
    out +=
      '  source { doc "' +
      escapeString(src.doc) +
      '" clause "' +
      escapeString(src.clause) +
      '" }\n';
  }
  out += '}\n';
  return out;
};

const parseRequirementClass: ConstructDefinition['parse'] = function (
  id,
  data,
) {
  const result: RequirementClass = {
    id,
    name: '',
    subject: '',
    guidance: '',
    dependencies: [],
    referenceIds: [],
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'name') {
      result.name = stripWrapping(t[i++]);
    } else if (cmd === 'title') {
      result.title = stripWrapping(t[i++]);
    } else if (cmd === 'description') {
      result.description = stripWrapping(t[i++]);
    } else if (cmd === 'subject') {
      result.subject = stripWrapping(t[i++]);
    } else if (cmd === 'guidance') {
      result.guidance = stripWrapping(t[i++]);
    } else if (cmd === 'applicability') {
      result.applicability = parseApplicability(unwrapBlock(t[i++]));
    } else if (cmd === 'dependencies') {
      result.dependencies = readIdList(t[i++]);
    } else if (cmd === 'reference') {
      result.referenceIds = readIdList(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }

  return ctx => {
    ctx.requirementClasses[id] = result;
    return ctx;
  };
};

const dumpRequirementClass = function (rc: RequirementClass): string {
  let out = 'requirement_class ' + rc.id + ' {\n';
  if (rc.name) {
    out += '  name "' + escapeString(rc.name) + '"\n';
  }
  if (rc.subject) {
    out += '  subject "' + escapeString(rc.subject) + '"\n';
  }
  if (rc.guidance) {
    out += '  guidance "' + escapeString(rc.guidance) + '"\n';
  }
  if (rc.applicability && rc.applicability.length > 0) {
    out +=
      '  applicability {\n    ' +
      dumpApplicabilityEntries(rc.applicability).trim() +
      '\n  }\n';
  }
  if (rc.dependencies.length > 0) {
    out += '  dependencies { ' + rc.dependencies.join(' ') + ' }\n';
  }
  if (rc.referenceIds.length > 0) {
    out += '  reference { ' + rc.referenceIds.join(' ') + ' }\n';
  }
  out += '}\n';
  return out;
};

export const requirementConstruct = {
  keyword: 'requirement',
  field: 'requirements',
  takesID: true,
  parse: parseRequirement,
  dump: dumpRequirement,
} as const;

export const requirementClassConstruct = {
  keyword: 'requirement_class',
  field: 'requirementClasses',
  takesID: true,
  parse: parseRequirementClass,
  dump: dumpRequirementClass,
} as const;
