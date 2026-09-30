#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────
// The conformance suite's CDDAL interop leg (TODO.reconfigure/04,
// "CDDAL interop"; the round-trip stability requirement — kernel rule
// R5 mirrored by cddal-spec clause 11).
//
// The dictionary subset of a Primmel package projects into CDDAL (the
// power-typed projection of src/export/cddal.ts: a class is a class
// entity — an instance of the class metaclass — and a Primmel instance
// is a SUBCLASS-OF-ONE, because CDD has no separate instance-entity),
// and the reference implementation (opencdd-ruby) parses the
// projection back. The leg requires:
//
//   1. the export is byte-stable — regenerating the fixture's
//      projection reproduces the tracked golden exactly;
//   2. the reference parse builds one entity per projected class and
//      instance, with the VERBATIM Primmel ids as codes (the hyphenated
//      id rides the quoted code assignment) and the `of` reference
//      resolving as the superclass;
//   3. the reference re-serialization preserves every identifier and
//      every property assignment.
//
// The reference repository is a development dependency resolved from:
//   1. $PRIMMEL_OPENCDD_RUBY — a path to the opencdd-ruby checkout
//   2. the sibling checkout of the workspace
//            (../../opencdd/opencdd-ruby relative to this repository)
// When neither is present the leg reports a skip (an optional gate
// until the gem publishes).
//
// Known counterpart finding, carried: opencdd-ruby's SERIALIZER emits
// hyphenated symbolic names unquoted in the instance declaration's
// name slot, which its own lexer cannot re-parse — serialize→parse
// idempotence holds for identifier-safe ids only. The leg asserts the
// database-level round trip for every id and the text-level
// preservation for all identifiers and assignments; the serializer's
// name-slot quoting is the opencdd team's fix.
//
// Usage: npx tsx conformance/runner/cddal-leg.mts
// Exit codes: 0 the leg passed (or skipped); 1 a preservation failure;
// 2 a broken leg (missing fixture, golden, or counterpart).
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { exportPackageCddal } from '../../packages/primmel/src/export/cddal.js';

const SUITE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SUITE_DIR, '..');
const FIXTURE = join(SUITE_DIR, 'corpus', 'interop', 'cddal', 'dictionary-subset');
const GOLDEN = join(FIXTURE, 'dictionary.cddal');

function die(message: string): never {
  process.stderr.write(`cddal-leg: ${message}\n`);
  process.exit(2);
}

function resolveOpencddRuby(): string | null {
  const env = process.env.PRIMMEL_OPENCDD_RUBY;
  if (env) {
    return env;
  }
  const sibling = join(REPO_ROOT, '..', '..', 'opencdd', 'opencdd-ruby');
  return existsSync(sibling) ? sibling : null;
}

if (!existsSync(join(FIXTURE, 'package.primmel')) || !existsSync(GOLDEN)) {
  die(`missing fixture at ${FIXTURE}`);
}
const opencddRuby = resolveOpencddRuby();
if (!opencddRuby) {
  process.stdout.write(
    'cddal-leg: skipped — no opencdd-ruby checkout (set PRIMMEL_OPENCDD_RUBY ' +
      'or check out opencdd-ruby beside this repository)\n',
  );
  process.exit(0);
}

// 1 — byte stability: the regenerated projection equals the golden.
const exported = exportPackageCddal(FIXTURE);
const golden = readFileSync(GOLDEN, 'utf8');
if (exported.cddal !== golden) {
  process.stdout.write(
    'cddal-leg: FAIL — the regenerated projection differs from the tracked golden\n',
  );
  process.exit(1);
}

// 2 + 3 — the reference round trip.
const tmp = mkdtempSync(join(tmpdir(), 'primmel-cddal-'));
const exportPath = join(tmp, 'export.cddal');
writeFileSync(exportPath, exported.cddal);
const proc = spawnSync(
  'bundle',
  ['exec', 'ruby', join(SUITE_DIR, 'runner', 'cddal-roundtrip.rb'), exportPath],
  { cwd: opencddRuby, encoding: 'utf8' },
);
if (proc.status !== 0) {
  die(
    `the reference round trip failed: ${proc.stderr.trim().split('\n').slice(-3).join(' | ')}`,
  );
}
const result = JSON.parse(proc.stdout) as {
  classes: { code: string; superclass: string }[];
  serialized: string;
};

const failures: string[] = [];
const expectEntity = (code: string, superclass: string): void => {
  const hit = result.classes.find(c => c.code === code);
  if (!hit) {
    failures.push(`no entity with code "${code}" after the reference parse`);
  } else if (hit.superclass !== superclass) {
    failures.push(
      `entity "${code}": superclass "${hit.superclass}", expected "${superclass}"`,
    );
  }
};

expectEntity('LoadCellSample', 'UNIVERSE');
expectEntity('smp-001', 'LoadCellSample');

for (const id of ['LoadCellSample', 'smp-001', 'serial_number', 'e_max', 'accuracy_class']) {
  if (!result.serialized.includes(id)) {
    failures.push(`identifier "${id}" absent from the reference re-serialization`);
  }
}
// Assignment preservation is TOKEN equivalence, not byte equality: the
// reference serializer normalizes quoted strings that look like
// identifiers to bare identifiers ("C3" → C3), which clause 11 treats
// as the same assignment.
const assignments: [property: string, value: string][] = [
  ['serial_number', 'HBK-001'],
  ['e_max', '2.2 t'],
  ['accuracy_class', 'C3'],
];
for (const [prop, value] of assignments) {
  const re = new RegExp(`^  ${prop}: ("${value}"|${value})$`, 'm');
  if (!re.test(result.serialized)) {
    failures.push(`assignment ${prop}: ${value} absent from the reference re-serialization`);
  }
}

process.stdout.write(
  `cddal-leg: the golden is byte-stable; the reference parse builds ` +
    `${result.classes.length} entities (${failures.length} preservation failures)\n`,
);
if (failures.length > 0) {
  process.stdout.write(failures.map(f => `  ${f}`).join('\n') + '\n');
  process.exit(1);
}
