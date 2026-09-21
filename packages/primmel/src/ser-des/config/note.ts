import type { Dumper, Parser, Resolver } from '../types';
import {
  escapeString,
  stripWrapping,
  tokenizePackage,
  unwrapBlock,
} from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
import {
  parseSourceDiscrepancy,
  dumpSourceDiscrepancy,
} from './sourceDiscrepancy';
import { readSource } from './field-parser';
import {
  parseRefFromReaders,
  foldRefIntoLegacy,
  dumpSourceRefAsRef,
} from './ref';
import type Note from '../../types/Note';
import type { NoteType } from '../../types/Note';
import type { ResolvableNote } from '../../types/Note';
import type Reference from '../../types/Reference';
import { resolveFromContext } from '../resolve';

// EXAMPLE is the legacy (MMEL v2) note type — the corpus carries it.
const VALID_NOTE_TYPES: NoteType[] = [
  'NOTE',
  'CAUTION',
  'WARNING',
  'EXAMPLE',
  'COMMENTARY',
];

export const parseNote: Parser = function (id, data) {
  const result: ResolvableNote = {
    id: id,
    type: 'NOTE',
    message: '',
    sourceDiscrepancy: null,
    source: null,
    ref: [],
    _relations: {
      ref: [],
    },
  };

  forEachEntry(
    data,
    (command, value, peek) => {
      if (command === 'type') {
        const v = value() as NoteType;
        if (!VALID_NOTE_TYPES.includes(v)) {
          throw new Error(
            `Parsing error: note. ID ${id}: Unknown type ${v} (valid: ${VALID_NOTE_TYPES.join(
              ', ',
            )})`,
          );
        }
        result.type = v;
      } else if (command === 'message') {
        result.message = unwrapped(value);
      } else if (command === 'source_discrepancy') {
        result.sourceDiscrepancy = parseSourceDiscrepancy(unwrapBlock(value()));
      } else if (command === 'source') {
        // The clause-site provenance (the requirement idiom): repeated
        // blocks collect into sourceRefs; source mirrors the first.
        const src = readSource(unwrapBlock(value()));
        if (!result.source) {
          result.source = src;
        }
        (result.sourceRefs ??= []).push(src);
      } else if (command === 'reference') {
        // The bibliographic citation channel (the references-collection
        // id list — resolveNote resolves each), never provenance.
        result._relations.ref = tokenizePackage(value());
      } else if (command === 'ref') {
        // The unified typed reference (spec: docs/primmel/18) — a
        // URN-anchored derives-from folds into the provenance facet.
        const r = parseRefFromReaders(value, peek, stripWrapping, unwrapBlock);
        foldRefIntoLegacy(result, r);
      } else {
        return false;
      }
      return true;
    },
    { construct: 'note', id },
  );

  return ctx => {
    ctx.notes[id] = result;
    return ctx;
  };
};

export const resolveNote: Resolver<Note, ResolvableNote> = function (
  ctx,
  unresolved,
) {
  const ref: Reference[] = [];
  for (const id of unresolved._relations.ref) {
    const r = resolveFromContext<Reference>(ctx, 'references', id);
    if (r !== undefined) {
      ref.push(r);
    }
  }
  return { ...unresolved, ref };
};

export const dumpNote: Dumper<Note> = function (n) {
  let out = 'note ' + n.id + ' {\n';
  out += '  type ' + n.type + '\n';
  out += '  message "' + escapeString(n.message) + '"\n';
  if (n.sourceDiscrepancy) {
    out += dumpSourceDiscrepancy(n.sourceDiscrepancy, '  ') + '\n';
  }
  for (const src of n.sourceRefs ??
    (n.source && (n.source.doc || n.source.clause) ? [n.source] : [])) {
    out += dumpSourceRefAsRef(src, '  ', escapeString);
  }
  if (n.ref.length > 0) {
    out += '  reference {\n';
    for (const r of n.ref) {
      out += '    ' + r.id + '\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};
