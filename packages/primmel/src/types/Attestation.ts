/**
 * The attestation construct (the typed kernel; clause 19 of the
 * language specification): the claim that a third party has verified a
 * subject against a declared promise set.
 *
 * The certificate is the attestation's document form: the print
 * projection is an artifact definition whose content contract derives
 * from the attested promise set, and one issued certificate is an
 * artifact instance of it. The attestation itself carries what no other
 * construct does — the verifying authority, the evidence basis, and
 * the lineage of the claims it carries (the declaration each
 * characteristic came from and the verdict that validated it).
 *
 * The lineage is data (kernel rule R7): nothing is re-entered or
 * re-extracted between the declaration, the validation, and the
 * carry-forward; the attestation references its predecessors.
 */

export interface AttestationBasis {
  /** The evidence kind (test_report, evaluation_report, audit, …). */
  kind: string;
  /** The evidence identifier. */
  id: string;
}

export interface AttestationLimit {
  /** The limit's label (scope, legal, quotation, … — the attestation's own vocabulary). */
  label: string;
  /** The limit's stated text, verbatim. */
  text: string;
}

/** One carried claim: a promise, the declaration it came from, the verdict that validated it. */
export interface AttestationClaim {
  /** The promise id within the attested promise set. */
  promise: string;
  /** The declaration instance whose value is carried. */
  declared: string;
  /** The verdict reference that validated the value. */
  validatedBy: string;
}

export default interface Attestation {
  id: string;
  /** The certified instance (an instance id of the subject chain). */
  subject: string;
  /** The attested promise set, `Subject.promise_set_id` form. */
  promises: string;
  /** The evidence the attestation rests on. */
  basis: AttestationBasis[];
  /** The verifying party: a role reference and the authority's stated name. */
  authority: { role: string; name: string };
  /** The attestation's own wording, verbatim. */
  statement: string;
  /** The attestation's stated limits as labelled texts. */
  limits: AttestationLimit[];
  /** The carry-forward: one claim per promise the certificate prints. */
  claims: AttestationClaim[];
  referenceIds: string[];
}
