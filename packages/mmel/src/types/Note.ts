import Reference from './Reference';
import Resolvable from './Resolvable';

export type NoteType = 'NOTE' | 'CAUTION' | 'WARNING';

interface Note {
  id: string;
  type: NoteType;
  message: string;
  ref: Reference[];
}

export default Note;

export type ResolvableNote = Resolvable<Note, 'ref'>;
