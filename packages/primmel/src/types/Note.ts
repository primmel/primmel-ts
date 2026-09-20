import Reference from './Reference';
import Resolvable from './Resolvable';
import type SourceDiscrepancy from './SourceDiscrepancy';
import type { SourceRef } from './Subject';

export type NoteType =
  'NOTE' | 'CAUTION' | 'WARNING' | 'EXAMPLE' | 'COMMENTARY';

interface Note {
  id: string;
  type: NoteType;
  message: string;
  /** Source-discrepancy annotation attached to this note. */
  sourceDiscrepancy?: SourceDiscrepancy | null;
  /** The clause-site provenance (the requirement idiom: the singular
      mirror of the first source block, the canonical
      `ref derives-from "<urn>#clause-<n>"` spelling on dump). */
  source?: SourceRef | null;
  /** Every provenance block in document order (the first mirrors
      `source`). */
  sourceRefs?: SourceRef[];
  ref: Reference[];
}

export default Note;

export type ResolvableNote = Resolvable<Note, 'ref'>;
