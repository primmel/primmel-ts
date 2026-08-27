// ─────────────────────────────────────────────────────────────────────
// The trust reference (MN 114 v3.1, clause 19.3; TODO.primmel/10):
// a model-level reference to the trust plane —
//
//   trust_ref bfs-scheme-op
//   trust_ref bfs-scheme-op key bfs-2026-root
//
// An organization by its registry identifier, optionally one of the
// organization's published keys by key id.
//
// THE RESOLUTION CONTRACT (stated once, normative):
//   1. The reference is OPAQUE to the model: it carries addressing only
//      (the organization identifier, the optional key id), never key
//      material, endpoints, or credentials.
//   2. Resolution is the consumer's, at runtime: the platform resolves
//      the organization identifier against the trust registry it is
//      configured with, and the key id against that registry's published
//      key set for the organization. The registry's endpoint shape is
//      the platform's contract, never the language's.
//   3. A conforming checker NEVER resolves a trust reference: an
//      unresolved or unresolvable organization identifier is not a
//      finding, because the trust plane's membership at any moment is
//      runtime fact, not model content. The kernel checks the reference's
//      shape only (C105, on the dataspace's trust anchors).
// ─────────────────────────────────────────────────────────────────────

/** A trust-plane reference: addressing only, never key material. */
export interface TrustRef {
  /** The organization identifier in the trust registry the consuming
   *  platform is configured with. Opaque to the model. */
  org: string;
  /** The key id of one published key of the organization, or '' when the
   *  reference names the organization as a whole. */
  kid: string;
}
