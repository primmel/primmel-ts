import type { Dumper, Parser, Resolver } from '../types';
import { removePackage, tokenizePackage } from '../tokenize';
import type Note from '../../types/Note';
import type { NoteType } from '../../types/Note';
import { ResolvableNote } from '../../types/Note';
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
              `Parsing error: note. ID ${id}: Unknown type ${v} (valid: ${VALID_NOTE_TYPES.join(', ')})`
            );
          }
          result.type = v;
        } else if (command === 'message') {
          result.message = removePackage(t[i++]);
        } else if (command === 'reference') {
          result._relations.ref = tokenizePackage(t[i++]);
        } else {
          throw new Error(`Parsing error: note. ID ${id}: Unknown keyword ${command}`);
        }
      } else {
        throw new Error(`Parsing error: note. ID ${id}: Expecting value for ${command}`);
      }
    }
  }

  return ctx => ({ ...ctx, notes: { ...ctx.notes, [id]: result } });
};

export const resolveNote: Resolver<Note, ResolvableNote> = function (ctx, unresolved) {
  const resolved: Note = { ...unresolved, ref: [] };
  for (const id of unresolved._relations.ref) {
    resolved.ref.push(resolveFromContext(ctx, 'references', id));
  }
  return resolved;
};

export const dumpNote: Dumper<Note> = function (n) {
  let out = 'note ' + n.id + ' {\n';
  out += '  type ' + n.type + '\n';
  out += '  message "' + n.message + '"\n';
  if (n.ref.length > 0) {
    out += '  reference {\n';
    for (const r of n.ref) out += '    ' + r.id + '\n';
    out += '  }\n';
  }
  out += '}\n';
  return out;
};
