import type { Dumper, Parser, Resolver } from '../types';
import { removePackage, tokenizePackage } from '../tokenize';
import type Note from '../../types/Note';
import type { NoteType } from '../../types/Note';
import type { ResolvableNote } from '../../types/Note';
import type Reference from '../../types/Reference';
import { resolveFromContext } from '../resolve';

const VALID_NOTE_TYPES: NoteType[] = ['NOTE', 'CAUTION', 'WARNING'];

export const parseNote: Parser = function (id, data) {
  const result: ResolvableNote = {
    id: id,
    type: 'NOTE',
    message: '',
    ref: [],
    _relations: {
      ref: [],
    },
  };

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'type') {
          const v = t[i++] as NoteType;
          if (!VALID_NOTE_TYPES.includes(v)) {
            throw new Error(
              `Parsing error: note. ID ${id}: Unknown type ${v} (valid: ${VALID_NOTE_TYPES.join(
                ', '
              )})`
            );
          }
          result.type = v;
        } else if (command === 'message') {
          result.message = removePackage(t[i++]);
        } else if (command === 'reference') {
          result._relations.ref = tokenizePackage(t[i++]);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: note. ID ${id}: Expecting value for ${command}`
        );
      }
    }
  }

  return ctx => {
    ctx.notes[id] = result;
    return ctx;
  };
};

export const resolveNote: Resolver<Note, ResolvableNote> = function (
  ctx,
  unresolved
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
  out += '  message "' + n.message + '"\n';
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
