// ─────────────────────────────────────────────────────────────────────
// Predicate construct (spec: docs/primmel/18 — References and
// Relations): the relation registry's declared vocabulary. Every `ref`
// predicate resolves against the composed registry; a program declares
// its own predicates in its metamodel layer.
//
//   predicate derives-from {
//     kind citation
//     description "The element is the model's interpretation of the target clause."
//     subject_kinds { requirement conformance_test form field calculation symbol term package }
//     target_kinds { document-anchor }
//     resolution must-resolve
//     inverse interpreted-by
//     transitive false
//     symmetric false
//   }
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import type { RefPredicate } from '../../types/RefPredicate';
import tokenize from '../tokenize';
import { escapeString, unwrapBlock, stripWrapping, tokenizePackage } from '../tokenize';

export const parsePredicate: Parser = function (id, data) {
  const result: RefPredicate = {
    id,
    kind: '',
    description: '',
    subjectKinds: [],
    targetKinds: [],
    resolution: '',
    inverse: '',
    transitive: false,
    symmetric: false,
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const keyword = t[i++];
    if (i >= t.length) {
      throw new Error(`Parsing error: predicate. ID ${id}: Expecting value for ${keyword}`);
    }
    if (keyword === 'kind') {
      const v = stripWrapping(t[i++]);
      if (v !== 'citation' && v !== 'semantic') {
        throw new Error(`Parsing error: predicate. ID ${id}: kind must be citation|semantic (got '${v}')`);
      }
      result.kind = v;
    } else if (keyword === 'description' || keyword === 'definition') {
      result.description = stripWrapping(t[i++]);
    } else if (keyword === 'subject_kinds') {
      result.subjectKinds = tokenizePackage(unwrapBlock(t[i++])).map(stripWrapping);
    } else if (keyword === 'target_kinds') {
      result.targetKinds = tokenizePackage(unwrapBlock(t[i++])).map(stripWrapping);
    } else if (keyword === 'resolution') {
      result.resolution = stripWrapping(t[i++]);
    } else if (keyword === 'inverse') {
      result.inverse = stripWrapping(t[i++]);
    } else if (keyword === 'transitive') {
      result.transitive = stripWrapping(t[i++]) === 'true';
    } else if (keyword === 'symmetric') {
      result.symmetric = stripWrapping(t[i++]) === 'true';
    } else {
      i++; // forward-compatible: skip unknown keyword value
    }
  }

  return ctx => {
    (ctx as { predicates?: Record<string, RefPredicate> }).predicates ??= {};
    (ctx as { predicates: Record<string, RefPredicate> }).predicates[id] = result;
    return ctx;
  };
};

export const dumpPredicate: Dumper<RefPredicate> = function (p) {
  let out = 'predicate ' + p.id + ' {\n';
  if (p.kind) out += '  kind ' + p.kind + '\n';
  if (p.description) out += '  description "' + escapeString(p.description) + '"\n';
  if (p.subjectKinds.length > 0) out += '  subject_kinds { ' + p.subjectKinds.join(' ') + ' }\n';
  if (p.targetKinds.length > 0) out += '  target_kinds { ' + p.targetKinds.join(' ') + ' }\n';
  if (p.resolution) out += '  resolution ' + p.resolution + '\n';
  if (p.inverse) out += '  inverse ' + p.inverse + '\n';
  if (p.transitive) out += '  transitive true\n';
  if (p.symmetric) out += '  symmetric true\n';
  out += '}\n';
  return out;
};
