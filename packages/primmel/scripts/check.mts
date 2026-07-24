#!/usr/bin/env node
// primmel — the package toolchain CLI.
//
//   primmel check [--strict] [--audit] [--coverage] [--rules] [--with <pkg-id>=<dir>]… <package-dir>
//   primmel diff  [--json] [--exit-code] [--compare-texts] [--with <pkg-id>=<dir>]… <a> <b>
//
// (The `check` token is optional for back-compatibility: `primmel
// [--strict]… <package-dir>` runs check as before.)
//
// ── check ──
// The one linter for Recommendation packages (TODO.roadmap/17). Levels:
//   default   — the normal-level rules at their catalog severities
//               (errors fail; warnings print);
//   --strict  — every warning promotes to an error, EXCEPT KNOWN
//               (allowlisted) issues and budget-covered C51/C52/C71
//               coverage warnings (the package's budgets are their
//               allowance);
//   --audit   — additionally runs the audit-level rules (C25
//               mapping-description, C51 coverage-test-evidence,
//               C52 coverage-form-judgment, C71
//               text-coverage-sentence-uncovered) and enforces the
//               per-package coverage budgets (C55, C72).
// --coverage  — prints the normative-text coverage report after the
//               lint (TODO.roadmap/26): per-document covered/uncovered
//               normative sentences with and without allowances, the
//               allowed exclusions, and the duplicate-pair adjudication
//               status. Silent for packages without sources-prd payloads.
// --with (repeatable) maps a package id to a directory, providing the
// resolvePackage locator that makes the composition rules C27–C31
// reachable from the CLI; without it those rules stay silent and a
// manifest-only resolution lint (no content composed) runs instead.
// --rules prints the full rule catalog (check-rules.ts) and exits.
//
// The package allowlist (<package-dir>/.primmel-allowlist.prl) marks
// known debt KNOWN (suppressed, never an error) and STALE (an entry
// that matches nothing — an error; the data was fixed, the entry must
// die). Exit code 1 when any error-severity issue survives.
//
// ── diff (TODO.roadmap/28, doctrine ch. 13) ──
// The structural model diff between two package states — id-keyed,
// tier-annotated, classified (added/removed/changed/moved), with the
// mapping diff (pairs + computed coverage delta) and the clause-drift
// table. One computation, three consumers (§13.3): edition comparison
// (a = old edition dir, b = new edition dir), change audit (working
// tree vs baseline — any two directories), clause-drift detection.
//   --json          — machine-readable report (review-flow wiring);
//   --exit-code     — exit 1 when the diff is non-empty (the CI gate
//                     form of the change audit; default exits 0 — a
//                     diff is a report, not a failure);
//   --compare-texts — additionally read sources-prd sentence payloads
//                     and classify renumbered clauses same-text /
//                     differed (the rewording detector);
//   --with          — as for check: the uses-composition locator.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkPackage } from '../src/check.ts';
import { CHECK_RULES } from '../src/check-rules.ts';
import { loadPackageWithIssues } from '../src/ser-des/package.ts';
import {
  formatTextCoverageReport,
  packageTextCoverageReport,
} from '../src/text-coverage.ts';
import { diffPackageDirs } from '../src/package-diff.ts';
import { formatDiffReport } from '../src/model-diff.ts';
import type { ResolvePackage } from '../src/ser-des/package.ts';

const CHECK_USAGE =
  'Usage: primmel check [--strict] [--audit] [--coverage] [--rules] [--with <pkg-id>=<dir>]… <package-dir>';
const DIFF_USAGE =
  'Usage: primmel diff [--json] [--exit-code] [--compare-texts] [--with <pkg-id>=<dir>]… <a> <b>';

// An unreadable/missing package directory — a positional argument or a
// --with locator target — must not crash with a stack trace: print a
// clean diagnostic and exit 2 (a usage-class failure, not lint findings).
function readablePackageDirProblem(
  target: string,
  needsManifest: boolean,
): string | null {
  try {
    if (!statSync(target).isDirectory()) {
      return 'not a directory';
    }
    readdirSync(target); // readability probe — EACCES surfaces here
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    return err.code === 'ENOENT' ? 'no such directory' : err.message;
  }
  // A locator target is read through readPackageManifest() when the
  // composition runs — a missing manifest would throw deep in the loader.
  if (needsManifest && !existsSync(join(target, 'package.primmel'))) {
    return 'no package.primmel found';
  }
  return null;
}

/** Shared flag/positional/--with parsing for both subcommands. */
function parseArgs(
  args: string[],
  flags: string[],
  usage: string,
): { flags: Set<string>; locator: Map<string, string>; positional: string[] } {
  const seen = new Set<string>();
  const locator = new Map<string, string>();
  const positional: string[] = [];
  const addLocator = (spec: string | undefined): void => {
    const eq = spec?.indexOf('=') ?? -1;
    if (!spec || eq <= 0) {
      console.error(usage);
      process.exit(2);
    }
    locator.set(spec!.slice(0, eq), spec!.slice(eq + 1));
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (flags.includes(a)) {
      seen.add(a);
      continue;
    }
    if (a === '--with') {
      addLocator(args[++i]);
      continue;
    }
    if (a.startsWith('--with=')) {
      addLocator(a.slice('--with='.length));
      continue;
    }
    if (a.startsWith('--')) {
      console.error(`unknown flag: ${a}`);
      console.error(usage);
      process.exit(2);
    }
    positional.push(a);
  }
  return { flags: seen, locator, positional };
}

function checkCli(args: string[]): void {
  const { flags, locator, positional } = parseArgs(
    args,
    ['--strict', '--audit', '--coverage', '--rules'],
    CHECK_USAGE,
  );
  const strict = flags.has('--strict');
  const audit = flags.has('--audit');
  const coverage = flags.has('--coverage');

  if (flags.has('--rules')) {
    const fam = (f: string) => f.padEnd(15);
    console.log('primmel check — rule catalog (TODO.roadmap/17)\n');
    console.log('id   family          level   severity  name (docs)');
    for (const r of CHECK_RULES) {
      console.log(
        `${r.id.padEnd(4)} ${fam(r.family)} ${r.level.padEnd(7)} ${r.severity.padEnd(9)} ${r.name} (${r.docs})`,
      );
    }
    console.log(
      `\n${CHECK_RULES.length} rules. Default level runs the normal rules; ` +
        '--audit adds the audit rules + the coverage budgets (C55/C72); --strict ' +
        'promotes warnings to errors (KNOWN/budgeted issues excepted).',
    );
    process.exit(0);
  }

  const dir = positional[0];
  if (!dir) {
    console.error(CHECK_USAGE);
    process.exit(2);
  }

  {
    const problem = readablePackageDirProblem(dir, false);
    if (problem !== null) {
      console.error(`cannot read package at ${dir}: ${problem}`);
      process.exit(2);
    }
    for (const target of locator.values()) {
      const targetProblem = readablePackageDirProblem(target, true);
      if (targetProblem !== null) {
        console.error(`cannot read package at ${target}: ${targetProblem}`);
        process.exit(2);
      }
    }
  }

  const issues = checkPackage(dir, {
    strictness: audit ? 'audit' : 'normal',
    strict,
    ...(locator.size > 0
      ? { resolvePackage: (id: string) => locator.get(id) }
      : {}),
  });
  const counted = issues.filter(i => !i.known);
  const errors = counted.filter(i => i.severity === 'error');
  const warnings = counted.filter(i => i.severity === 'warning');
  const knowns = issues.filter(i => i.known);

  for (const i of issues) {
    const mark = i.known ? 'ℹ' : i.severity === 'error' ? '✗' : '⚠';
    const tag = i.known ? ' KNOWN ' : '';
    console.log(`${mark} [${i.check}]${tag} ${i.message}`);
  }
  console.log(
    `\n${errors.length} errors, ${warnings.length} warnings` +
      (knowns.length > 0 ? `, ${knowns.length} known` : ''),
  );

  if (coverage) {
    // The normative-text coverage report (TODO.roadmap/26) — silent when
    // the package ships no sources-prd payloads.
    const report = packageTextCoverageReport(dir, d => loadPackageWithIssues(d));
    if (report === null) {
      console.log('\n(no sources-prd payloads — the text-coverage metric is silent)');
    } else {
      console.log(`\n${formatTextCoverageReport(report)}`);
    }
  }
  process.exit(errors.length > 0 ? 1 : 0);
}

function diffCli(args: string[]): void {
  const { flags, locator, positional } = parseArgs(
    args,
    ['--json', '--exit-code', '--compare-texts'],
    DIFF_USAGE,
  );
  const [dirA, dirB] = positional;
  if (!dirA || !dirB || positional.length !== 2) {
    console.error(DIFF_USAGE);
    process.exit(2);
  }
  for (const target of [dirA, dirB, ...locator.values()]) {
    const problem = readablePackageDirProblem(target, target !== dirA && target !== dirB);
    if (problem !== null) {
      console.error(`cannot read package at ${target}: ${problem}`);
      process.exit(2);
    }
  }
  const resolvePackage: ResolvePackage | undefined =
    locator.size > 0 ? (id: string) => locator.get(id) : undefined;
  const { diff } = diffPackageDirs(dirA, dirB, {
    ...(resolvePackage ? { resolvePackage } : {}),
    compareTexts: flags.has('--compare-texts'),
  });
  if (flags.has('--json')) {
    console.log(JSON.stringify(diff, null, 2));
  } else {
    console.log(formatDiffReport(diff));
  }
  // --exit-code: the change-audit gate form — a non-empty diff exits 1.
  process.exit(flags.has('--exit-code') && !diff.empty ? 1 : 0);
}

const args = process.argv.slice(2);
if (args[0] === 'diff') {
  diffCli(args.slice(1));
} else if (args[0] === 'check') {
  checkCli(args.slice(1));
} else {
  checkCli(args); // back-compat: `primmel [flags] <dir>`
}
