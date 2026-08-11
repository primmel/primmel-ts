/** A predicate of the relation registry (spec: docs/primmel/18 —
 *  References and Relations): the declared vocabulary every `ref`
 *  predicate resolves against. Data, not grammar — a program extends
 *  the vocabulary by declaring predicates, never by forking the codec. */
export interface RefPredicate {
  id: string;
  /** citation (a document anchor — feeds coverage/reconstruction) or
   *  semantic (a model element — feeds the model graph). */
  kind: 'citation' | 'semantic' | '';
  description: string;
  /** Element kinds allowed as subject (empty = any). */
  subjectKinds: string[];
  /** Target kinds allowed (document-anchor | model-element ids; empty = any). */
  targetKinds: string[];
  /** The linker's resolution policy: must-resolve proves the target exists. */
  resolution: string;
  /** The inverse predicate id (when declared). */
  inverse: string;
  transitive: boolean;
  symmetric: boolean;
}
