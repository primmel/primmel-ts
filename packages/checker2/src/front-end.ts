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
//   { assignment: { key, value } }— `key = value…` (the LutaML
//                                    instance surface; the value run
//                                    may be a token ARRAY: 2.2 t)
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

/** The source text a positioned node's span covers — the raw payload
 *  of the expression carriers' block values. */
let CURRENT_SOURCE = '';

function spanText(node: unknown): string | null {
  let min = Infinity;
  let max = -Infinity;
  const walk = (n: unknown): void => {
    if (n === null || typeof n !== 'object') {
      return;
    }
    const rec = n as Record<string, unknown>;
    if (
      typeof rec['value'] === 'string' &&
      typeof rec['offset'] === 'number' &&
      typeof rec['length'] === 'number'
    ) {
      const off = rec['offset'] as number;
      const len = rec['length'] as number;
      if (off < min) {
        min = off;
      }
      if (off + len > max) {
        max = off + len;
      }
    }
    for (const v of Object.values(rec)) {
      if (Array.isArray(v)) {
        v.forEach(walk);
      } else if (v !== null && typeof v === 'object') {
        walk(v);
      }
    }
  };
  walk(node);
  if (min === Infinity || max === -Infinity || CURRENT_SOURCE === '') {
    return null;
  }
  return CURRENT_SOURCE.slice(min, max);
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

/** Split a raw block text (`{ a "b c" -> d }`) into its tokens,
 *  respecting double-quoted strings. */
function splitRaw(raw: string): string[] {
  const body = raw.replace(/^\{/, '').replace(/\}$/, '');
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of body) {
    if (ch === '"') {
      quoted = !quoted;
      cur += ch;
    } else if (!quoted && /\s/.test(ch)) {
      if (cur !== '') {
        out.push(cur.replace(/^"(.*)"$/s, '$1'));
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur !== '') {
    out.push(cur.replace(/^"(.*)"$/s, '$1'));
  }
  return out;
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
      const items = innerArr.map(toItem).filter((x): x is Item => x !== null);
      if (items.length === 0) {
        // an unparsed block value (the expression carriers): the raw
        // span is the payload — the rules read its tokens
        const raw = positionText(inner);
        blocks.push([
          { kind: 'raw', tokens: raw ? splitRaw(raw) : [], blocks: [] },
        ]);
      } else {
        blocks.push(items);
      }
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
  for (const key of ['kwline', 'entry', 'assignment'] as const) {
    if (key in n) {
      const line = n[key] as ShapeNode;
      if ('blockvalue' in line) {
        // the expression carrier (register 18): keyword + block — the
        // block's RAW span is the payload, the rules read its tokens
        const inner = line['blockvalue'];
        const raw = spanText(inner);
        const rawItem: Item = {
          kind: 'raw',
          tokens: raw ? splitRaw(raw) : [],
          blocks: [],
        };
        const lineItem: Item = {
          kind: 'line',
          key: tokenText(line['key']),
          tokens: [],
          blocks: [[rawItem]],
        };
        return lineItem;
      }
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
  // The LutaML attribute surface separates name and type with a comma
  // that rides the bare token (`attribute e_max, Mass`) — the kernel's
  // parseLutamlAttribute strips it; so does the second implementation.
  const ident = tokenText(n['ident']).replace(/,$/, '');
  const body = n['body'];
  const items: Item[] = [];
  if (Array.isArray(body)) {
    for (const b of body) {
      if (process.env.C2_DEBUG && b !== null && typeof b === 'object') {
        console.error(
          'BODY NODE KEYS:',
          Object.keys(b as object),
          JSON.stringify(b).slice(0, 150),
        );
      }
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

/** One shipped document's harvest index (sources-prd/*.sentences.json):
 *  the fragment paths and sentence addresses the document actually
 *  contains — C169 resolves bindings against it. */
export interface ShippedDocument {
  urn: string;
  fragments: Set<string>;
  addresses: Set<string>;
}

export interface ParsedPackage {
  constructs: Construct[];
  /** The shipped documents' harvest indexes (absent when the package
   *  ships none or the caller reads no artifacts). */
  documents?: ShippedDocument[];
  /** The parsed .primmel-allowlist.prl contents (absent when none):
   *  the allowlist_entry constructs and the budget lines. */
  allowlist?: { entries: Construct[]; lines: Item[] };
  /** The package directory (absent for in-memory packages). */
  dir?: string;
  /** The directory's top-level entries (the artifact inventory — C170's
   *  edition-mapping.json check reads it; absent for in-memory packages). */
  files?: string[];
  /** Sibling-directory packages (the lineage counterparties). */
  siblings?: ParsedPackage[];
}

export function readPackage(
  runtime: PargRuntimeApi,
  files: string[],
  read: (p: string) => string,
): ParsedPackage {
  const constructs: Construct[] = [];
  for (const f of files) {
    const src = read(f);
    CURRENT_SOURCE = src;
    constructs.push(...documentConstructs(runtime.parseShape(src)));
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
      } else if (
        (e.endsWith('.prl') || e === 'package.primmel') &&
        !e.startsWith('.')
      ) {
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
