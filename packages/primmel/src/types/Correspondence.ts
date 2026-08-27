// ─────────────────────────────────────────────────────────────────────
// The correspondence annotation (MN 114 v3.1, clause 19.4;
// TODO.primmel/10): the generalized per-node maps-to declaration —
//
//   corresponds iec-cdd "0112/2///61987#ABA001"
//   corresponds dpp "attr:moistureLimit" {
//     projection dpp-attribute { path "identity.moistureLimit" }
//   }
//
// Correspondence (maps-to) is not import (is-defined-by): the entry names
// the external concept in the scheme's own addressing (an IRDI, a URI, a
// claim name) and steers the expression codecs; the concept's semantics
// never enter the model. A program declares its correspondences ONCE, in
// the model, and every bridge consumes them instead of its own hand
// mapping.
//
// The CDD IRDI facet of an attribute definition (`irdi`) remains as the
// legacy single-scheme spelling of `corresponds iec-cdd`; when both are
// present they must name the same concept (C108).
// ─────────────────────────────────────────────────────────────────────

/** One projection-steering declaration: the named expression codec's
 *  input, authored once in the model. */
export interface CorrespondenceProjection {
  /** The expression codec the payload addresses — the program's register
   *  (`odrl`, `aas-submodel`, `dpp-attribute`, `vc-claim`, ...). The
   *  language carries the token untyped. */
  codec: string;
  /** The codec's steering input: an open key-value payload, stored
   *  untyped and validated by the codec at export time, never by the
   *  language. */
  entries: Array<{ key: string; value: string }>;
}

/** One correspondence of the enclosing element to an external concept. */
export interface Correspondence {
  /** The external scheme register the concept identifier belongs to
   *  (`iec-cdd`, `dpp`, `vc-claims`, ...) — data, not a keyword. */
  scheme: string;
  /** The concept identifier in the scheme's own addressing — opaque to
   *  the model. */
  concept: string;
  /** The projection-steering declarations, one per codec. */
  projections: CorrespondenceProjection[];
}
