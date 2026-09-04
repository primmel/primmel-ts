export default interface Reference {
  id: string;
  document: string;
  clause: string;
  /** Human-readable document title. */
  title?: string;
  /** The publishing organization (v3.2 structured identity, C112). */
  org?: string;
  /** The publication edition (v3.2 structured identity, C112). */
  edition?: string;
  /**
   * The resolvable identifier (v3.2, C112). When present it IS the
   * document's identity and the clause anchor composes as
   * `<urn>#clause-<clause>`; when absent the org/document/edition/clause
   * quadruple is the identity a consumer's locator resolves.
   */
  urn?: string;
}
