// ─────────────────────────────────────────────────────────────────────
// The second checker's front end: the PG grammar's shape tree, walked
// into a small construct model. This module deliberately shares NO
// code with the kernel — the whole point of the second implementation
// is independence: the grammar artifact (checksummed, compiled from
// grammar/primmel.parg) decides the surface, and the rules re-derive
// their judgments from the shape tree alone.
//
// The shape tree's uniform node (verified by the grammar leg, 91/91):
//   { construct: { keyword: {value}, ident?: {value}, body } }
// where `body` is an item array — or, when the block's items produced
// no captures, the RAW matched text as a position node (the Parslet
// capture-of-uncaptured-subtree rule). Each body item is one of:
//   { construct: … }              — a nested declaration
//   { kwline: { key, value } }    — `key value…` (the value run may
//                                    carry {blockvalue: […]} nodes)
//   { entry: { key, value? } }    — `key : value…`
//   a string                      — a bare or quoted token
// A value run is greedy on its own line (the grammar's hgap
// continuation): `start_event begin end_event done` on one line is ONE
// kwline whose token stream names every event — the rules read the
// stream, not the line breaks.
// ─────────────────────────────────────────────────────────────────────

import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ShapeNode {
  [k: string]: unknown;
}

export interface PargRuntimeApi {
  parseShape(src: string): unknown;
}

export interface Item {
  kind: 'construct' | 'line' | 'raw';
  construct?: Construct;
  key?: string;
  /** The value run's flat tokens, de-quoted. */
  tokens: string[];
  /** The structured contents of each block value in the run. */
  blocks: Item[][];
}

export interface Construct {
  keyword: string;
  ident: string;
  items: Item[];
}

function positionText(node: unknown): string | null {
  if (
    node !== null &&
    typeof node === 'object' &&
    'value' in (node as ShapeNode) &&
    typeof (node as ShapeNode)['value'] === 'string' &&
    'offset' in (node as ShapeNode)
  ) {
    return (node as ShapeNode)['value'] as string;
  }
  return null;
}

function tokenText(t: unknown): string {
  const pos = positionText(t);
  if (pos !== null) {
    return pos.replace(/^"(.*)"$/s, '$1');
  }
  if (typeof t === 'string') {
    return t.replace(/^"(.*)"$/s, '$1');
  }
  if (t !== null && typeof t === 'object' && 'value' in (t as ShapeNode)) {
    return tokenText((t as ShapeNode)['value']);
  }
  return '';
}

/** Split a raw block text (`{ a b -> c }`) into its whitespace tokens. */
function splitRaw(raw: string): string[] {
  return raw
    .replace(/^\{/, '')
    .replace(/\}$/, '')
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 0)
    .map(t => t.replace(/^"(.*)"$/s, '$1'));
}

function runItems(run: unknown): { tokens: string[]; blocks: Item[][] } {
  const tokens: string[] = [];
  const blocks: Item[][] = [];
  const arr = Array.isArray(run) ? run : run === undefined ? [] : [run];
  for (const node of arr) {
    if (
      node !== null &&
      typeof node === 'object' &&
      'blockvalue' in (node as ShapeNode)
    ) {
      const inner = (node as ShapeNode)['blockvalue'];
      const innerArr = Array.isArray(inner) ? inner : [inner];
      blocks.push(innerArr.map(toItem).filter((x): x is Item => x !== null));
      continue;
    }
    const t = tokenText(node);
    if (t !== '') {
      tokens.push(t);
    }
  }
  return { tokens, blocks };
}

function toItem(node: unknown): Item | null {
  if (typeof node === 'string') {
    return { kind: 'line', tokens: [tokenText(node)], blocks: [] };
  }
  if (typeof node !== 'object' || node === null) {
    return null;
  }
  const n = node as ShapeNode;
  if ('construct' in n) {
    const c = toConstruct(n['construct']);
    return c !== null
      ? { kind: 'construct', construct: c, tokens: [], blocks: [] }
      : null;
  }
  for (const key of ['kwline', 'entry'] as const) {
    if (key in n) {
      const line = n[key] as ShapeNode;
      const run = runItems(line['value']);
      return {
        kind: 'line',
        key: tokenText(line['key']),
        tokens: run.tokens,
        blocks: run.blocks,
      };
    }
  }
  return null;
}

export function toConstruct(node: unknown): Construct | null {
  if (typeof node !== 'object' || node === null) {
    return null;
  }
  const n = node as ShapeNode;
  const keyword = tokenText(n['keyword']);
  if (keyword === '') {
    return null;
  }
  const ident = tokenText(n['ident']);
  const body = n['body'];
  const items: Item[] = [];
  if (Array.isArray(body)) {
    for (const b of body) {
      const i = toItem(b);
      if (i !== null) {
        items.push(i);
      }
    }
  } else {
    const raw = positionText(body) ?? (typeof body === 'string' ? body : null);
    if (raw !== null && raw.trim() !== '') {
      items.push({ kind: 'raw', tokens: splitRaw(raw), blocks: [] });
    }
  }
  return { keyword, ident, items };
}

/** The top-level constructs of one document's shape tree. */
export function documentConstructs(shape: unknown): Construct[] {
  if (!Array.isArray(shape)) {
    return [];
  }
  return shape
    .map(toItem)
    .flatMap(i =>
      i?.kind === 'construct' && i.construct ? [i.construct] : [],
    );
}

// ── the package reader: every .prl under the directory ─────────────

export interface ParsedPackage {
  constructs: Construct[];
}

export function readPackage(
  runtime: PargRuntimeApi,
  files: string[],
  read: (p: string) => string,
): ParsedPackage {
  const constructs: Construct[] = [];
  for (const f of files) {
    constructs.push(...documentConstructs(runtime.parseShape(read(f))));
  }
  return { constructs };
}

/** All `.prl` files under `dir`, sorted for determinism. */
export function collectPrlFiles(
  dir: string,
  readdir: (p: string) => string[],
  isDir: (p: string) => boolean,
): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdir(d).sort()) {
      const p = `${d}/${e}`;
      if (e === 'node_modules' || e === '.git') {
        continue;
      }
      if (isDir(p)) {
        walk(p);
      } else if (e.endsWith('.prl') && !e.startsWith('.')) {
        out.push(p);
      }
    }
  };
  walk(dir);
  return out;
}

export function resolveParsanolTs(rootGuess: string): string | null {
  const env = process.env.PRIMMEL_PARSANOL_TS;
  if (env) {
    return env;
  }
  const sibling = join(rootGuess, '..', '..', 'parsanol', 'parsanol-ts');
  return existsSync(sibling) ? sibling : null;
}
