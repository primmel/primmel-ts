#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────
// The Annex B generator. Annex B of the language specification is the
// publication of the checker's rule registry (CHECK_RULES) — never
// hand-edited. The preamble prose is the spec's own; every family
// section's table regenerates from the registry, preserving the
// annex's section order (a family the registry gains appends a section
// after the last known one). The row's column order (level before
// default severity) is the registry's own print order.
//
//   annex-b.mts --check   verify the spec's Annex B matches the
//                         registry (exit 1 with the drift on any
//                         mismatch)
//   annex-b.mts --write   regenerate the family tables into the spec
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHECK_RULES } from '../src/check-rules';

function specAnnexPath(): string {
  const env = process.env.PRIMMEL_SPEC_SOURCES;
  if (env) {
    return join(env, 'language-v3/sections/91-annex-b-rule-catalog.adoc');
  }
  const here = import.meta.url.replace('file://', '');
  const sibling = join(here, '../../../../../spec/sources');
  const p = join(
    sibling,
    'language-v3/sections/91-annex-b-rule-catalog.adoc',
  );
  if (existsSync(p)) {
    return p;
  }
  throw new Error('spec sources not found — set PRIMMEL_SPEC_SOURCES');
}

const HEADER_ROWS = ['|Rule |Name |Level |Default severity'];

function familyTable(family: string): string[] {
  const rules = CHECK_RULES.filter(r => r.family === family);
  return [
    '',
    '',
    '[cols="1,3,1,1", options="header"]',
    '|===',
    ...HEADER_ROWS,
    '',
    ...rules.map(
      r => `|${r.id} |\`${r.name}\` |${r.level} |${r.severity}`,
    ),
    '|===',
  ];
}

// ── the annex's current section order ────────────────────────────────
const path = specAnnexPath();
const text = readFileSync(path, 'utf8');
const lines = text.split('\n');
const firstSection = lines.findIndex(l => /^=== [a-z-]+$/.test(l));
if (firstSection < 0) {
  console.error(
    'the first family section was not found — refusing to touch the file',
  );
  process.exit(1);
}
const preamble = lines.slice(0, firstSection);
const sectionTitles = [
  ...new Set(
    lines
      .slice(firstSection)
      .filter(l => /^=== [a-z-]+$/.test(l))
      .map(l => l.replace('=== ', '')),
  ),
];

// The registry's families in first-declaration order; families the
// annex does not know append after the known ones (the annex's order
// is otherwise preserved — it is editorial).
const registryFamilies: string[] = [];
for (const r of CHECK_RULES) {
  if (!registryFamilies.includes(r.family)) {
    registryFamilies.push(r.family);
  }
}
const known = sectionTitles.filter(t => registryFamilies.includes(t));
const novel = registryFamilies.filter(f => !sectionTitles.includes(f));
const order = [...known, ...novel];

const out = [
  ...preamble,
  ...order.flatMap(family => [`=== ${family}`, ...familyTable(family)]),
  '',
];

const mode = process.argv[2] ?? '--check';

if (mode === '--write') {
  writeFileSync(path, out.join('\n'));
  console.log(
    `regenerated Annex B: ${CHECK_RULES.length} rules in ${order.length} family sections`,
  );
  process.exit(0);
}

// check mode
const expected = out.join('\n');
if (expected !== text) {
  const registryById = new Map(CHECK_RULES.map(r => [r.id, r]));
  const annexIds = new Set(
    (text.match(/^\|C\d+ /gm) ?? []).map(l => l.split(' ')[0].slice(1)),
  );
  const drift: string[] = [];
  for (const r of CHECK_RULES) {
    if (!annexIds.has(r.id)) {
      drift.push(`missing from Annex B: ${r.id} (${r.name})`);
    }
  }
  for (const id of annexIds) {
    if (!registryById.has(id)) {
      drift.push(`Annex B row without a registry rule: ${id}`);
    }
  }
  if (drift.length === 0) {
    drift.push(
      'the tables match the registry row-for-row but the bytes differ (ordering, a header, or a severity/level cell) — regenerate with --write',
    );
  }
  console.error('Annex B drift:');
  for (const d of drift) {
    console.error(`  ${d}`);
  }
  process.exit(1);
}
console.log(
  `Annex B matches the registry: ${CHECK_RULES.length} rules in ${order.length} family sections`,
);
