// ─────────────────────────────────────────────────────────────────────
// Constraint construct (TODO.roadmap/51 — BUG.R60-SSOT gap 7): the
// subject's own intrinsic validity rules — stereotype «inv», the
// Recommendation-level counterpart of the metamodel invariants (INV-1..14).
// Requirements constrain the subject from OUTSIDE; constraints are the
// subject's DECLARATION-LEVEL validity rules — a violation invalidates
// the MEASUREMENT (invalid = void measurement, never a fail), distinct
// from run-level preconditions (a violated precondition voids the RUN):
//   constraint dead-load-max-geometry {
//     stereotype inv
//     name "Dead-load maximum geometry"
//     check "ocl{model.parameters.d_max >= 0.9 * model.parameters.e_max and …}"
//     violation_meaning "…"   // REQUIRED — what a violation means
//     on_violation invalid    // invalid | indeterminate (default invalid)
//     source { doc "urn:oiml:pub:r:60-1:2021" clause "3.6" }
//   }
// ─────────────────────────────────────────────────────────────────────

import type Constraint from '../../types/Constraint';
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

export const parseConstraint: Parser = function (id, data) {
  const result: Constraint = {
    id,
    stereotype: '',
    name: '',
    check: '',
    violationMeaning: '',
    onViolation: 'invalid',
    source: null,
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const keyword = t[i++];
    if (i >= t.length) {
      throw new Error(
        `Parsing error: constraint. ID ${id}: Expecting value for ${keyword}`,
      );
    }
    if (keyword === 'stereotype') {
      result.stereotype = stripWrapping(t[i++]);
    } else if (keyword === 'name') {
      result.name = readValue(t[i++]);
    } else if (keyword === 'check') {
      result.check = readValue(t[i++]);
    } else if (keyword === 'violation_meaning') {
      result.violationMeaning = readValue(t[i++]);
    } else if (keyword === 'on_violation') {
      result.onViolation = stripWrapping(t[i++]);
    } else if (keyword === 'source') {
      result.source = readSource(unwrapBlock(t[i++]));
    } else {
      i++; // forward-compat: skip unknown keyword value
    }
  }

  return ctx => {
    ctx.constraints[id] = result;
    return ctx;
  };
};

export const dumpConstraint: Dumper<Constraint> = function (c) {
  let out = 'constraint ' + c.id + ' {\n';
  if (c.stereotype) {
    out += '  stereotype ' + c.stereotype + '\n';
  }
  if (c.name) {
    out += '  name "' + escapeString(c.name) + '"\n';
  }
  if (c.check) {
    out += '  check "' + escapeString(c.check) + '"\n';
  }
  if (c.violationMeaning) {
    out += '  violation_meaning "' + escapeString(c.violationMeaning) + '"\n';
  }
  out += '  on_violation ' + (c.onViolation || 'invalid') + '\n';
  if (c.source && (c.source.doc || c.source.clause)) {
    out +=
      '  source { doc "' +
      escapeString(c.source.doc) +
      '" clause "' +
      escapeString(c.source.clause) +
      '"' +
      (c.source.fragment
        ? ' fragment "' + escapeString(c.source.fragment) + '"'
        : '') +
      ' }\n';
  }
  out += '}\n';
  return out;
};
