import type { Registry } from './data';
import type Reference from './Reference';
import Resolvable from './Resolvable';
import type Role from './Role';

export default interface Approval {
  id: string;
  name: string;
  modality: string;
  actor: Role | null;
  approver: Role | null;
  records: Registry[];
  ref: Reference[];
}

export type ResolvableApproval = Resolvable<
  Approval,
  'actor' | 'approver' | 'records' | 'ref'
>;
