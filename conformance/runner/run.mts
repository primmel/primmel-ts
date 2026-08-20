#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────
// The Primmel conformance suite: the runner.
//
// Executes an implementation under test against the corpus and reports
// conformance clause by clause. The implementation is plugged in as an
// ADAPTER COMMAND honouring the contract documented in
// conformance/docs/running-a-third-party-implementation.md:
//
//   <adapter> parse [--strict] <file.prl>
//   <adapter> roundtrip <file.prl>
//   <adapter> check <package-dir> [--with <id>=<dir>]...
//
// Usage:
//   run.mts --adapter '<command>' [--corpus <dir>] [--report <file.json>]
//           [--case <id>]...
//
// Exit codes: 0 every case passed; 1 at least one case failed or the
// adapter malfunctioned; 2 a usage error or a broken suite (the
// structural invariants are re-validated on every run).
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SUITE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── the suite's data shapes ──────────────────────────────────────────

interface SuiteManifest {
  name: string;
  version: string;
  date: string;
}

interface Clause {
  id: string;
  area: string;
  title: string;
  statement: string;
  rules: string[];
}

interface CaseExpect {
  parse?: 'ok' | 'error';
  errorMatch?: string;
  issues?: string[];
  roundtrip?: 'ok' | 'error';
  outputEqualsInput?: boolean;
  outputDiffersFromInput?: boolean;
  clean?: boolean;
  rules?: string[];
  error?: string;
}

interface SuiteCase {
  id: string;
  clause: string;
  polarity: 'positive' | 'negative';
  kind: 'parse' | 'roundtrip' | 'check';
  path: string;
  options?: { strict?: boolean };
  with?: Record<string, string>;
  expect: CaseExpect;
  summary: string;
}

// ── the adapter contract's result shapes ─────────────────────────────

interface AdapterIssue {
  code?: string;
  rule?: string;
  severity?: string;
  message?: string;
}

interface AdapterResult {
  ok: boolean;
  error?: string;
  issues?: AdapterIssue[];
  stable?: boolean;
  output?: string;
}

type CaseStatus = 'pass' | 'fail' | 'error';

interface CaseResult {
  id: string;
  clause: string;
  polarity: string;
  kind: string;
  status: CaseStatus;
  detail?: string;
}

// ── small helpers ────────────────────────────────────────────────────

function die(message: string): never {
  process.stderr.write(`conformance-runner: ${message}\n`);
  process.exit(2);
}

function readJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch (e) {
    die(`cannot read ${path}: ${(e as Error).message}`);
  }
}

// ── structural validation ────────────────────────────────────────────

function validateSuite(corpusDir: string, clauses: Clause[], cases: SuiteCase[]): void {
  const problems: string[] = [];
  const clauseIds = new Set(clauses.map(c => c.id));
  const caseIds = new Set<string>();
  for (const c of cases) {
    if (caseIds.has(c.id)) {
      problems.push(`duplicate case id ${c.id}`);
    }
    caseIds.add(c.id);
    if (!clauseIds.has(c.clause)) {
      problems.push(`case ${c.id}: unknown clause ${c.clause}`);
    }
    if (!existsSync(join(corpusDir, c.path))) {
      problems.push(`case ${c.id}: missing corpus path ${c.path}`);
    }
    for (const [id, dir] of Object.entries(c.with ?? {})) {
      if (!existsSync(join(corpusDir, dir))) {
        problems.push(`case ${c.id}: missing --with target ${id} at ${dir}`);
      }
    }
    const e = c.expect;
    if (c.kind === 'parse') {
      if (e.parse === undefined) {
        problems.push(`case ${c.id}: parse case without expect.parse`);
      }
      if (e.parse === 'error' && !e.errorMatch) {
        problems.push(`case ${c.id}: a parse rejection must name errorMatch`);
      }
    } else if (c.kind === 'roundtrip') {
      if (e.roundtrip === undefined) {
        problems.push(`case ${c.id}: roundtrip case without expect.roundtrip`);
      }
      if (e.roundtrip === 'error' && !e.errorMatch) {
        problems.push(`case ${c.id}: a roundtrip rejection must name errorMatch`);
      }
    } else if (c.kind === 'check') {
      const forms = [e.clean === true, e.rules !== undefined, e.error !== undefined].filter(Boolean).length;
      if (forms !== 1) {
        problems.push(`case ${c.id}: a check case names exactly one of clean, rules, error`);
      }
    } else {
      problems.push(`case ${c.id}: unknown kind ${c.kind}`);
    }
  }
  for (const clause of clauses) {
    const mine = cases.filter(c => c.clause === clause.id);
    const pos = mine.filter(c => c.polarity === 'positive').length;
    const neg = mine.filter(c => c.polarity === 'negative').length;
    if (pos === 0 || neg === 0) {
      problems.push(
        `clause ${clause.id}: every clause needs at least one positive and one negative case (has ${pos} positive, ${neg} negative)`,
      );
    }
  }
  if (problems.length > 0) {
    die(`the suite is structurally broken:\n  ${problems.join('\n  ')}`);
  }
}

// ── running one case ─────────────────────────────────────────────────

function runAdapter(
  adapter: string[],
  corpusDir: string,
  c: SuiteCase,
): { result?: AdapterResult; malfunction?: string } {
  const argv = [...adapter, c.kind];
  if (c.kind === 'parse' && c.options?.strict) {
    argv.push('--strict');
  }
  argv.push(join(corpusDir, c.path));
  if (c.kind === 'check') {
    for (const id of Object.keys(c.with ?? {}).sort()) {
      argv.push('--with', `${id}=${join(corpusDir, c.with![id])}`);
    }
  }
  const proc = spawnSync(argv[0], argv.slice(1), {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (proc.error) {
    return { malfunction: `cannot spawn the adapter: ${proc.error.message}` };
  }
  if (proc.status !== 0) {
    return {
      malfunction: `adapter exited ${proc.status}: ${(proc.stderr ?? '').trim().slice(0, 300)}`,
    };
  }
  try {
    return { result: JSON.parse(proc.stdout.trim()) as AdapterResult };
  } catch {
    return { malfunction: `adapter output is not JSON: ${proc.stdout.trim().slice(0, 300)}` };
  }
}

function judge(corpusDir: string, c: SuiteCase, r: AdapterResult): CaseResult {
  const base = { id: c.id, clause: c.clause, polarity: c.polarity, kind: c.kind };
  const e = c.expect;
  const fail = (detail: string): CaseResult => ({ ...base, status: 'fail', detail });

  if (c.kind === 'parse') {
    if (e.parse === 'ok') {
      if (!r.ok) {
        return fail(`expected a clean parse, got: ${r.error ?? 'no error message'}`);
      }
      if (e.issues !== undefined) {
        const actual = (r.issues ?? []).map(i => i.code ?? 'unknown').sort();
        const expected = [...e.issues].sort();
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          return fail(`expected issues ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
      }
      return { ...base, status: 'pass' };
    }
    // parse === 'error'
    if (r.ok) {
      return fail('expected a parse rejection, the document parsed');
    }
    if (!r.error || !r.error.includes(e.errorMatch!)) {
      return fail(`error message does not contain "${e.errorMatch}": ${r.error ?? '(empty)'}`);
    }
    return { ...base, status: 'pass' };
  }

  if (c.kind === 'roundtrip') {
    if (e.roundtrip === 'error') {
      if (r.ok) {
        return fail('expected a rejection, the document round-tripped');
      }
      if (!r.error || !r.error.includes(e.errorMatch!)) {
        return fail(`error message does not contain "${e.errorMatch}": ${r.error ?? '(empty)'}`);
      }
      return { ...base, status: 'pass' };
    }
    if (!r.ok) {
      return fail(`expected a clean round trip, got: ${r.error ?? 'no error message'}`);
    }
    if (r.stable !== true) {
      return fail('the serialization is not a fixed point');
    }
    const input = readFileSync(join(corpusDir, c.path), 'utf8');
    if (e.outputEqualsInput && r.output !== input) {
      return fail('a canonical document did not serialize to itself byte-for-byte');
    }
    if (e.outputDiffersFromInput && r.output === input) {
      return fail('a non-canonical document was echoed verbatim (no canonicalization)');
    }
    return { ...base, status: 'pass' };
  }

  // check
  if (e.error !== undefined) {
    if (r.ok) {
      return fail('expected the evaluation to fail, it completed');
    }
    if (!r.error || !r.error.includes(e.error)) {
      return fail(`error message does not contain "${e.error}": ${r.error ?? '(empty)'}`);
    }
    return { ...base, status: 'pass' };
  }
  if (!r.ok) {
    return fail(`expected a completed evaluation, got: ${r.error ?? 'no error message'}`);
  }
  const errorRules = (r.issues ?? [])
    .filter(i => i.severity === 'error')
    .map(i => i.rule ?? 'unknown')
    .sort();
  if (e.clean === true) {
    if (errorRules.length > 0) {
      return fail(`expected a clean package, got error rules ${errorRules.join(', ')}`);
    }
    return { ...base, status: 'pass' };
  }
  const expected = [...(e.rules ?? [])].sort();
  if (JSON.stringify(errorRules) !== JSON.stringify(expected)) {
    return fail(`expected error rules ${JSON.stringify(expected)}, got ${JSON.stringify(errorRules)}`);
  }
  return { ...base, status: 'pass' };
}

// ── the report ───────────────────────────────────────────────────────

function report(
  suite: SuiteManifest,
  adapterCmd: string,
  clauses: Clause[],
  results: CaseResult[],
): { text: string; json: unknown } {
  const byClause = clauses.map(clause => {
    const mine = results.filter(r => r.clause === clause.id);
    const tally = (polarity: string) => {
      const of = mine.filter(r => r.polarity === polarity);
      return { total: of.length, passed: of.filter(r => r.status === 'pass').length };
    };
    const pos = tally('positive');
    const neg = tally('negative');
    return {
      id: clause.id,
      area: clause.area,
      title: clause.title,
      rules: clause.rules,
      positive: pos,
      negative: neg,
      conformant: mine.every(r => r.status === 'pass'),
    };
  });
  const failed = results.filter(r => r.status !== 'pass');
  const lines: string[] = [];
  lines.push(
    `The Primmel conformance suite v${suite.version} (${suite.date})`,
  );
  lines.push(`implementation under test: ${adapterCmd}`);
  lines.push('');
  for (const c of byClause) {
    const mark = c.conformant ? 'CONFORMS' : 'FAILS   ';
    lines.push(
      `${mark} ${c.id} ${c.title}  ` +
        `(positive ${c.positive.passed}/${c.positive.total}, negative ${c.negative.passed}/${c.negative.total})`,
    );
  }
  lines.push('');
  if (failed.length === 0) {
    lines.push(
      `${results.length} cases, ${byClause.length} clauses: every case passed.`,
    );
  } else {
    lines.push(`${failed.length} of ${results.length} cases did not pass:`);
    for (const f of failed) {
      lines.push(`  ${f.status.toUpperCase()} ${f.id} (${f.clause}): ${f.detail ?? ''}`);
    }
  }
  const json = {
    suite: { name: suite.name, version: suite.version, date: suite.date },
    adapter: adapterCmd,
    summary: {
      cases: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      errors: results.filter(r => r.status === 'error').length,
      clauses: byClause.length,
      clausesConformant: byClause.filter(c => c.conformant).length,
    },
    clauses: byClause,
    cases: results,
  };
  return { text: lines.join('\n'), json };
}

// ── main ─────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  let adapterCmd = '';
  let corpusDir = join(SUITE_DIR, 'corpus');
  let reportFile: string | undefined;
  const only = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--adapter') {
      adapterCmd = args[++i] ?? '';
    } else if (a === '--corpus') {
      corpusDir = resolve(args[++i] ?? '');
    } else if (a === '--report') {
      reportFile = args[++i];
    } else if (a === '--case') {
      only.add(args[++i] ?? '');
    } else {
      die(`unknown argument: ${a}`);
    }
  }
  if (!adapterCmd) {
    die(
      'usage: run.mts --adapter \'<command>\' [--corpus <dir>] [--report <file.json>] [--case <id>]...',
    );
  }
  const adapter = adapterCmd.split(/\s+/).filter(Boolean);
  const suiteDir = isAbsolute(corpusDir) ? dirname(corpusDir) : SUITE_DIR;
  const suite = readJson<SuiteManifest>(join(suiteDir, 'suite.json'));
  const clauses = readJson<{ clauses: Clause[] }>(
    join(suiteDir, 'clauses.json'),
  ).clauses;
  const cases = readJson<{ cases: SuiteCase[] }>(
    join(corpusDir, 'cases.json'),
  ).cases;
  validateSuite(corpusDir, clauses, cases);
  const selected = only.size > 0 ? cases.filter(c => only.has(c.id)) : cases;
  if (only.size > 0 && selected.length === 0) {
    die(`no case matches: ${[...only].join(', ')}`);
  }

  const results: CaseResult[] = [];
  for (const c of selected) {
    const { result, malfunction } = runAdapter(adapter, corpusDir, c);
    if (malfunction) {
      results.push({
        id: c.id,
        clause: c.clause,
        polarity: c.polarity,
        kind: c.kind,
        status: 'error',
        detail: malfunction,
      });
    } else {
      results.push(judge(corpusDir, c, result!));
    }
  }

  const { text, json } = report(suite, adapterCmd, clauses, results);
  process.stdout.write(text + '\n');
  if (reportFile) {
    writeFileSync(reportFile, JSON.stringify(json, null, 2) + '\n');
    process.stdout.write(`report written to ${reportFile}\n`);
  }
  process.exit(results.every(r => r.status === 'pass') ? 0 : 1);
}

main();
