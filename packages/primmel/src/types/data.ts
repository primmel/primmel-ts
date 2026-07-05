import type Reference from './Reference';
import Resolvable from './Resolvable';

export type { default as Reference } from './Reference';

export interface Registry {
  id: string;
  title: string;
  data: DataClass | null;
}

export type ResolvableRegistry = Resolvable<Registry, 'data'>;

export interface DataClass {
  id: string;
  attributes: DataAttribute[];
}

export type ResolvableDataClass = {
  id: string;
  attributes: ResolveableDataAttribute[];
};

export interface DataAttribute {
  id: string;
  type: string;
  modality: string;
  cardinality: string;
  definition: string;
  ref: Reference[];
  satisfy: string[];
}

export type ResolveableDataAttribute = Resolvable<DataAttribute, 'ref'>;

export interface Enum {
  id: string;
  values: EnumValue[];
}

export interface EnumValue {
  id: string;
  value: string;
}

export interface Variable {
  id: string;
  type: string;
  definition: string;
  description: string;
}
