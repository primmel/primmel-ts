// ─────────────────────────────────────────────────────────────────────
// Requirement constructs (Primmel v2, gap G3):
//   requirement_class /req/metrological { name "…" subject "…" guidance "…" }
//   requirement /req/metrological/mpe {
//     name "…"  statement "…"
//     binds_to { model.parameters.mpe model.classification.accuracy_class }
//     limit { expression "ocl{…}" uses { mpe accuracy_class p_lc } }
//     applicability { accuracy_class: [A, B, C, D] }
//     acceptance_criteria { threshold { operator "<=" value "ocl{…}" } }
//     verification { method testing }
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
  stripColon,
} from './field-parser';
import type { ConstructDefinition } from './index';
import type {
  Requirement,
  RequirementClass,
  RequirementLimit,
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

function readLimit(block: string): RequirementLimit {
  const limit: RequirementLimit = { expression: '', uses: [] };
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
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return limit;
}

const parseRequirement: ConstructDefinition['parse'] = function (id, data) {
  const result: Requirement = {
    id,
    name: '',
    statement: '',
    bindsTo: [],
    limit: null,
    applicability: [],
    channel: '',
    acceptanceCriteria: '',
    verificationMethod: '',
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
    } else if (cmd === 'binds_to') {
      result.bindsTo = readIdList(t[i++]);
    } else if (cmd === 'limit') {
      result.limit = readLimit(unwrapBlock(t[i++]));
    } else if (cmd === 'applicability') {
      result.applicability = parseApplicability(unwrapBlock(t[i++]));
    } else if (cmd === 'channel') {
      result.channel = stripWrapping(t[i++]);
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
        } else {
          unwrapBlock(vt[j++]);
        }
      }
    } else if (cmd === 'source' || cmd === 'reference') {
      result.source = readSource(unwrapBlock(t[i++]));
    } else {
      unwrapBlock(t[i++]);
    }
  }

  return ctx => {
    ctx.requirements[id] = result;
    return ctx;
  };
};

const dumpRequirement = function (r: Requirement): string {
  let out = 'requirement ' + r.id + ' {\n';
  if (r.name) {
    out += '  name "' + escapeString(r.name) + '"\n';
  }
  if (r.statement) {
    out += '  statement "' + escapeString(r.statement) + '"\n';
  }
  if (r.bindsTo.length > 0) {
    out += '  binds_to { ' + r.bindsTo.join(' ') + ' }\n';
  }
  if (r.limit) {
    out += '  limit {\n';
    out += '    expression "' + escapeString(r.limit.expression) + '"\n';
    if (r.limit.uses.length > 0) {
      out += '    uses { ' + r.limit.uses.join(' ') + ' }\n';
    }
    out += '  }\n';
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
  if (r.acceptanceCriteria) {
    out += '  acceptance_criteria {\n    ' + r.acceptanceCriteria + '\n  }\n';
  }
  if (r.verificationMethod) {
    out += '  verification { method ' + r.verificationMethod + ' }\n';
  }
  if (r.source && (r.source.doc || r.source.clause)) {
    out +=
      '  source { doc "' +
      escapeString(r.source.doc) +
      '" clause "' +
      escapeString(r.source.clause) +
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
