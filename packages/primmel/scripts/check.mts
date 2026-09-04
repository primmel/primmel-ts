#!/usr/bin/env node
// primmel — the package toolchain CLI.
//
//   primmel check [--strict] [--audit] [--coverage] [--rules] [--with <pkg-id>=<dir>]… <package-dir>
//   primmel diff  [--json] [--exit-code] [--compare-texts] [--with <pkg-id>=<dir>]… <a> <b>
//   primmel export reqif <package-dir> [--out <file>]
//   primmel export rdf <package-dir> [--out <file>] [--format turtle|jsonld]
//   primmel export retrieval <package-dir> [--out <file>]
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
//
// ── export (TODO.roadmap/27, interop projections) ──
// `primmel export reqif <package-dir> [--out <file>]` projects the
// package's requirements into ReqIF XML (DIN DKE SPEC 99200 profile
// where compatible — src/export/reqif.ts carries the profile mapping,
// the deviations, and the survive/lost doctrine, which is also shipped
// in the document's own header note): document/heading/provision
// spec-objects, modality shall→requirement / should→recommendation /
// may→permission, cross-references from dependencies, conformance-test
// targets, and bindings naming exported ids. ONE-WAY projection — the
// package stays the truth; re-imports are suggestions, never merges.
// Default output is stdout; --out writes the document to a file.
//
// `primmel export rdf <package-dir> [--out <file>] [--format
// turtle|jsonld]` projects the package into an RDF graph in the IEC-ISO
// Core Ontology vocabulary (the smartSDU share's core-ontology.ttl —
// src/export/rdf-vocabulary.ts pins every IRI with citations;
// src/export/rdf.ts carries the mapping, the primmel: extension
// namespace, and the survive/lost doctrine, also shipped as the leading
// Turtle comment): the package as smart:PublicationDocument, classes as
// the smart:Clause tree, requirements as Provision subclasses BY
// MODALITY (shall→smart:Requirement, should→smart:Recommendation,
// may→smart:Permission), conformance tests as primmel:ConformanceTest,
// terms as smart:TermEntry + skosxl labels, guidance as
// ProvisionSupplement notes, provenance as dcterms:source IRIs. Turtle
// is canonical (default); --format jsonld renders the same graph. The
// projection's SHACL shapes (src/export/rdf-shapes.ts) and SPARQL
// competency questions (src/export/rdf-competency-questions.ts) are
// executed in the tests. Same one-way doctrine.
//
// `primmel export retrieval <package-dir> [--out <file>]` projects the
// package into the canonical retrieval document (primmel-ts#65 —
// src/export/retrieval.ts carries the contract): the typed units
// (requirement / conformance_test / term / attribute / behavior /
// calculation / formula / symbol / constraint / characteristic / table /
// sequence / note / state_machine / dimension) with package-authored
// stable ids, document-numbered clause provenance (a producer-internal
// anchor rides as an optional extra, never as the clause), the distinct
// edition / model_version document fields, a per-unit sha256 content
// digest + machine passport, and the package-byte source_hash the
// deployed consumer's pins key on. JSON, byte-deterministic; default
// stdout, --out writes the document to a file.
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkPackage } from '../src/check.ts';
import { CHECK_RULES } from '../src/check-rules.ts';
import { loadPackageWithIssues } from '../src/ser-des/package.ts';
import { exportPackageReqif, type ReqifExport } from '../src/export/reqif.ts';
import { exportPackageRdf, type RdfExport } from '../src/export/rdf.ts';
import {
  exportPackageRetrieval,
  type RetrievalExport,
} from '../src/export/retrieval.ts';
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
const EXPORT_USAGE =
  'Usage: primmel export reqif|rdf|retrieval <package-dir> [--out <file>] [--format turtle|jsonld]';

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
  valueFlags: string[] = [],
): {
  flags: Set<string>;
  locator: Map<string, string>;
  values: Map<string, string>;
  positional: string[];
} {
  const seen = new Set<string>();
  const locator = new Map<string, string>();
  const values = new Map<string, string>();
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
    if (valueFlags.includes(a)) {
      const v = args[++i];
      if (v === undefined) {
        console.error(usage);
        process.exit(2);
      }
      values.set(a, v);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq > 2 && valueFlags.includes(a.slice(0, eq))) {
      values.set(a.slice(0, eq), a.slice(eq + 1));
      continue;
    }
    if (a.startsWith('--')) {
      console.error(`unknown flag: ${a}`);
      console.error(usage);
      process.exit(2);
    }
    positional.push(a);
  }
  return { flags: seen, locator, values, positional };
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

function exportCli(args: string[]): void {
  const surface = args[0];
  if (surface !== 'reqif' && surface !== 'rdf' && surface !== 'retrieval') {
    console.error(EXPORT_USAGE);
    process.exit(2);
  }
  const { values, positional } = parseArgs(
    args.slice(1),
    [],
    EXPORT_USAGE,
    ['--out', '--format'],
  );
  const dir = positional[0];
  if (!dir || positional.length !== 1) {
    console.error(EXPORT_USAGE);
    process.exit(2);
  }
  // --format is the rdf surface's knob; turtle is canonical (default).
  const rdfFormat = values.get('--format') ?? 'turtle';
  if (surface !== 'rdf' && values.has('--format')) {
    console.error('--format applies to `primmel export rdf` only');
    console.error(EXPORT_USAGE);
    process.exit(2);
  }
  if (surface === 'rdf' && rdfFormat !== 'turtle' && rdfFormat !== 'jsonld') {
    console.error(`unknown format: ${values.get('--format')}`);
    console.error(EXPORT_USAGE);
    process.exit(2);
  }
  const problem = readablePackageDirProblem(dir, true);
  if (problem !== null) {
    console.error(`cannot read package at ${dir}: ${problem}`);
    process.exit(2);
  }
  const n = (count: number, singular: string, plural: string): string =>
    `${count} ${count === 1 ? singular : plural}`;
  let document: string;
  let summary: string;
  try {
    if (surface === 'retrieval') {
      const result: RetrievalExport = exportPackageRetrieval(dir);
      document = result.json;
      const s = result.stats;
      summary =
        `${n(s.units, 'unit', 'units')} ` +
        `(${Object.entries(s.byKind)
          .map(([k, c]) => `${c} ${k}`)
          .join(', ')}), ` +
        `${n(s.withClause, 'unit', 'units')} clause-cited` +
        (s.anchorOnlyProvenance > 0
          ? `, ${n(s.anchorOnlyProvenance, 'unit', 'units')} with anchor-only provenance (ask-1 debt)`
          : '') +
        (s.nonUrnDocRefs > 0
          ? `, ${n(s.nonUrnDocRefs, 'unit', 'units')} with legacy non-URN doc refs`
          : '') +
        (s.withoutProvenance > 0
          ? `, ${n(s.withoutProvenance, 'unit', 'units')} without provenance`
          : '') +
        (s.withVariants > 0
          ? `, ${n(s.withVariants, 'unit', 'units')} with language variants`
          : '') +
        (s.droppedTextBlocks > 0
          ? `, ${n(s.droppedTextBlocks, 'text block', 'text blocks')} addressed at unprojected elements (dropped)`
          : '');
    } else if (surface === 'reqif') {
      const result: ReqifExport = exportPackageReqif(dir);
      document = result.xml;
      const s = result.stats;
      summary =
        `${n(s.requirements, 'requirement', 'requirements')}, ` +
        `${n(s.requirementClasses, 'requirement class', 'requirement classes')}, ` +
        `${n(s.conformanceTests, 'conformance test', 'conformance tests')}, ` +
        `${n(s.specRelations, 'spec-relation', 'spec-relations')}` +
        (s.droppedReferences.length > 0
          ? `, ${n(s.droppedReferences.length, 'dropped reference', 'dropped references')}`
          : '') +
        (s.unknownObligations > 0
          ? `, ${n(s.unknownObligations, 'unknown obligation (modality undefined)', 'unknown obligations (modality undefined)')}`
          : '');
    } else {
      const result: RdfExport = exportPackageRdf(dir);
      document = rdfFormat === 'jsonld' ? result.jsonld : result.turtle;
      const s = result.stats;
      summary =
        `${n(s.requirements, 'requirement', 'requirements')}, ` +
        `${n(s.requirementClasses, 'requirement class', 'requirement classes')}, ` +
        `${n(s.conformanceTests, 'conformance test', 'conformance tests')}, ` +
        `${n(s.terms, 'term', 'terms')}, ` +
        `${n(s.triples, 'triple', 'triples')}` +
        (s.droppedReferences.length > 0
          ? `, ${n(s.droppedReferences.length, 'dropped reference', 'dropped references')}`
          : '') +
        (s.unknownObligations > 0
          ? `, ${n(s.unknownObligations, 'unknown obligation (typed bare smart:Provision)', 'unknown obligations (typed bare smart:Provision)')}`
          : '');
    }
  } catch (e) {
    // A load/parse failure is a content failure (exit 1), not a usage
    // error — print the loader's message, never a stack trace.
    console.error(`cannot export package at ${dir}: ${(e as Error).message}`);
    process.exit(1);
  }
  const out = values.get('--out');
  if (out !== undefined) {
    try {
      writeFileSync(out, document);
    } catch (e) {
      // An unwritable target is a content failure (exit 1), not a
      // usage error — clean one-line diagnostic, never a stack trace.
      console.error(`cannot write ${out}: ${(e as Error).message}`);
      process.exit(1);
    }
    console.log(`wrote ${out} — ${summary}`);
  } else {
    console.log(document);
  }
  process.exit(0);
}

const args = process.argv.slice(2);
if (args[0] === 'diff') {
  diffCli(args.slice(1));
} else if (args[0] === 'check') {
  checkCli(args.slice(1));
} else if (args[0] === 'export') {
  exportCli(args.slice(1));
} else {
  checkCli(args); // back-compat: `primmel [flags] <dir>`
}
