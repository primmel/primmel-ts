// ─────────────────────────────────────────────────────────────────────
// fmt (register W8): the canonical serialization as a command. Each
// .prl content file loads, dumps, and — when the bytes differ — is
// written back in the canon. The fixpoint is the safety: the dumped
// text re-loads to itself, verified before any write; a file that does
// not round-trip byte-stably is reported, never rewritten. The author's
// facet order yields to the canonical order — the canon is the
// save-back contract (the kernel owns the serialized form; the editor's
// save path rides the same dump). Files that `include "…"` are skipped
// in place: the dump inlines the included text, and the include
// structure is the author's.
// ─────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { load, loadFile, dump } from './ser-des/index';

export interface FmtFileResult {
  file: string;
  status: 'formatted' | 'unchanged' | 'unstable' | 'skipped-includes';
}

export interface FmtResult {
  dir: string;
  files: FmtFileResult[];
  written: number;
}

const ALLOWLIST = '.primmel-allowlist.prl';

function walkPrl(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      walkPrl(p, out);
    } else if (e.endsWith('.prl') && e !== ALLOWLIST) {
      out.push(p);
    }
  }
  return out;
}

export function fmtPackage(dir: string, check = false): FmtResult {
  const result: FmtResult = { dir, files: [], written: 0 };
  for (const file of walkPrl(dir)) {
    const src = readFileSync(file, 'utf8');
    if (/^\s*include\s+"/m.test(src)) {
      result.files.push({ file, status: 'skipped-includes' });
      continue;
    }
    let canonical: string;
    try {
      const raw = dump(loadFile(file));
      // the fixpoint gate: the canonical text must re-load to itself
      if (dump(load(raw)) !== raw) {
        result.files.push({ file, status: 'unstable' });
        continue;
      }
      // a source without a metadata header gains an EMPTY one from the
      // Standard-level dump — strip the empty form back off; a metadata
      // block with content stays
      canonical = /^\s*metadata\s*\{/.test(src)
        ? raw
        : raw.replace(/^metadata \{\n(?: {2}\w+ ""\n)*\}\n+/, '');
    } catch {
      result.files.push({ file, status: 'unstable' });
      continue;
    }
    if (canonical === src) {
      result.files.push({ file, status: 'unchanged' });
      continue;
    }
    if (!check) {
      writeFileSync(file, canonical);
      result.written += 1;
    }
    result.files.push({ file, status: 'formatted' });
  }
  return result;
}
