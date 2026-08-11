/** A typed reference/relation triple (spec: docs/primmel/18 —
 *  References and Relations): the enclosing element is the subject;
 *  the predicate is an id from the predicate registry (data, not
 *  grammar); the target is a URI (a document anchor or a model
 *  element id). */
export interface Ref {
  predicate: string;
  target: string;
  note?: string;
}
