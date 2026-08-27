// ─────────────────────────────────────────────────────────────────────
// The `corresponds` facet (MN 114 v3.1, clause 19.4; TODO.primmel/10):
// the generalized per-node correspondence declaration —
//
//   corresponds <scheme> "<concept>"
//   corresponds <scheme> "<concept>" {
//     projection <codec> { <key> <value> ... }
//   }
//
// The CDD-IRDI-on-attributes pattern (`irdi`) generalized to every node
// kind: maps-to, never is-defined-by. The scheme is data (the program's
// register, carried untyped); the concept is the scheme's own identifier,
// opaque to the model; the optional block carries the projection-steering
// declarations the named expression codec consumes at export.
//
// Parse/dump mirror ref.ts. The lenient-skip discipline for an
// UNRECORDED corresponds (a construct that does not claim the facet)
// lives in parse-block.ts: the skip consumes scheme + concept + the
// optional block, exactly like ref's skip.
// ─────────────────────────────────────────────────────────────────────

import { forEachEntry } from '../parse-block';
import { stripWrapping, unwrapBlock } from '../tokenize';
import type { Correspondence } from '../../types/Correspondence';

/** Parse the value of a `corresponds` keyword: `<scheme> "<concept>"`
 *  plus an optional `{ projection ... }` block. `t`/`i` sit just after
 *  the keyword. */
export function parseCorresponds(
  t: string[],
  i: number,
  stripWrapping: (s: string) => string,
): { corr: Correspondence; next: number } {
  const corr: Correspondence = {
    scheme: stripWrapping(t[i++] ?? ''),
    concept: stripWrapping(t[i++] ?? ''),
    projections: [],
  };
  if (i < t.length && t[i]!.startsWith('{')) {
    const block = unwrapBlock(t[i++]);
    forEachEntry(
      block,
      (keyword, value, peek) => {
        if (keyword === 'projection') {
          const codec = stripWrapping(value());
          const entries: Array<{ key: string; value: string }> = [];
          const next = peek();
          if (next && next.startsWith('{')) {
            forEachEntry(
              unwrapBlock(value()),
              (k, kv) => {
                // stripWrapping, not unwrapped: the payload is arbitrary
                // codec data and bare tokens must survive verbatim
                // (unwrapBlock mangles them — `read` would parse as `ea`).
                entries.push({ key: k, value: stripWrapping(kv()) });
                return true;
              },
              { construct: 'corresponds.projection', id: codec },
            );
          }
          corr.projections.push({ codec, entries });
          return true;
        }
        return false;
      },
      { construct: 'corresponds', id: corr.scheme },
    );
  }
  return { corr, next: i };
}

/** Parse a corresponds through the forEachEntry value/peek readers:
 *  consumes the scheme, the concept, and the optional block (peeked,
 *  never speculatively consumed). */
export function parseCorrespondsFromReaders(
  value: () => string,
  peek: () => string | undefined,
  stripWrapping: (s: string) => string,
): Correspondence {
  const parts = [value(), value()];
  const next = peek();
  if (next && next.startsWith('{')) {
    parts.push(value());
  }
  return parseCorresponds(parts, 0, stripWrapping).corr;
}

/** Dump an element's correspondences, one per line at the given indent,
 *  in declaration order; projections in their declaration order. */
export function dumpCorrespondences(
  corrs: Correspondence[] | undefined,
  indent: string,
  escapeString: (s: string) => string,
  dumpBareSafe: (s: string) => string,
): string {
  if (!corrs || corrs.length === 0) {
    return '';
  }
  let out = '';
  for (const c of corrs) {
    out += `${indent}corresponds ${dumpBareSafe(c.scheme)} "${escapeString(c.concept)}"`;
    if (c.projections.length === 0) {
      out += '\n';
      continue;
    }
    out += ' {\n';
    for (const p of c.projections) {
      out += `${indent}  projection ${dumpBareSafe(p.codec)} {`;
      for (const e of p.entries) {
        out += ` ${dumpBareSafe(e.key)} ${dumpBareSafe(e.value)}`;
      }
      out += ' }\n';
    }
    out += `${indent}}\n`;
  }
  return out;
}
