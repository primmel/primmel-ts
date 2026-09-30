// ─────────────────────────────────────────────────────────────────────
// R1 — the registry parity test (the typed kernel; 03-typed-kernel.md).
// The construct registry of the published specification (Annex A) and
// the parser's CONSTRUCTS array are verified together: a parser keyword
// absent from the registry fails, unless the visible triage list marks
// it `unspecified-pending-triage`; a triage-listed keyword that has
// since gained a specification section also fails, because the entry
// must die. The list only shrinks.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PARSER_CONFIG } from '../src/ser-des/config';

const pkgRoot = join(__dirname, '..');

function specRoot(): string | null {
  const env = process.env.PRIMMEL_SPEC_SOURCES;
  if (env) {
    return env;
  }
  // A branch-local pointer (one relative path) may pair this checkout
  // with a spec worktree; the spike branches use it and it dies at
  // merge.
  const pointer = join(pkgRoot, '../../.spec-root');
  if (existsSync(pointer)) {
    const rel = readFileSync(pointer, 'utf8').trim().split('\n')[0]!;
    if (rel) {
      return join(pkgRoot, rel);
    }
  }
  // the sibling spec checkout of the primmel workspace
  const sibling = join(pkgRoot, '../../../spec/sources');
  return existsSync(sibling) ? sibling : null;
}

interface AnnexRow {
  keyword: string;
  aliases: string[];
}

function annexAKeywords(sourcesDir: string): Map<string, AnnexRow> {
  const path = join(
    sourcesDir,
    'language-v3',
    'sections',
    '90-annex-a-constructs.adoc',
  );
  const rows = new Map<string, AnnexRow>();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\|`([a-z_]+)`\s*\|([^|]*)\|/);
    if (!m) {
      continue;
    }
    const aliases = (m[2] ?? '')
      .split('`')
      .map(s => s.trim())
      .filter(s => /^[a-z_]+$/.test(s));
    rows.set(m[1]!, { keyword: m[1]!, aliases });
  }
  return rows;
}

interface TriageEntry {
  keyword: string;
  status: string;
}

function triageList(): TriageEntry[] {
  const path = join(pkgRoot, 'registry-triage.prl');
  if (!existsSync(path)) {
    return [];
  }
  const entries: TriageEntry[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([a-z_]+)\s+(unspecified-pending-triage.*)$/);
    if (m) {
      entries.push({ keyword: m[1]!, status: m[2]! });
    }
  }
  return entries;
}

describe('R1 registry parity (spec Annex A ↔ parser CONSTRUCTS)', () => {
  const sources = specRoot();
  const skip = sources === null;

  // The parser's keyword universe: every registered keyword + alias.
  const parserKeywords = new Map<string, string>(); // keyword → construct keyword
  for (const [kw, cfg] of Object.entries(PARSER_CONFIG)) {
    const aliases = ((cfg as unknown as { aliases?: string[] }).aliases ??
      []) as string[];
    parserKeywords.set(kw, kw);
    for (const a of aliases) {
      parserKeywords.set(a, kw);
    }
  }

  (skip ? it.skip : it)('every parser keyword has a normative home', () => {
    const annex = annexAKeywords(sources!);
    const annexKeywords = new Set<string>();
    for (const [kw, row] of annex) {
      annexKeywords.add(kw);
      for (const a of row.aliases) {
        annexKeywords.add(a);
      }
    }
    const triage = new Map(triageList().map(e => [e.keyword, e.status]));

    const missing: string[] = [];
    for (const kw of parserKeywords.keys()) {
      if (annexKeywords.has(kw)) {
        continue;
      }
      if (triage.has(kw)) {
        continue;
      }
      missing.push(kw);
    }
    assert.deepEqual(
      missing.sort(),
      [],
      'parser keywords with no specification section and no triage entry — ' +
        'specify the construct or mark it unspecified-pending-triage in ' +
        'registry-triage.prl',
    );
  });

  (skip ? it.skip : it)(
    'the triage list only shrinks (a specified keyword leaves the list)',
    () => {
      const annex = annexAKeywords(sources!);
      const annexKeywords = new Set<string>();
      for (const [kw, row] of annex) {
        annexKeywords.add(kw);
        for (const a of row.aliases) {
          annexKeywords.add(a);
        }
      }
      const stale = triageList()
        .filter(e => annexKeywords.has(e.keyword))
        .map(e => `${e.keyword} (${e.status})`);
      assert.deepEqual(
        stale.sort(),
        [],
        'triage-listed keywords that now have specification sections — ' +
          'remove the entries from registry-triage.prl; the list only shrinks',
      );
    },
  );

  (skip ? it.skip : it)(
    'every registry keyword has a parser configuration',
    () => {
      // The registry is generated from the parser configuration, so a
      // specification section whose construct has not landed is the
      // parity failure that holds the change open until it does.
      const annex = annexAKeywords(sources!);
      const orphaned: string[] = [];
      for (const [kw, row] of annex) {
        if (parserKeywords.has(kw)) {
          continue;
        }
        if (row.aliases.every(a => !parserKeywords.has(a))) {
          orphaned.push(kw);
        }
      }
      assert.deepEqual(
        orphaned.sort(),
        [],
        'registry keywords with no parser configuration — implement the ' +
          'construct (the specification section is written first; the ' +
          'parity gate holds until the parser lands)',
      );
    },
  );
});
