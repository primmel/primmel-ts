#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────
// The conformance suite's second-CHECKER leg: the rules re-implemented
// over the PG grammar's shape tree (packages/checker2 — no kernel
// code), run against the SAME corpus and the SAME runner as the
// reference implementation.
//
// The selection: every check-kind case whose expectation stays within
// checker2's reach — clean positives across ALL families (a
// false-positive detector: an over-eager rule breaks clean packages
// of every kind), the negatives whose full expected rule set is
// implemented, and the error-form cases (the loader's fail-fast
// diagnostics: the manifest's id and status discipline, whose
// messages mirror the reference loader's). Cases naming
// unimplemented rules are counted and reported, never silently
// skipped: the register (conformance/checker2-rules.json) is the
// visible only-grows list, and the leg errors on drift in either
// direction.
//
// Usage: npx tsx conformance/runner/checker2-leg.mts
// Exit codes: 0 every selected case passed under checker2 (or the leg
// skipped — no parsanol checkout); 1 at least one disagreement or a
// register drift; 2 a broken leg.
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SUITE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SUITE_DIR, '..');

function die(message: string): never {
  process.stderr.write(`checker2-leg: ${message}\n`);
  process.exit(2);
}

interface SuiteCase {
  id: string;
  kind: string;
  with?: Record<string, string>;
  expect: { clean?: boolean; rules?: string[]; error?: string };
}

const cases = JSON.parse(
  readFileSync(join(SUITE_DIR, 'corpus', 'cases.json'), 'utf8'),
) as { cases: SuiteCase[] };
const register = JSON.parse(
  readFileSync(join(SUITE_DIR, 'checker2-rules.json'), 'utf8'),
) as { implemented: string[] };
const implemented = new Set(register.implemented);

// Register drift: the implementation's rule ids must equal the
// register's, in both directions. The rules module is the source of
// truth; grep its rule emissions rather than importing it (the leg
// spawns the adapter as the runner does).
const rulesSrc = readFileSync(join(REPO_ROOT, 'packages', 'checker2', 'src', 'rules.ts'), 'utf8');
const emitted = new Set([...rulesSrc.matchAll(/'(C\d+)'/g)].map(m => m[1]!));
for (const r of emitted) {
  if (!implemented.has(r)) {
    die(`register drift: rules.ts emits ${r} but checker2-rules.json does not list it`);
  }
}
for (const r of implemented) {
  if (!emitted.has(r)) {
    die(`register drift: checker2-rules.json lists ${r} but rules.ts does not emit it`);
  }
}

const parsanol = process.env.PRIMMEL_PARSANOL_TS
  ? process.env.PRIMMEL_PARSANOL_TS
  : join(REPO_ROOT, '..', '..', 'parsanol', 'parsanol-ts');
if (!existsSync(parsanol) || !existsSync(join(REPO_ROOT, 'grammar', 'artifacts', 'primmel.json'))) {
  process.stdout.write(
    'checker2-leg: skipped — no parsanol-ts checkout or grammar artifact\n',
  );
  process.exit(0);
}

const selected: string[] = [];
let waiting = 0;
for (const c of cases.cases) {
  if (c.kind !== 'check') {
    continue;
  }
  if (c.expect.clean === true) {
    selected.push(c.id);
    continue;
  }
  const rules = c.expect.rules ?? [];
  if (rules.length > 0 && rules.every(r => implemented.has(r))) {
    selected.push(c.id);
  } else if (c.expect.error !== undefined) {
    // The error-form cases: the loader's fail-fast diagnostics, whose
    // messages the adapter mirrors.
    selected.push(c.id);
  } else {
    waiting++;
  }
}

// Run the suite's own runner over the selected cases with checker2 as
// the adapter — the same corpus, the same judgment, a second
// implementation.
const proc = spawnSync(
  'npx',
  [
    'tsx',
    join(SUITE_DIR, 'runner', 'run.mts'),
    '--adapter',
    'tsx packages/checker2/adapter.mts',
    ...selected.flatMap(id => ['--case', id]),
  ],
  { cwd: REPO_ROOT, encoding: 'utf8' },
);
process.stdout.write(proc.stdout ?? '');
if (proc.status !== 0) {
  process.stderr.write(proc.stderr ?? '');
  process.exit(1);
}

process.stdout.write(
  `checker2-leg: ${selected.length} cases judged by the second implementation ` +
    `(${waiting} wait for their rules — the register grows)\n`,
);
