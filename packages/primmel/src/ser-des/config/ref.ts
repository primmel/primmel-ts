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

/** Parse a ref through the forEachEntry value/peek readers: consumes the
 *  predicate, the target, and the optional note block (peeked, never
 *  speculatively consumed). */
export function parseRefFromReaders(
  value: () => string,
  peek: () => string | undefined,
  stripWrapping: (s: string) => string,
  unwrapBlock: (s: string) => string,
): Ref {
  const parts = [value(), value()];
  const next = peek();
  if (next && next.startsWith('{')) {
    parts.push(value());
  }
  return parseRef(parts, 0, stripWrapping, unwrapBlock).ref;
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

/** Split a derives-from target anchor into a provenance block:
 *  `<doc>#clause-<c>[/fragment]`. */
export function refTargetToSourceRef(target: string): {
  doc: string;
  clause: string;
  fragment?: string;
} | null {
  const m = /^(urn:[^#]+)(?:#(.+))?$/.exec(target);
  if (!m) {
    return null;
  }
  const anchor = m[2];
  if (!anchor) {
    return { doc: target, clause: '' };
  }
  if (anchor.startsWith('clause-')) {
    const rest = anchor.slice('clause-'.length);
    const slash = rest.indexOf('/');
    if (slash >= 0) {
      return {
        doc: m[1]!,
        clause: rest.slice(0, slash),
        fragment: rest.slice(slash + 1),
      };
    }
    return { doc: m[1]!, clause: rest };
  }
  // A non-clause anchor (a table, an annex) rides the doc, clause empty —
  // the legacy source block's exact shape.
  return { doc: target, clause: '' };
}

/** The single-model fold (docs/primmel/18 §18.4): a parsed ref maps onto
 *  the element's LEGACY channel, so every consumer (the check layer, the
 *  YAML projections) reads one model regardless of spelling:
 *    derives-from        → the provenance channel when the element HAS
 *                          one (sourceRefs + the singular mirror); forms
 *                          and fields carry their provenance as the
 *                          role-'source' entry of the role-references
 *                          channel instead (their legacy shape)
 *    cites               → the role-'reference' entry of the
 *                          role-references channel when the element has
 *                          one, else referenceIds
 *    other citation role → the role-references channel (fieldReferences /
 *                          formReferences, whichever the element carries)
 *    semantic predicate  → stays in refs (the new channel)
 *  Returns true when the ref was folded (never also keep it in refs). */
export function foldRefIntoLegacy(
  el: {
    source?: { doc: string; clause: string; fragment?: string } | null;
    sourceRef?: { doc: string; clause: string; fragment?: string } | null;
    sourceRefs?: Array<{ doc: string; clause: string; fragment?: string }>;
    reference?: string;
    fieldReferences?: Array<{ urn: string; role: string }>;
    formReferences?: Array<{ urn: string; role: string }>;
    referenceIds?: string[];
  },
  ref: Ref,
): boolean {
  if (ref.predicate === 'derives-from') {
    // Forms and fields carry provenance as the role-'source' entry of
    // their role-references channel (their legacy shape — the YAML
    // projections read exactly that channel); everything else has a real
    // provenance channel (sourceRefs + the singular mirror).
    const roleChannel = el.fieldReferences ?? el.formReferences;
    const hasProvenanceSlot =
      'source' in el || 'sourceRef' in el || el.sourceRefs !== undefined;
    if (roleChannel && !hasProvenanceSlot) {
      roleChannel.push({ urn: ref.target, role: 'source' });
      return true;
    }
    const b = refTargetToSourceRef(ref.target);
    if (!b) {
      return false;
    }
    (el.sourceRefs ??= []).push(b);
    // The first-entry back-compat: the singular provenance slots mirror
    // the first block (the legacy parse's invariant) — `source` on most
    // constructs, `sourceRef` where the construct spells it that way
    // (table, conformance test), and the scalar `reference` URN where
    // the construct carries it (conformance test).
    if ('source' in el && !el.source) {
      el.source = b;
    }
    if ('sourceRef' in el && !el.sourceRef) {
      el.sourceRef = b;
    }
    if ('reference' in el && !el.reference) {
      el.reference = b.doc;
    }
    return true;
  }
  if (ref.predicate === 'cites') {
    // The role-references channel is the citation home where the element
    // has one (forms, fields); referenceIds elsewhere.
    if (el.fieldReferences) {
      el.fieldReferences.push({ urn: ref.target, role: 'reference' });
    } else if (el.formReferences) {
      el.formReferences.push({ urn: ref.target, role: 'reference' });
    } else if (el.referenceIds) {
      el.referenceIds.push(ref.target);
    }
    return true;
  }
  const CITATION_ROLES = [
    'requirement',
    'test-procedure',
    'calculation',
    'report-format',
    'method',
  ];
  if (CITATION_ROLES.includes(ref.predicate)) {
    const channel = el.fieldReferences ?? el.formReferences;
    if (!channel) {
      return false;
    }
    channel.push({ urn: ref.target, role: ref.predicate });
    return true;
  }
  return false;
}

/** The canonical dump of one provenance block (docs/primmel/18 §18.4):
 *  a URN-anchored source emits the derives-from ref line; a free-text
 *  doc keeps the legacy source block. */
export function dumpSourceRefAsRef(
  src: { doc: string; clause: string; fragment?: string },
  indent: string,
  escapeString: (s: string) => string,
): string {
  if (src.doc && src.doc.startsWith('urn:')) {
    const anchor = `${src.doc}${src.clause ? '#clause-' + src.clause : ''}${src.fragment ? '/' + src.fragment : ''}`;
    return `${indent}ref derives-from "${escapeString(anchor)}"\n`;
  }
  return (
    `${indent}source { doc "${escapeString(src.doc ?? '')}" clause "${escapeString(String(src.clause ?? ''))}"` +
    (src.fragment ? ` fragment "${escapeString(src.fragment)}"` : '') +
    ' }\n'
  );
}
