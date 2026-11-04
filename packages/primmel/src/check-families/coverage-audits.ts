// ─────────────────────────────────────────────────────────────────────
// The coverage-audits family (C51–C54 + C71–C73; TODO.roadmap/17 §11.5,
// TODO.roadmap/26 §11.6): the aspect↔requirement↔test↔form↔verdict
// closure and the normative-text coverage metric — layer 5 of the
// validation stack. C5 holds the requirement→test link; C51/C52 hold
// the test→form→verdict links at audit strictness (the unified
// adjudication ledger: a test whose evidence exclusion is adjudicated
// in coverage.json is recorded, never a gap); C53/C54 anchor the
// requirement's inputs (uses bound, lookup tables) at the normal
// level. The sentence decomposition ships inside the package
// (sources-prd/*.sentences.json + coverage.json); without them the
// metric is silent — C73 (config hygiene, the ledger's staleness leg)
// runs at every level, C71 (uncovered normative sentences) is
// audit-level and budgeted by the package's text_coverage_budget (C72,
// applied with the allowlist below). Duplicate pairs are REPORTED by
// `primmel check --coverage`, never auto-failed here.
//
// THE FAMILY-MODULE PATTERN (the check.ts decomposition, one family
// at a time): the family takes the context record it actually uses —
// dir (the coverage payloads), `standard`, the strictness, the
// precomputed id sets, the two emit closures, and the raw issue push
// for the loader's own findings — and nothing else. The bodies move
// verbatim from check.ts; the compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import {
  computeTextCoverage,
  loadTextCoverageData,
  uncoveredSentenceMessage,
} from '../text-coverage';
import type { CheckIssue } from '../check';
import type ConformanceTest from '../types/ConformanceTest';
import type { FormField } from '../types/Form';
import type Standard from '../types/Standard';

export interface CoverageAuditsContext {
  dir: string;
  standard: Standard;
  strictness: 'normal' | 'audit';
  symbolIds: Set<string>;
  attrIds: Set<string>;
  reqIds: Set<string>;
  dimIds: Map<string, Set<string> | null>;
  behaviorIds: Set<string>;
  err: (check: string, message: string) => void;
  warn: (check: string, message: string) => void;
  pushIssues: (issues: CheckIssue[]) => void;
}

export function runCoverageAuditsFamily({
  dir,
  standard,
  strictness,
  symbolIds,
  attrIds,
  reqIds,
  dimIds,
  behaviorIds,
  err,
  warn,
  pushIssues,
}: CoverageAuditsContext): void {
  // ── C51–C54: the coverage audits (TODO.roadmap/17, concept doc ──
  // §11.5). The aspect↔requirement↔test↔form↔verdict closure: C5 holds
  // the requirement→test link; C51/C52 hold the test→form→verdict links
  // at audit strictness; C53/C54 anchor the requirement's inputs
  // (uses bound, lookup tables) at the normal level.

  // C53 — coverage-uses-bound: every requirement limit.uses input is
  // bound. Unprefixed entries resolve against the package's quantitative
  // vocabulary (attributes, symbols, requirements, classification
  // dimensions, behaviors — bare ids or full paths, compared on the
  // leaf); `observable:`/`formula:` prefixes resolve against the symbol
  // and calculation registries. `load` is the declared per-load-point
  // free variable of the MPE lookups (deep-audit-r60 F6 — indeterminate
  // at verdict time by design). table:/profile: prefixes are C54's.
  // (Moves C2's former warning leg here and hardens it to an error: a
  // use input that binds nothing computes nothing.)
  const calcNames = new Set<string>();
  for (const c of standard.calculations ?? []) {
    if (c.id) {
      calcNames.add(c.id);
    }
    if (c.name) {
      calcNames.add(c.name);
    }
  }
  for (const r of standard.requirements ?? []) {
    for (const u of r.limit?.uses ?? []) {
      if (/^(table|profile):/.test(u)) {
        continue; // C54's lookup-table leg
      }
      if (u.startsWith('observable:')) {
        const id = u.slice('observable:'.length);
        if (!symbolIds.has(id)) {
          err(
            'C53',
            `requirement ${r.id}: limit.uses "${u}" — observable "${id}" is not a declared symbol (coverage-uses-bound)`,
          );
        }
        continue;
      }
      if (u.startsWith('formula:')) {
        const id = u.slice('formula:'.length);
        if (!calcNames.has(id)) {
          err(
            'C53',
            `requirement ${r.id}: limit.uses "${u}" — formula "${id}" is not a declared calculation (coverage-uses-bound)`,
          );
        }
        continue;
      }
      // `uses` may carry bare ids or full paths — compare the last segment.
      const leaf = u.split('.').pop() ?? u;
      if (
        !attrIds.has(leaf) &&
        !attrIds.has(u) &&
        !symbolIds.has(leaf) &&
        !symbolIds.has(u) &&
        !reqIds.has(u) &&
        !dimIds.has(leaf) &&
        !behaviorIds.has(leaf) &&
        u !== 'load'
      ) {
        err(
          'C53',
          `requirement ${r.id}: limit.uses "${u}" binds nothing — it is not a declared attribute, symbol, requirement, dimension, or behavior (coverage-uses-bound)`,
        );
      }
    }
  }

  // C54 — coverage-lookup-table-exists: lookup tables exist. The
  // table:/profile: uses prefixes and the calculations' lookup profiles
  // (lookupMPE/lookupProfile targets) resolve to declared tables and
  // their profile definitions — a dangling lookup breaks evaluation at
  // runtime. A profile reference resolves as a declared table id, as
  // `<table>.<name>` with <name> in the table's profileDefs, or as a
  // bare <name> in the `profiles` table's profileDefs.
  const tablesById = new Map((standard.tables ?? []).map(t => [t.id, t]));
  const profileRefResolves = (ref: string): boolean => {
    if (tablesById.has(ref)) {
      return true;
    }
    const dot = ref.indexOf('.');
    if (dot > 0) {
      const tbl = tablesById.get(ref.slice(0, dot));
      const name = ref.slice(dot + 1);
      if (tbl && (tbl.profileDefs ?? []).some(p => p.name === name)) {
        return true;
      }
    }
    const profiles = tablesById.get('profiles');
    return (
      profiles !== undefined &&
      (profiles.profileDefs ?? []).some(p => p.name === ref)
    );
  };
  for (const r of standard.requirements ?? []) {
    for (const u of r.limit?.uses ?? []) {
      if (u.startsWith('table:')) {
        const id = u.slice('table:'.length);
        if (!tablesById.has(id)) {
          err(
            'C54',
            `requirement ${r.id}: limit.uses "${u}" — table "${id}" is not declared (coverage-lookup-table-exists)`,
          );
        }
      } else if (u.startsWith('profile:')) {
        const ref = u.slice('profile:'.length);
        if (!profileRefResolves(ref)) {
          err(
            'C54',
            `requirement ${r.id}: limit.uses "${u}" — profile "${ref}" is not a declared table or profile definition (coverage-lookup-table-exists)`,
          );
        }
      }
    }
  }
  for (const c of standard.calculations ?? []) {
    if (c.profile && !profileRefResolves(c.profile)) {
      err(
        'C54',
        `calculation ${c.name || c.id}: lookup profile "${c.profile}" is not a declared table or profile definition (coverage-lookup-table-exists)`,
      );
    }
  }

  // C51 — coverage-test-evidence (AUDIT): a conformance test whose runs
  // leave no declared evidence — no form declares it via
  // conformance_process, it names no result_forms / report_rows, and no
  // form covers a requirement it targets. inherits_from chains inherit
  // the parent's evidence links (R 60's class-driven instances).
  if (strictness === 'audit') {
    // the unified adjudication ledger: a test whose evidence exclusion
    // is adjudicated in coverage.json (the reasoned entry, the C73
    // staleness leg watching it) is recorded, never a gap
    let evidenceExclusions: ReadonlySet<string> = new Set();
    try {
      const { config } = loadTextCoverageData(dir);
      evidenceExclusions = new Set(
        (config?.evidence_exclusions ?? []).map(x => x.test),
      );
    } catch {
      // the coverage payloads unreadable — the metric's own C73 owns it
    }
    const testById = new Map(
      (standard.conformanceTests ?? []).map(t => [t.id, t]),
    );
    const formDeclaredTests = new Set<string>();
    for (const f of standard.forms ?? []) {
      for (const pid of f.conformanceProcessIds ??
        (f.conformanceProcessId ? [f.conformanceProcessId] : [])) {
        formDeclaredTests.add(pid);
      }
    }
    const formRequirementSets = (standard.forms ?? []).map(
      f => new Set(f.requirements ?? []),
    );
    const hasEvidence = (t: ConformanceTest, seen: Set<string>): boolean => {
      if (seen.has(t.id)) {
        return false;
      }
      seen.add(t.id);
      if (formDeclaredTests.has(t.id)) {
        return true;
      }
      if ((t.resultForms ?? []).length > 0 || (t.reportRows ?? []).length > 0) {
        return true;
      }
      if (
        formRequirementSets.some(reqs =>
          (t.targets ?? []).some(target => reqs.has(target)),
        )
      ) {
        return true;
      }
      const parent = t.inheritsFrom ? testById.get(t.inheritsFrom) : undefined;
      return parent !== undefined && hasEvidence(parent, seen);
    };
    for (const t of standard.conformanceTests ?? []) {
      if (evidenceExclusions.has(t.id)) {
        continue; // adjudicated exclusion — recorded in coverage.json
      }
      if (!hasEvidence(t, new Set())) {
        warn(
          'C51',
          `conformance test ${t.id}: no form records its evidence — the run happens and nothing permanent records it (coverage-test-evidence)`,
        );
      }
    }

    // C52 — coverage-form-judgment (AUDIT): a test-evidence form (one
    // binding a conformance process) carrying no judgment — no
    // pass_fail, no field evaluation/verdict, no requirements binding.
    // Documentary forms (report sections, headers) are not the closure's
    // "form" slot and stay silent.
    const formHasJudgment = (f: (typeof standard.forms)[number]): boolean => {
      if (f.passFail) {
        return true;
      }
      // The migrated verdict plane (TODO.lang-gaps/03): a pass_fail
      // spelling declares the canonical check form:<id>:pass_fail once
      // migrated — the derived check IS the form's judgment now.
      if (
        (standard.checks ?? []).some(c => c.id === `form:${f.id}:pass_fail`)
      ) {
        return true;
      }
      const walk = (fields: ReadonlyArray<FormField>): boolean =>
        fields.some(x => x.evaluation || x.verdict || walk(x.fields ?? []));
      return walk(f.fields ?? []);
    };
    for (const f of standard.forms ?? []) {
      const bindsTest =
        !!f.conformanceProcessId || (f.conformanceProcessIds ?? []).length > 0;
      if (!bindsTest) {
        continue;
      }
      if (!formHasJudgment(f) && (f.requirements ?? []).length === 0) {
        warn(
          'C52',
          `form ${f.id}: binds a conformance process but computes no judgment — evidence gathered and never weighed (coverage-form-judgment)`,
        );
      }
    }
  }

  // ── C71–C73: the normative-text coverage metric (TODO.roadmap/26, ──
  // concept doc §11.6) — layer 5 of the validation stack. The sentence
  // decomposition ships inside the package (sources-prd/*.sentences.json
  // + coverage.json); without them the metric is silent. C73 (config
  // hygiene — malformed payloads, stale allowances/adjudications) runs
  // at every level; C71 (uncovered normative sentences) is audit-level
  // and budgeted by the package's text_coverage_budget (C72, applied
  // with the allowlist below). Duplicate pairs are REPORTED by
  // `primmel check --coverage`, never auto-failed here.
  const textCoverageData = loadTextCoverageData(dir);
  pushIssues(textCoverageData.issues);
  // the exclusions' hygiene (C73, the unified ledger's drift leg):
  // an exclusion naming no declared conformance test is stale — the
  // test is gone, the entry must die. Independent of the sentence
  // manifests: the ledger stands on its own.
  {
    const declaredTests = new Set(
      (standard.conformanceTests ?? []).map(t => t.id),
    );
    for (const x of textCoverageData.config?.evidence_exclusions ?? []) {
      if (!declaredTests.has(x.test)) {
        err(
          'C73',
          `sources-prd/coverage.json: the evidence exclusion names "${x.test}", which no declared conformance test carries — the test is gone, the exclusion must die (text-coverage-config)`,
        );
      }
    }
  }
  if (textCoverageData.manifests.length > 0) {
    const textCoverage = computeTextCoverage(
      standard,
      textCoverageData.manifests,
      textCoverageData.config,
    );
    pushIssues(textCoverage.configIssues);
    if (strictness === 'audit') {
      for (const d of textCoverage.documents) {
        for (const s of d.uncoveredCounted) {
          warn('C71', uncoveredSentenceMessage(d.urn, s));
        }
      }
    }
  }
}
