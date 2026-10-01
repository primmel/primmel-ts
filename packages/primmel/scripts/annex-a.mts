#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────
// The Annex A generator (kernel rule R1; 09-migration-plan.md phase 0).
// Annex A of the language specification is generated from the parser
// configuration — never hand-edited. The mechanical columns (keyword,
// aliases, collection) come from CONSTRUCTS; the editorial columns
// (since, clause) are harvested from the existing table so a
// regeneration preserves them, and a NEW construct lands with
// placeholder editorial cells that the check mode rejects until the
// specification section exists — the construction freeze's gate.
//
//   annex-a.mts --check   verify the spec's Annex A matches the parser
//                         (exit 1 with the drift on any mismatch)
//   annex-a.mts --write   regenerate the mechanical table into the spec
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONSTRUCTS } from '../src/ser-des/config';

interface Row {
  keyword: string;
  aliases: string[];
  collection: string;
  since: string;
  clause: string;
  basis: string;
}

// The semantic basis (the full flow's phase 1): every construct's
// basis and mode — a documented MMEL primitive it realizes, a named
// composition over the eight terms, an extension with rationale, or a
// retraction candidate. The map is data (annex-a-basis.json, kept
// beside this script); a construct missing from it fails the check.
const basisMap = JSON.parse(
  readFileSync(join(import.meta.dirname, '../annex-a-basis.json'), 'utf8'),
) as Record<string, { basis: string; mode: string }>;

function specAnnexPath(): string {
  const env = process.env.PRIMMEL_SPEC_SOURCES;
  if (env) {
    return join(env, 'language-v3/sections/90-annex-a-constructs.adoc');
  }
  const here = import.meta.url.replace('file://', '');
  const sibling = join(here, '../../../../../spec/sources');
  const p = join(sibling, 'language-v3/sections/90-annex-a-constructs.adoc');
  if (existsSync(p)) {
    return p;
  }
  throw new Error('spec sources not found — set PRIMMEL_SPEC_SOURCES');
}

function parseRows(text: string): Row[] {
  const rows: Row[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\|`([a-z_]+)`\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)(?:\|([^|]*))?\|?$/);
    if (!m) {
      continue;
    }
    const aliases = (m[2] ?? '')
      .split('`')
      .map(s => s.trim())
      .filter(s => /^[a-z_]+$/.test(s));
    rows.push({
      keyword: m[1]!,
      aliases,
      collection: (m[3] ?? '').trim(),
      since: (m[4] ?? '').trim(),
      clause: (m[5] ?? '').trim(),
      basis: (m[6] ?? '').trim(),
    });
  }
  return rows;
}

function rowLine(r: Row): string {
  const aliasCell = r.aliases.length > 0 ? '`' + r.aliases.join('` `') + '`' : '';
  return `|\`${r.keyword}\` |${aliasCell ? ' ' + aliasCell : ''} |${r.collection ? ' ' + r.collection : ''} |${r.since ? ' ' + r.since : ''} |${r.clause ? ' ' + r.clause : ''} |${r.basis ? ' ' + r.basis : ''}`;
}

// ── the parser's mechanical truth ────────────────────────────────────
const parserRows: Row[] = CONSTRUCTS.map(c => {
  const def = c as unknown as {
    keyword: string;
    field?: string;
    aliases?: string[];
  };
  return {
    keyword: def.keyword,
    aliases: (def.aliases ?? []).slice(),
    collection: def.field ?? '',
    since: '',
    clause: '',
  };
});
const special = new Set(['root', 'version', 'metadata', 'package']);
for (const k of special) {
  const i = parserRows.findIndex(r => r.keyword === k);
  if (i >= 0) {
    parserRows.splice(i, 1);
  }
}

// ── the spec's current table ─────────────────────────────────────────
const path = specAnnexPath();
const text = readFileSync(path, 'utf8');
const specRows = parseRows(text);
const byKeyword = new Map(specRows.map(r => [r.keyword, r]));

// Harvest the editorial columns (the collection label is the human
// form of the field name, so it is editorial too). New constructs land
// with placeholders the check rejects (the freeze's gate: no construct
// merges without its specification section).
for (const pr of parserRows) {
  const existing = byKeyword.get(pr.keyword);
  pr.collection = existing?.collection ?? pr.collection;
  pr.since = existing?.since ?? '?? (fill before merge)';
  pr.clause = existing?.clause ?? '?? (fill before merge)';
  const basis = basisMap[pr.keyword];
  pr.basis = basis ? `${basis.mode}: ${basis.basis}` : '?? (basis missing — map it)';
}

// The triage list: constructs the specification has not yet registered
// are exempt from the missing-row check, and an entry that has gained a
// specification section must leave the list (the list only shrinks).
const triagePath = join(import.meta.dirname, '../registry-triage.prl');
const triage = new Set<string>();
if (existsSync(triagePath)) {
  for (const line of readFileSync(triagePath, 'utf8').split('\n')) {
    const m2 = line.match(/^([a-z_]+)\s+unspecified-pending-triage/);
    if (m2) {
      triage.add(m2[1]!);
    }
  }
}

const mode = process.argv[2] ?? '--check';

if (mode === '--write') {
  const lines = text.split('\n');
  // The replacement window is the REGISTRY table's rows only: the
  // annex carries other keyword-shaped tables above it (the special
  // declarations), so the window starts after the registry's own
  // header row (|Keyword …).
  const registryHeader = lines.findIndex(l => /^\|Keyword/.test(l));
  if (registryHeader < 0) {
    console.error('the construct registry header row was not found — refusing to write');
    process.exit(1);
  }
  const firstRow = lines.findIndex((l, i) => i > registryHeader && /^\|`[a-z_]+`/.test(l));
  const lastRow =
    lines.length -
    1 -
    [...lines].reverse().findIndex(l => /^\|`[a-z_]+`/.test(l));
  const sorted = [...parserRows].sort((a, b) => a.keyword.localeCompare(b.keyword));
  const out = [
    ...lines.slice(0, firstRow),
    ...sorted.map(rowLine),
    ...lines.slice(lastRow + 1),
  ];
  writeFileSync(path, out.join('\n'));
  console.log(`regenerated Annex A: ${sorted.length} construct rows (editorial columns preserved)`);
  process.exit(0);
}

// check mode
const drift: string[] = [];
const specKeywords = new Set(specRows.map(r => r.keyword));
for (const pr of parserRows) {
  const sr = byKeyword.get(pr.keyword);
  if (!sr) {
    if (!triage.has(pr.keyword)) {
      drift.push(`missing from Annex A: ${pr.keyword} (the registry is the parser — add the row or the triage entry)`);
    }
    continue;
  }
  if (triage.has(pr.keyword)) {
    drift.push(`${pr.keyword}: still triage-listed but present in Annex A — remove the registry-triage.prl entry (the list only shrinks)`);
    continue;
  }
  if (sr.aliases.join(',') !== pr.aliases.join(',')) {
    drift.push(
      `mechanical drift on ${pr.keyword}: spec has aliases [${sr.aliases}], parser has aliases [${pr.aliases}]`,
    );
  }
  if (sr.since.includes('??') || sr.clause.includes('??')) {
    drift.push(`${pr.keyword}: editorial placeholder unfilled — the construction freeze requires the section first`);
  }
  if (sr.basis !== pr.basis) {
    drift.push(
      `mechanical drift on ${pr.keyword}: basis column "${sr.basis}" does not match the map ("${pr.basis}")`,
    );
  }
}
for (const sr of specRows) {
  if (!parserRows.some(pr => pr.keyword === sr.keyword)) {
    drift.push(`Annex A row without a parser construct: ${sr.keyword}`);
  }
}
if (drift.length > 0) {
  console.error(`Annex A drift (${drift.length}):`);
  for (const d of drift) {
    console.error('  ' + d);
  }
  process.exit(1);
}
console.log(`Annex A matches the parser: ${parserRows.length} constructs, mechanical columns verified.`);
