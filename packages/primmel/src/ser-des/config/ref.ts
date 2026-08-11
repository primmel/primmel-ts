// config/ref.ts — the unified reference/relation construct (spec:
// primmel-smart-docs, docs/primmel/18-references-and-relations).
//
//   ref <predicate> "<target>"
//   ref <predicate> "<target>" { note "…" }
//
// One typed triple with the enclosing element as subject. The predicate
// is DATA (the predicate registry — the codec accepts any bare id; the
// declared-predicate validation lives in the check layer). The target
// is a URI: a document anchor (a clause/annex URN) or a model element
// id.
//
// The legacy citation spellings (`references { <role> {…} }`,
// `source { doc clause }`, `specification_reference "…"`) keep parsing
// into their own facets during the transition; packages migrate to the
// canonical form mechanically.

/** A typed reference/relation triple on an element. */
export interface Ref {
  predicate: string;
  target: string;
  note?: string;
}

/** Parse the value of a `ref` keyword: `<predicate> "<target>"` plus an
 *  optional `{ note "…" }` block. `t`/`i` sit just after the keyword. */
export function parseRef(
  t: string[],
  i: number,
  stripWrapping: (s: string) => string,
  unwrapBlock: (s: string) => string,
): { ref: Ref; next: number } {
  const predicate = stripWrapping(t[i++] ?? '');
  const target = stripWrapping(t[i++] ?? '');
  const ref: Ref = { predicate, target };
  if (i < t.length && t[i]!.startsWith('{')) {
    const block = unwrapBlock(t[i++]);
    const m = /note\s+"([^"]*)"/.exec(block) ?? /note\s+(\S+)/.exec(block);
    if (m) {
      ref.note = m[1];
    }
  }
  return { ref, next: i };
}

/** Dump an element's refs, one per line at the given indent. */
export function dumpRefs(
  refs: Ref[] | undefined,
  indent: string,
  escapeString: (s: string) => string,
): string {
  if (!refs || refs.length === 0) {
    return '';
  }
  let out = '';
  for (const r of refs) {
    out += `${indent}ref ${r.predicate} "${escapeString(r.target)}"`;
    out += r.note
      ? ` {\n${indent}  note "${escapeString(r.note)}"\n${indent}}\n`
      : '\n';
  }
  return out;
}
