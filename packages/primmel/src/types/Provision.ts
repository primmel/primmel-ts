import { Resolvable } from './Resolvable';
import Reference from './Reference';

export default interface Provision {
  subject: Map<string, string>;
  id: string;
  modality: string;
  condition: string;
  ref: Reference[];
}

export type ResolvableProvision = Resolvable<Provision, 'ref'>;
