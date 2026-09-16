import type { Registry } from './data';
import type Reference from './Reference';
import Resolvable from './Resolvable';
import type Role from './Role';
import type { SourceRef } from './Subject';

export default interface Approval {
  id: string;
  name: string;
  modality: string;
  // The raw reference ids (smart TODO.roadmap/40 batch 5) — survive
  // resolution even when they name no declared construct (the
  // process.provisionRefs precedent), so the dump stays byte-faithful
  // and C143 can check them.
  actorRef: string;
  approverRef: string;
  recordRefs: string[];
  actor: Role | null;
  approver: Role | null;
  records: Registry[];
  ref: Reference[];
  // Clause-URN provenance (free citation strings land in doc).
  source: SourceRef | null;
}

export type ResolvableApproval = Resolvable<
  Approval,
  'actor' | 'approver' | 'records' | 'ref'
>;
