// ─────────────────────────────────────────────────────────────────────
// `aspect` construct (smart TODO.roadmap/40 batch 3; the packages-as-
// SSOT epic) — the qualitative HAS inventory of the subject
// (types/Aspect.ts carries the banner and the grammar sketch). The kind
// vocabulary is parse-enforced (the fail-closed precedent); the
// reference legs (term_ref/component/attribute/contains) and the
// bind-path resolution are check-enforced (C130), per-register gated —
// the codec stays total.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import tokenize, {
  escapeString,
  stripWrapping,
  unwrapBlock,
} from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, readSource, stripColon } from './field-parser';
import Aspect from '../../types/Aspect';

const ASPECT_KINDS = [
  'marking',
  'inscription',
  'sealing',
  'display',
  'control',
  'interface',
  'power-supply',
  'enclosure',
  'construction',
  'documentation',
  'other',
] as const;

export const parseAspect: Parser = (id: string, data: string) => {
  const aspect: Aspect = {
    id,
    label: '',
    kind: '',
    definition: '',
    metamodelClass: '',
    termRef: '',
    component: '',
    attribute: '',
    contains: [],
    source: null,
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'label') {
        aspect.label = stripWrapping(value());
      } else if (keyword === 'kind') {
        const kind = stripWrapping(value());
        if (!(ASPECT_KINDS as readonly string[]).includes(kind)) {
          throw new Error(
            `Parsing error: aspect. ID ${id}: Unknown aspect kind "${kind}" (valid: ${ASPECT_KINDS.join(', ')})`,
          );
        }
        aspect.kind = kind;
      } else if (keyword === 'definition') {
        aspect.definition = stripWrapping(value());
      } else if (keyword === 'metamodel_class') {
        aspect.metamodelClass = stripWrapping(value());
      } else if (keyword === 'term_ref') {
        aspect.termRef = stripWrapping(value());
      } else if (keyword === 'component') {
        aspect.component = stripWrapping(value());
      } else if (keyword === 'attribute') {
        aspect.attribute = stripWrapping(value());
      } else if (keyword === 'contains') {
        aspect.contains = tokenize(stripWrapping(value()))
          .map(stripColon)
          .map(stripWrapping)
          .filter(s => s.length > 0);
      } else if (keyword === 'source') {
        aspect.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'aspect', id },
  );

  return ctx => {
    ctx.aspects[id] = aspect;
    return ctx;
  };
};

export const dumpAspect: Dumper<Aspect> = function (a) {
  let out: string = 'aspect ' + a.id + ' {\n';
  if (a.label) {
    out += '  label "' + escapeString(a.label) + '"\n';
  }
  if (a.kind) {
    out += '  kind ' + dumpBareSafe(a.kind) + '\n';
  }
  if (a.definition) {
    out += '  definition "' + escapeString(a.definition) + '"\n';
  }
  if (a.metamodelClass) {
    out += '  metamodel_class ' + dumpBareSafe(a.metamodelClass) + '\n';
  }
  if (a.termRef) {
    out += '  term_ref ' + dumpBareSafe(a.termRef) + '\n';
  }
  if (a.component) {
    out += '  component ' + dumpBareSafe(a.component) + '\n';
  }
  if (a.attribute) {
    out += '  attribute ' + dumpBareSafe(a.attribute) + '\n';
  }
  if (a.contains.length > 0) {
    out += '  contains { ' + a.contains.map(dumpBareSafe).join(' ') + ' }\n';
  }
  if (a.source && (a.source.doc || a.source.clause)) {
    out += '  source {\n';
    if (a.source.doc) {
      out += '    doc "' + escapeString(a.source.doc) + '"\n';
    }
    if (a.source.clause) {
      out += '    clause "' + escapeString(a.source.clause) + '"\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};
