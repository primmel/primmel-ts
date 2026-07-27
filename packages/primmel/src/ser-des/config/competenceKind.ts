// ─────────────────────────────────────────────────────────────────────
// Competence-kind construct (TODO.roadmap/48 — BUG.R60-SSOT gap 1):
// the laboratory testing-competence registry, the vocabulary of a
// conformance test's `required_competence` and a TestLaboratory's
// `accreditation_scope`:
//   competence_kind force_measurement {
//     label "Force measurement"
//     definition "…"
//     source { doc "ISO/IEC 17025:2017, 6.4" clause "" }
//     method_standard iec-60068-2-30 "Environmental testing — Test Db"
//   }
//
// The required_competence facet on conformance_test (parsed/dumped here
// too — the entry shape is shared with the laboratory scope entries):
//   required_competence {
//     competence force_measurement {
//       range { min 0 max "e_max" unit "kg" }
//       method_standard "iec-60068-2-30"
//       resolution { value 0.1 unit "uV" }
//       stability { value 2 unit "degC" }
//       description "…"
//     }
//   }
// A range bound is a number, or a quoted subject-parameter id the
// dispatch context resolves (e.g. "e_max"); a laboratory scope always
// states numbers.
// ─────────────────────────────────────────────────────────────────────

import type CompetenceKind from '../../types/CompetenceKind';
import type {
  CompetenceQuantity,
  CompetenceRange,
  CompetenceRequirement,
} from '../../types/CompetenceKind';
import type { SourceRef } from '../../types/Subject';
import tokenize from '../tokenize';
import {
  escapeString,
  unwrapBlock,
  stripWrapping,
  tokenizePackage,
  unescapeString,
} from '../tokenize';
import type { Dumper, Parser } from '../types';

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

/** A bound token: unquoted numbers parse as numbers, quoted tokens stay
 *  parameter ids (stripWrapping removes the quotes). */
function readBound(raw: string): number | string {
  const s = stripWrapping(raw);
  if (s.trim() !== '' && !isNaN(Number(s))) {
    return Number(s);
  }
  return s;
}

function readQuantity(block: string): CompetenceQuantity {
  const q: CompetenceQuantity = { value: 0, unit: '' };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'value') {
      q.value = Number(stripWrapping(t[i++]));
    } else if (cmd === 'unit') {
      q.unit = stripWrapping(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return q;
}

export function parseRequiredCompetence(
  block: string,
): CompetenceRequirement[] {
  const out: CompetenceRequirement[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'competence') {
      if (i < t.length) {
        unwrapBlock(t[i++]); // forward-compat: consume the value token
      }
      continue;
    }
    const entry: CompetenceRequirement = {
      kind: stripWrapping(t[i++]),
      range: null,
      methodStandard: '',
      resolution: null,
      stability: null,
      description: '',
    };
    if (i < t.length && t[i].startsWith('{')) {
      const ct = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < ct.length) {
        const cc = ct[j++];
        if (j >= ct.length) {
          break;
        }
        if (cc === 'range') {
          const rt = tokenize(unwrapBlock(ct[j++]));
          const range: CompetenceRange = { min: null, max: null, unit: '' };
          let k = 0;
          while (k < rt.length) {
            const rc = rt[k++];
            if (k >= rt.length) {
              break;
            }
            if (rc === 'min') {
              range.min = readBound(rt[k++]);
            } else if (rc === 'max') {
              range.max = readBound(rt[k++]);
            } else if (rc === 'unit') {
              range.unit = stripWrapping(rt[k++]);
            } else {
              unwrapBlock(rt[k++]);
            }
          }
          entry.range = range;
        } else if (cc === 'method_standard') {
          entry.methodStandard = stripWrapping(ct[j++]);
        } else if (cc === 'resolution') {
          entry.resolution = readQuantity(unwrapBlock(ct[j++]));
        } else if (cc === 'stability') {
          entry.stability = readQuantity(unwrapBlock(ct[j++]));
        } else if (cc === 'description') {
          entry.description = stripWrapping(ct[j++]);
        } else {
          unwrapBlock(ct[j++]);
        }
      }
    }
    out.push(entry);
  }
  return out;
}

function dumpQuantity(keyword: string, q: CompetenceQuantity | null): string {
  if (!q) {
    return '';
  }
  return (
    '      ' +
    keyword +
    ' { value ' +
    String(q.value) +
    ' unit "' +
    escapeString(q.unit) +
    '" }\n'
  );
}

function dumpBound(bound: number | string | null): string {
  if (bound === null) {
    return '';
  }
  return typeof bound === 'number'
    ? String(bound)
    : '"' + escapeString(bound) + '"';
}

export function dumpRequiredCompetence(
  entries: CompetenceRequirement[],
): string {
  let out = '  required_competence {\n';
  for (const e of entries) {
    out += '    competence ' + e.kind + ' {\n';
    if (e.range) {
      let line = '      range {';
      if (e.range.min !== null) {
        line += ' min ' + dumpBound(e.range.min);
      }
      if (e.range.max !== null) {
        line += ' max ' + dumpBound(e.range.max);
      }
      line += ' unit "' + escapeString(e.range.unit) + '" }\n';
      out += line;
    }
    if (e.methodStandard) {
      out += '      method_standard "' + escapeString(e.methodStandard) + '"\n';
    }
    out += dumpQuantity('resolution', e.resolution);
    out += dumpQuantity('stability', e.stability);
    if (e.description) {
      out += '      description "' + escapeString(e.description) + '"\n';
    }
    out += '    }\n';
  }
  out += '  }\n';
  return out;
}

/** Unwrap one value token: quoted strings unescape, blocks unwrap. */
function readValue(raw: string): string {
  if (
    raw.length >= 2 &&
    raw.charAt(0) === '"' &&
    raw.charAt(raw.length - 1) === '"'
  ) {
    return unescapeString(raw.substr(1, raw.length - 2));
  }
  return unwrapBlock(raw);
}

export const parseCompetenceKind: Parser = function (id, data) {
  const result: CompetenceKind = {
    id,
    label: '',
    definition: '',
    source: null,
    methodStandards: [],
  };

  // Manual walk (not forEachEntry): a method_standard line carries TWO
  // value tokens (id + title), which the pairwise helper cannot frame.
  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const keyword = t[i++];
    if (i >= t.length) {
      throw new Error(
        `Parsing error: competence_kind. ID ${id}: Expecting value for ${keyword}`,
      );
    }
    if (keyword === 'label') {
      result.label = readValue(t[i++]);
    } else if (keyword === 'definition') {
      result.definition = readValue(t[i++]);
    } else if (keyword === 'source') {
      result.source = readSource(unwrapBlock(t[i++]));
    } else if (keyword === 'method_standard') {
      const stdId = stripWrapping(t[i++]);
      if (i >= t.length) {
        throw new Error(
          `Parsing error: competence_kind. ID ${id}: Expecting title for method_standard ${stdId}`,
        );
      }
      result.methodStandards.push({ id: stdId, title: readValue(t[i++]) });
    } else {
      i++; // forward-compat: skip unknown keyword value
    }
  }

  return ctx => {
    ctx.competenceKinds[id] = result;
    return ctx;
  };
};

export const dumpCompetenceKind: Dumper<CompetenceKind> = function (k) {
  let out = 'competence_kind ' + k.id + ' {\n';
  if (k.label) {
    out += '  label "' + escapeString(k.label) + '"\n';
  }
  if (k.definition) {
    out += '  definition "' + escapeString(k.definition) + '"\n';
  }
  if (k.source && (k.source.doc || k.source.clause)) {
    out +=
      '  source { doc "' +
      escapeString(k.source.doc) +
      '" clause "' +
      escapeString(k.source.clause) +
      '"' +
      (k.source.fragment
        ? ' fragment "' + escapeString(k.source.fragment) + '"'
        : '') +
      ' }\n';
  }
  for (const ms of k.methodStandards) {
    out += '  method_standard ' + ms.id + ' "' + escapeString(ms.title) + '"\n';
  }
  out += '}\n';
  return out;
};
