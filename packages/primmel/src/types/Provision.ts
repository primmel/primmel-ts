export default interface Provision {
  subject: Map<string, string>;
  id: string;
  modality: string;
  condition: string;
  /** The v2 `reference { … }` id list (opaque ids, never resolved). */
  referenceIds: string[];
}

export type ResolvableProvision = Provision;
