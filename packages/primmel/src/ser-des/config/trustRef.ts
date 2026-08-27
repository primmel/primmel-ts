// ─────────────────────────────────────────────────────────────────────
// The `trust_ref` form (MN 114 v3.1, clause 19.3; TODO.primmel/10): the
// model-level reference to the trust plane —
//
//   trust_ref <org-id> [key <kid>]
//
// The resolution contract is normative on the type (types/TrustRef.ts):
// the reference is opaque to the model (addressing only, never key
// material), the consumer resolves it against its configured trust
// registry at runtime, and the checker never resolves it.
//
// v3.1 admits the form on the dataspace's trust anchors
// (config/dataspace.ts); later revisions may admit it on further
// constructs. The lenient-skip discipline for an unrecorded trust_ref
// lives in parse-block.ts: the skip consumes the organization identifier
// and an optional `key` pair.
// ─────────────────────────────────────────────────────────────────────

import type { TrustRef } from '../../types/TrustRef';

/** Parse the value of a `trust_ref` keyword: `<org-id> [key <kid>]`.
 *  `t`/`i` sit just after the keyword. */
export function parseTrustRef(
  t: string[],
  i: number,
  stripWrapping: (s: string) => string,
): { ref: TrustRef; next: number } {
  const ref: TrustRef = { org: stripWrapping(t[i++] ?? ''), kid: '' };
  if (i < t.length && t[i] === 'key') {
    i++;
    ref.kid = stripWrapping(t[i++] ?? '');
  }
  return { ref, next: i };
}

/** Parse a trust_ref through the forEachEntry value/peek readers:
 *  consumes the organization identifier and the optional `key` pair. */
export function parseTrustRefFromReaders(
  value: () => string,
  peek: () => string | undefined,
  stripWrapping: (s: string) => string,
): TrustRef {
  const ref: TrustRef = { org: stripWrapping(value()), kid: '' };
  if (peek() === 'key') {
    value(); // the `key` keyword
    ref.kid = stripWrapping(value());
  }
  return ref;
}

/** Dump a trust anchor's trust_ref line at the given indent. */
export function dumpTrustRef(
  ref: TrustRef,
  indent: string,
  dumpBareSafe: (s: string) => string,
): string {
  let out = `${indent}trust_ref ${dumpBareSafe(ref.org)}`;
  if (ref.kid !== '') {
    out += ` key ${dumpBareSafe(ref.kid)}`;
  }
  return out + '\n';
}
