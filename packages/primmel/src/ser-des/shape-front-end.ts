// ─────────────────────────────────────────────────────────────────────
// The shape front end (the full flow's phase 2 — the S2 endgame):
// the PARG SHAPE TREE drives the kernel's dispatch core. The grammar
// artifact decides the surface; this module materializes the
// declarations (keyword, id, payload) from the shape tree and the
// source spans, and the SAME parseDeclarations core that the token
// front end uses builds the ParseContext. Two front ends, one
// kernel — and the equivalence test pins that they agree.
// ─────────────────────────────────────────────────────────────────────

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import parse, { parseDeclarations, type SourceDeclaration } from './parse';
import type { ParseContext, ParseOptions } from './types';
import type { ParserConfiguration } from './config';

interface PosNode {
  value: string;
  offset: number;
  length: number;
}

export function resolveParsanolTs(rootGuess: string): string | null {
  const env = process.env.PRIMMEL_PARSANOL_TS;
  if (env) {
    return env;
  }
  const sibling = join(rootGuess, '..', '..', 'parsanol', 'parsanol-ts');
  return existsSync(sibling) ? sibling : null;
}

let cached: ((src: string) => unknown) | null = null;

async function shapeParser(
  artifact: string,
): Promise<(src: string) => unknown> {
  if (cached) {
    return cached;
  }
  const here = import.meta.url.replace('file://', '');
  // here = packages/primmel/src/ser-des/shape-front-end.ts — five ups
  // to the repository root, then the workspace sibling.
  const parsanol = resolveParsanolTs(join(here, '..', '..', '..', '..', '..'));
  if (!parsanol || !existsSync(artifact)) {
    throw new Error(
      'the shape front end needs the parsanol checkout (PRIMMEL_PARSANOL_TS) and the grammar artifact',
    );
  }
  const { PargRuntime } = (await import(
    join(parsanol, 'dist', 'runtime.js')
  )) as {
    PargRuntime: {
      fromFile(path: string): { parseShape(src: string): unknown };
    };
  };
  const rt = PargRuntime.fromFile(artifact);
  cached = (src: string) => rt.parseShape(src);
  return cached;
}

/** The whole-token occurrence of value NEAREST the anchor offset —
 *  the shape tree's spans index the preprocessed text and drift, but
 *  the drift is bounded, so the nearest whole-token occurrence (past
 *  comments and prose that may contain the same word) is the token's
 *  address. */
function indexOfToken(source: string, value: string, anchor: number): number {
  let best = -1;
  let from = 0;
  for (;;) {
    const i = source.indexOf(value, from);
    if (i < 0) {
      return best;
    }
    const prev = i === 0 ? ' ' : source[i - 1]!;
    if (!/[\w#]/.test(prev)) {
      if (best < 0 || Math.abs(i - anchor) < Math.abs(best - anchor)) {
        best = i;
      }
    }
    from = i + 1;
  }
}

function pos(node: unknown): PosNode | null {
  if (
    node !== null &&
    typeof node === 'object' &&
    'value' in (node as Record<string, unknown>) &&
    typeof (node as Record<string, unknown>)['value'] === 'string' &&
    'offset' in node
  ) {
    return node as PosNode;
  }
  return null;
}

/** The payload block sliced from the source: the brace-balanced span
 *  starting at/after `from` (string-aware, matching the tokenizer's
 *  block rule). */
function payloadBlock(source: string, from: number): string {
  let i = from;
  while (i < source.length && /\s/.test(source[i]!)) {
    i++;
  }
  if (source[i] !== '{') {
    return '';
  }
  let depth = 0;
  let quoted = false;
  const start = i;
  for (; i < source.length; i++) {
    const ch = source[i]!;
    if (quoted) {
      quoted = ch !== '"';
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  return source.slice(start);
}

/** The last position node in a shape subtree (the end anchor for
 *  keyword-line payloads). */
function lastPos(node: unknown, best: PosNode | null = null): PosNode | null {
  const p = pos(node);
  if (p) {
    return p.offset > (best?.offset ?? -1) ? p : best;
  }
  if (Array.isArray(node)) {
    for (const n of node) {
      best = lastPos(n, best);
    }
  } else if (node !== null && typeof node === 'object') {
    for (const v of Object.values(node as Record<string, unknown>)) {
      best = lastPos(v, best);
    }
  }
  return best;
}

function toDeclarations(
  shape: unknown,
  source: string,
  parsers: ParserConfiguration,
): SourceDeclaration[] {
  const out: SourceDeclaration[] = [];
  if (!Array.isArray(shape)) {
    return out;
  }
  for (const item of shape) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const n = item as Record<string, unknown>;
    if ('construct' in n) {
      const c = n['construct'] as Record<string, unknown>;
      const kw = pos(c['keyword']);
      const id = pos(c['ident']);
      if (!kw) {
        continue;
      }
      // Locate the token in the source by VALUE as a WHOLE token — the
      // shape tree's offsets index the preprocessed text (comments
      // stripped) and drift, and shorter ids prefix-match inside
      // longer ones (Signatory#data inside IASignatory#data).
      const anchor = id ? id.offset : kw.offset;
      const afterIdent = id
        ? indexOfToken(source, id.value, anchor) + id.value.length
        : indexOfToken(source, kw.value, anchor) + kw.value.length;
      out.push({
        keyword: kw.value,
        id: id?.value,
        payload: payloadBlock(source, afterIdent),
        start: { line: -1, col: -1, offset: kw.offset },
      });
    } else if ('kwline' in n || 'entry' in n) {
      const line = (n['kwline'] ?? n['entry']) as Record<string, unknown>;
      const key = pos(line['key']);
      const valueEnd = lastPos(line['value']);
      if (!key) {
        continue;
      }
      const afterKey =
        indexOfToken(source, key.value, key.offset) + key.value.length;
      const end = valueEnd ? valueEnd.offset + valueEnd.length : afterKey;
      out.push({
        keyword: key.value,
        payload: source.slice(afterKey, end).trim(),
        start: { line: -1, col: -1, offset: key.offset },
      });
    } else {
      // A raw item: an uncaptured line (`root Root`, `include "…"`, a
      // comment, a value declaration). Tokenize the matched text; a
      // known keyword heads a declaration, anything else is skipped —
      // matching the token front end's lenient unknown-keyword rule.
      const raw =
        pos(item) ??
        (typeof item === 'string'
          ? { value: item, offset: -1, length: 0 }
          : null);
      if (!raw) {
        continue;
      }
      // A raw node can span lines (comments swallow the declaration
      // lines beside them) — walk line by line, comments stripped at
      // the word boundary.
      for (const line of raw.value.split('\n')) {
        const stripped = line.replace(/(^|\s)(#|\/\/).*$/, '');
        const words = stripped.trim().split(/\s+/).filter(Boolean);
        const kw = words[0];
        if (kw && parsers[kw] !== undefined) {
          out.push({
            keyword: kw,
            payload: words.slice(1).join(' '),
            start: { line: -1, col: -1, offset: Math.max(0, raw.offset) },
          });
        }
      }
    }
  }
  return out;
}

/** Load one document's ParseContext from the SHAPE TREE (the grammar
 *  decides the surface; the dispatch core is the kernel's own). */
export async function parseFromShape(
  source: string,
  parsers: ParserConfiguration,
  options: ParseOptions = {},
  artifact = join(
    import.meta.url.replace('file://', ''),
    '..',
    '..',
    '..',
    '..',
    '..',
    'grammar',
    'artifacts',
    'primmel.json',
  ),
): Promise<ParseContext> {
  const parseShape = await shapeParser(artifact);
  const declarations = toDeclarations(parseShape(source), source, parsers);
  return parseDeclarations(declarations, parsers, options);
}

export { parse };
