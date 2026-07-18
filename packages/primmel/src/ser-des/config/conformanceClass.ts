// ─────────────────────────────────────────────────────────────────────
// conformance_class construct (Primmel v2) — a conformance-test scope:
//   conformance_class /conf/metrological-tests {
//     title "Metrological tests"
//     name "Metrological conformance tests"
//     target /req/metrological
//     subject "LoadCell"
//     description "..."
//     applicability { accuracy_class: [A, B, C, D] }
//     guidance "..."
//   }
// ─────────────────────────────────────────────────────────────────────

import tokenize from '../tokenize';
import {
  escapeString,
  unwrapBlock,
  stripWrapping,
  tokenizePackage,
} from '../tokenize';
import { parseApplicability, dumpApplicabilityEntries } from './field-parser';
import type { ConstructDefinition } from './index';
import type { ConformanceClass } from '../../types/ConformanceClass';

const parseConformanceClass: ConstructDefinition['parse'] = function (id, data) {
  const result: ConformanceClass = {
    id,
    name: '',
    title: '',
    description: '',
    target: '',
    subject: '',
    applicability: [],
    guidance: '',
    dependencies: [],
    referenceIds: [],
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) break;
    if (cmd === 'name') {
      result.name = stripWrapping(t[i++]);
    } else if (cmd === 'title') {
      result.title = stripWrapping(t[i++]);
    } else if (cmd === 'description') {
      result.description = stripWrapping(t[i++]);
    } else if (cmd === 'target') {
      result.target = stripWrapping(t[i++]);
    } else if (cmd === 'subject') {
      result.subject = stripWrapping(t[i++]);
    } else if (cmd === 'applicability') {
      result.applicability = parseApplicability(unwrapBlock(t[i++]));
    } else if (cmd === 'guidance') {
      result.guidance = stripWrapping(t[i++]);
    } else if (cmd === 'dependencies') {
      result.dependencies = tokenize(stripWrapping(t[i++])).map(stripWrapping);
    } else if (cmd === 'reference') {
      result.referenceIds = tokenize(stripWrapping(t[i++])).map(stripWrapping);
    } else {
      unwrapBlock(t[i++]);
    }
  }

  return ctx => {
    ctx.conformanceClasses[id] = result;
    return ctx;
  };
};

const dumpConformanceClass = function (cc: ConformanceClass): string {
  let out = 'conformance_class ' + cc.id + ' {\n';
  if (cc.title) out += '  title "' + escapeString(cc.title) + '"\n';
  if (cc.name) out += '  name "' + escapeString(cc.name) + '"\n';
  if (cc.target) out += '  target ' + cc.target + '\n';
  if (cc.subject) out += '  subject "' + escapeString(cc.subject) + '"\n';
  if (cc.description) out += '  description "' + escapeString(cc.description) + '"\n';
  if (cc.applicability.length > 0) {
    out += '  applicability {\n    ' + dumpApplicabilityEntries(cc.applicability).trim() + '\n  }\n';
  }
  if (cc.guidance) out += '  guidance "' + escapeString(cc.guidance) + '"\n';
  if (cc.dependencies.length > 0) out += '  dependencies { ' + cc.dependencies.join(' ') + ' }\n';
  if (cc.referenceIds.length > 0) out += '  reference { ' + cc.referenceIds.join(' ') + ' }\n';
  out += '}\n';
  return out;
};

export const conformanceClassConstruct = {
  keyword: 'conformance_class',
  field: 'conformanceClasses',
  takesID: true,
  parse: parseConformanceClass,
  dump: dumpConformanceClass,
} as const;
