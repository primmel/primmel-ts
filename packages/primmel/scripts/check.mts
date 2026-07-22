#!/usr/bin/env node
// primmel check [--strict] [--audit] [--rules] [--with <pkg-id>=<dir>]… <package-dir>
//
// The one linter for Recommendation packages (TODO.roadmap/17). Levels:
//   default   — the normal-level rules at their catalog severities
//               (errors fail; warnings print);
//   --strict  — every warning promotes to an error, EXCEPT KNOWN
//               (allowlisted) issues and budget-covered C51/C52
//               coverage warnings (the package's coverage_budget is
//               their allowance);
//   --audit   — additionally runs the audit-level rules (C25
//               mapping-description, C51 coverage-test-evidence,
//               C52 coverage-form-judgment) and enforces the per-package
//               coverage budget (C55).
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
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkPackage } from '../src/check.ts';
import { CHECK_RULES } from '../src/check-rules.ts';

const USAGE =
  'Usage: primmel check [--strict] [--audit] [--rules] [--with <pkg-id>=<dir>]… <package-dir>';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const audit = args.includes('--audit');
const printRules = args.includes('--rules');
const locator = new Map<string, string>();
const positional: string[] = [];

function addLocator(spec: string | undefined): void {
  const eq = spec?.indexOf('=') ?? -1;
  if (!spec || eq <= 0) {
    console.error(USAGE);
    process.exit(2);
  }
  locator.set(spec!.slice(0, eq), spec!.slice(eq + 1));
}

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--strict' || a === '--audit') {
    continue;
  }
  if (a === '--rules') {
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
    console.error(USAGE);
    process.exit(2);
  }
  positional.push(a);
}

if (printRules) {
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
      '--audit adds the audit rules + the coverage budget; --strict ' +
      'promotes warnings to errors (KNOWN/budgeted issues excepted).',
  );
  process.exit(0);
}

const dir = positional[0];
if (!dir) {
  console.error(USAGE);
  process.exit(2);
}

// An unreadable/missing package directory — the positional argument or a
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
process.exit(errors.length > 0 ? 1 : 0);
