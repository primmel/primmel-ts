#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────
// The conformance suite's second-implementation leg: the PG grammar.
//
// The language's grammar is defined twice — once in the kernel's
// tokenizer/parser (packages/primmel/src/ser-des/) and once in PG, the
// Parsanol grammar language (grammar/primmel.parg, compiled to the
// checksummed artifact grammar/artifacts/primmel.json). This leg runs
// the PG grammar over every parse-kind case of the suite and requires
// its accept/reject verdict to agree with the case's expectation. Two
// independent implementations of one grammar agreeing on the whole
// corpus is the conformance statement; a disagreement means the two
// definitions have drifted and one of them is wrong.
//
// Judged: polarity only (`expect.parse` ok | error). The kernel's
// errorMatch substrings and the checker's issue codes are
// implementation-specific diagnostics and are not transferable to a
// second implementation. Strict-mode cases are skipped: strictness is
// a kernel option (default mode accepts unknown keywords for forward
// compatibility), not a property of the grammar.
//
// The leg runs the grammar in-process through parsanol-ts rather than
// through the adapter contract: the contract exists so a THIRD PARTY
// can plug in an arbitrary executable, while this leg is the
// language's own second implementation and 99 in-process parses beat
// 99 tsx spawns.
//
// The parsanol runtime is a development dependency resolved from:
//   1. $PRIMMEL_PARSANOL_TS — a path to the parsanol-ts checkout
//   2. the sibling checkout of the primmel workspace
//              (../../parsanol/parsanol-ts relative to this repository)
// When neither is present the leg reports a skip — it is an optional
// gate until parsanol-ts publishes, after which this resolution dies
// and the dependency becomes ordinary.
//
// The skip register (conformance/grammar-leg-skips.json) names the
// parse-kind negative cases whose rejection lives in the kernel's
// PER-CONSTRUCT parse discipline (required facet values, closed facet
// vocabularies, per-construct shape rules), which the grammar's open
// block structure cannot express yet. The register only shrinks: the
// leg errors on a stale entry (its case now agrees without the skip),
// on an entry naming a case that no longer exists, and on a
// disagreement whose case is not registered.
//
// Usage: npx tsx conformance/runner/grammar-leg.mts
// Exit codes: 0 every case agreed (or the leg skipped); 1 at least one
// disagreement or a stale register; 2 a broken leg (missing suite,
// corpus or artifact).
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface CaseExpect {
  parse?: 'ok' | 'error';
}
interface SuiteCase {
  id: string;
  clause: string;
  polarity: 'positive' | 'negative';
  kind: 'parse' | 'roundtrip' | 'check' | 'exports';
  path: string;
  options?: { strict?: boolean };
  expect: CaseExpect;
  summary: string;
}

interface SkipEntry {
  id: string;
  reason: string;
}

const SUITE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SUITE_DIR, '..');

function die(message: string): never {
  process.stderr.write(`grammar-leg: ${message}\n`);
  process.exit(2);
}

function resolveParsanolTs(): string | null {
  const env = process.env.PRIMMEL_PARSANOL_TS;
  if (env) {
    return env;
  }
  const sibling = join(REPO_ROOT, '..', '..', 'parsanol', 'parsanol-ts');
  return existsSync(sibling) ? sibling : null;
}

const parsanolTs = resolveParsanolTs();
if (!parsanolTs) {
  process.stdout.write(
    'grammar-leg: skipped — no parsanol-ts checkout (set PRIMMEL_PARSANOL_TS ' +
      'or check out parsanol-ts beside this repository)\n',
  );
  process.exit(0);
}

const runtimePath = join(parsanolTs, 'dist', 'runtime.js');
if (!existsSync(runtimePath)) {
  die(`no runtime at ${runtimePath} — run "yarn build" (or tsc) in the parsanol-ts checkout`);
}
const artifactPath = join(REPO_ROOT, 'grammar', 'artifacts', 'primmel.json');
if (!existsSync(artifactPath)) {
  die(`no grammar artifact at ${artifactPath} — compile grammar/primmel.parg with parsanol`);
}

const { PargRuntime } = (await import(runtimePath)) as {
  PargRuntime: { fromFile(path: string): { parseShape(src: string): unknown; runTests(): string[] } };
};

// Construction throws when the artifact's checksum does not verify.
const grammar = PargRuntime.fromFile(artifactPath);

const selfTestFailures = grammar.runTests();
if (selfTestFailures.length > 0) {
  die(`the grammar's inline accept/reject tests fail: ${JSON.stringify(selfTestFailures)}`);
}

const manifest = JSON.parse(readFileSync(join(SUITE_DIR, 'corpus', 'cases.json'), 'utf8')) as {
  cases: SuiteCase[];
};
const allParse = manifest.cases.filter(c => c.kind === 'parse');
const cases = allParse.filter(c => !c.options?.strict);
const skippedStrict = allParse.length - cases.length;
const caseIds = new Set(cases.map(c => c.id));

const register = JSON.parse(
  readFileSync(join(SUITE_DIR, 'grammar-leg-skips.json'), 'utf8'),
) as { skips: SkipEntry[] };
const skipReason = new Map<string, string>();
for (const s of register.skips) {
  if (!caseIds.has(s.id)) {
    die(`stale skip-register entry ${s.id}: no such parse case — the register only shrinks`);
  }
  skipReason.set(s.id, s.reason);
}

let agreed = 0;
let disagreed = 0;
let skipped = skippedStrict;
const disagreements: string[] = [];
const staleEntries: string[] = [];
for (const c of cases) {
  const source = readFileSync(join(SUITE_DIR, 'corpus', c.path), 'utf8');
  let accepted: boolean;
  let detail = '';
  try {
    grammar.parseShape(source);
    accepted = true;
  } catch (e) {
    accepted = false;
    detail = String((e as Error)?.message ?? e).slice(0, 120);
  }
  const expected = c.expect.parse;
  if (expected === undefined) {
    die(`case ${c.id}: parse case without expect.parse`);
  }
  if ((expected === 'ok') === accepted) {
    agreed++;
    if (skipReason.has(c.id)) {
      staleEntries.push(`  ${c.id}: the case now agrees without the skip`);
    }
  } else if (skipReason.has(c.id)) {
    skipped++;
  } else {
    disagreed++;
    disagreements.push(
      `  ${c.id} (${c.clause}, ${c.polarity}): expected parse ${expected}, the grammar ` +
        (accepted ? 'accepted' : `rejected: ${detail}`),
    );
  }
}
for (const [id] of skipReason) {
  if (!cases.some(c => c.id === id)) {
    die(`stale skip-register entry ${id}: no such parse case — the register only shrinks`);
  }
}

process.stdout.write(
  `grammar-leg: the PG grammar agrees on ${agreed}/${cases.length} parse cases ` +
    `(${disagreed} disagreements, ${skipped} skipped — ${skippedStrict} strict-mode, ` +
    `${skipped - skippedStrict} register entries)\n`,
);
if (staleEntries.length > 0) {
  process.stdout.write(`stale skip-register entries — delete them (the register only shrinks):\n`);
  process.stdout.write(staleEntries.join('\n') + '\n');
  process.exit(1);
}
if (disagreements.length > 0) {
  process.stdout.write(disagreements.join('\n') + '\n');
  process.exit(1);
}
