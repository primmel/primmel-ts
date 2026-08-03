import Reference from './Reference';
import Resolvable from './Resolvable';
import type SourceDiscrepancy from './SourceDiscrepancy';

export type NoteType =
  'NOTE' | 'CAUTION' | 'WARNING' | 'EXAMPLE' | 'COMMENTARY';

interface Note {
  id: string;
  type: NoteType;
  message: string;
  /** Source-discrepancy annotation attached to this note. */
  sourceDiscrepancy?: SourceDiscrepancy | null;
  ref: Reference[];
}

export default Note;

export type ResolvableNote = Resolvable<Note, 'ref'>;
