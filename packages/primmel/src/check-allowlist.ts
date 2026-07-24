// ─────────────────────────────────────────────────────────────────────
// primmel check — the package allowlist (TODO.roadmap/17).
//
// The KNOWN/STALE discipline of the OIML SMART model linker
// (data/<id>/linker-allowlist.yaml, concept doc §11.3), re-pointed at
// `primmel check`: a real package inherits real debt, and known-bad
// sites are RECORDED, not hidden. The allowlist lives in the package
// root as `.primmel-allowlist.prl` (linter-facing metadata, not package
// content — the package loader skips it):
//
//   coverage_budget 63
//   allowlist_entry {
//     rule C5
//     match "requirement /req/electronic/no-significant-faults:*"
//     reason "R 60-1 5.7.1.1 is verified through the EMC disturbance
//             tests' fault observables; targeting lands with the R 60
//             conformance coverage audit."
//     audit_ref "TODO.UPGRADE/03"
//   }
//
//   - KNOWN — an issue matching an entry (rule id + glob on the message)
//     is printed as KNOWN and never counted as an error, even under
//     --strict;
//   - STALE — an entry whose rule is ACTIVE at the current level but
//     matches no issue is an error (C57): the data was fixed, so the
//     entry must die. Entries for rules that do not run at the current
//     level (audit-only rules at the default level) are dormant, never
//     STALE;
//   - coverage_budget N ["reason"] — caps the package's coverage-family
//     warnings (C51/C52, the audit-level closure findings). Exceeding the
//     budget is an error (C55); a budget with slack warns (the allowlist
//     only shrinks — tighten it). Under --strict, coverage warnings within
//     the budget stay warnings (the budget is their allowance). The
//     optional quoted reason records WHY the number is what it is (the
//     burn-down justification — recommended, not required);
//   - text_coverage_budget N ["reason"] — the same discipline for the
//     normative-text coverage metric (TODO.roadmap/26): caps the C71
//     uncovered-normative-sentence warnings (exceeded: C72 error; slack:
//     C72 warning). A package at 100 % coverage declares 0 — any new
//     uncovered sentence exceeds it and fails the gate.
//
// Entry validation (concept doc §11.9): every entry names a known rule
// id, a non-empty match glob, a non-empty reason, and a non-empty
// audit_ref — malformed entries are errors (C56).
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import tokenize, { stripWrapping, unwrapBlock } from './ser-des/tokenize';
import { checkRule } from './check-rules';
import type { CheckIssue } from './check';

/** The allowlist filename the package loader and the linter agree on. */
export const ALLOWLIST_FILENAME = '.primmel-allowlist.prl';

export interface AllowlistEntry {
  rule: string;
  match: string;
  reason: string;
  auditRef: string;
}

export interface PackageAllowlist {
  coverageBudget: number | null;
  /** The optional quoted justification trailing the budget (recommended,
   *  not required) — records the burn-down story with the number. */
  coverageBudgetReason: string | null;
  /** TODO.roadmap/26: caps the C71 uncovered-normative-sentence warnings
   *  (the text-coverage metric's budget — C72 governs). */
  textCoverageBudget: number | null;
  textCoverageBudgetReason: string | null;
  entries: AllowlistEntry[];
}

const EMPTY: PackageAllowlist = {
  coverageBudget: null,
  coverageBudgetReason: null,
  textCoverageBudget: null,
  textCoverageBudgetReason: null,
  entries: [],
};

/** True when the glob (`*` wildcard, full-string match) matches `text`. */
export function globMatch(glob: string, text: string): boolean {
  const re = new RegExp(
    '^' + glob.split('*').map(escapeRegExp).join('[\\s\\S]*') + '$',
  );
  return re.test(text);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse the allowlist file at `<dir>/.primmel-allowlist.prl`. Returns
 * EMPTY when absent. Malformed entries are collected as C56 issues
 * (with the file's own unparseable content reported as one C56).
 */
export function loadAllowlist(dir: string): {
  allowlist: PackageAllowlist;
  issues: CheckIssue[];
} {
  const issues: CheckIssue[] = [];
  const path = join(dir, ALLOWLIST_FILENAME);
  if (!existsSync(path)) {
    return { allowlist: EMPTY, issues };
  }
  const text = readFileSync(path, 'utf8');
  let tokens: string[];
  try {
    tokens = tokenize(text);
  } catch (e) {
    issues.push({
      check: 'C56',
      severity: 'error',
      message: `${ALLOWLIST_FILENAME}: ${(e as Error).message} (allowlist-malformed)`,
    });
    return { allowlist: EMPTY, issues };
  }
  const allowlist: PackageAllowlist = {
    coverageBudget: null,
    coverageBudgetReason: null,
    textCoverageBudget: null,
    textCoverageBudgetReason: null,
    entries: [],
  };
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'coverage_budget' || cmd === 'text_coverage_budget') {
      const raw = stripWrapping(tokens[i++] ?? '');
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        issues.push({
          check: 'C56',
          severity: 'error',
          message: `${ALLOWLIST_FILENAME}: ${cmd} "${raw}" is not a non-negative integer (allowlist-malformed)`,
        });
      } else {
        if (cmd === 'coverage_budget') {
          allowlist.coverageBudget = n;
        } else {
          allowlist.textCoverageBudget = n;
        }
        // Optional trailing quoted reason (recommended, not required) —
        // the budget's justification rides with the number.
        const next = tokens[i];
        if (next !== undefined && next.startsWith('"')) {
          const reason = stripWrapping(next);
          if (cmd === 'coverage_budget') {
            allowlist.coverageBudgetReason = reason === '' ? null : reason;
          } else {
            allowlist.textCoverageBudgetReason = reason === '' ? null : reason;
          }
          i++;
        }
      }
    } else if (cmd === 'allowlist_entry') {
      const block = unwrapBlock(tokens[i++] ?? '');
      const entry = parseEntry(block);
      issues.push(...validateEntry(entry));
      if (entry.rule && entry.match && entry.reason && entry.auditRef) {
        allowlist.entries.push(entry);
      }
    } else {
      issues.push({
        check: 'C56',
        severity: 'error',
        message: `${ALLOWLIST_FILENAME}: unknown directive "${cmd}" — expected coverage_budget | text_coverage_budget | allowlist_entry (allowlist-malformed)`,
      });
      // Skip a following block so one bad directive does not cascade.
      if (i < tokens.length && tokens[i].startsWith('{')) {
        i++;
      }
    }
  }
  return { allowlist, issues };
}

function parseEntry(block: string): AllowlistEntry {
  const entry: AllowlistEntry = {
    rule: '',
    match: '',
    reason: '',
    auditRef: '',
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const key = t[i++];
    const value = stripWrapping(t[i++] ?? '');
    if (key === 'rule') {
      entry.rule = value;
    } else if (key === 'match') {
      entry.match = value;
    } else if (key === 'reason') {
      entry.reason = value;
    } else if (key === 'audit_ref') {
      entry.auditRef = value;
    }
  }
  return entry;
}

/** Concept doc §11.9: a real rule id, non-empty match, reason, audit_ref. */
function validateEntry(entry: AllowlistEntry): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const label = entry.match ? ` "${entry.match}"` : '';
  if (!entry.rule || !checkRule(entry.rule)) {
    issues.push({
      check: 'C56',
      severity: 'error',
      message: `${ALLOWLIST_FILENAME}: entry${label} names ${entry.rule ? `unknown rule "${entry.rule}"` : 'no rule'} — every allowlist entry names a real rule id (allowlist-malformed)`,
    });
  }
  if (!entry.match) {
    issues.push({
      check: 'C56',
      severity: 'error',
      message: `${ALLOWLIST_FILENAME}: entry for rule "${entry.rule}" has an empty match glob (allowlist-malformed)`,
    });
  }
  if (!entry.reason) {
    issues.push({
      check: 'C56',
      severity: 'error',
      message: `${ALLOWLIST_FILENAME}: entry${label} has no reason — known debt is recorded with its justification (allowlist-malformed)`,
    });
  }
  if (!entry.auditRef) {
    issues.push({
      check: 'C56',
      severity: 'error',
      message: `${ALLOWLIST_FILENAME}: entry${label} has no audit_ref — new allowlist entries require clause-referenced reasons (allowlist-malformed)`,
    });
  }
  return issues;
}

/** The coverage-family warning rules the per-package budget caps. */
export const BUDGETED_RULES = new Set(['C51', 'C52']);

/** TODO.roadmap/26: the text-coverage warning rules the per-package
 * text_coverage_budget caps (C71 uncovered normative sentences). */
export const TEXT_BUDGETED_RULES = new Set(['C71']);

export interface AllowlistResult {
  /** Issues after KNOWN marking; STALE/malformed/budget issues appended. */
  issues: CheckIssue[];
  /** Entries that matched at least one issue (KNOWN). */
  known: AllowlistEntry[];
  /** Active-level entries that matched nothing (STALE). */
  stale: AllowlistEntry[];
}

/**
 * Apply the allowlist to a run's issues:
 *   - matching issues are marked KNOWN (severity kept, `known: true` —
 *     they never count as errors, even under --strict);
 *   - active-rule entries matching nothing are STALE (C57, error);
 *   - the coverage budget caps the non-KNOWN C51/C52 warnings (C55:
 *     exceeded → error; slack → warning — the burn-down nudge). The
 *     budget is evaluated only when the budgeted rules are active
 *     (audit level — at the default level C51/C52 do not run).
 */
export function applyAllowlist(
  issues: CheckIssue[],
  allowlist: PackageAllowlist,
  activeRules: Set<string>,
): AllowlistResult {
  const out: CheckIssue[] = [...issues];
  const known: AllowlistEntry[] = [];
  const stale: AllowlistEntry[] = [];
  for (const entry of allowlist.entries) {
    if (!activeRules.has(entry.rule)) {
      continue; // dormant — the rule does not run at this level
    }
    let matched = false;
    for (const issue of out) {
      if (issue.check === entry.rule && globMatch(entry.match, issue.message)) {
        issue.known = true;
        matched = true;
      }
    }
    if (matched) {
      known.push(entry);
    } else {
      stale.push(entry);
      out.push({
        check: 'C57',
        severity: 'error',
        message: `${ALLOWLIST_FILENAME}: STALE entry [${entry.rule}] "${entry.match}" matches no issue — the data was fixed; remove the entry (allowlist-stale)`,
      });
    }
  }
  if (
    allowlist.coverageBudget !== null &&
    [...BUDGETED_RULES].some(r => activeRules.has(r))
  ) {
    const count = out.filter(
      i => BUDGETED_RULES.has(i.check) && !i.known && i.severity === 'warning',
    ).length;
    if (count > allowlist.coverageBudget) {
      out.push({
        check: 'C55',
        severity: 'error',
        message: `${ALLOWLIST_FILENAME}: ${count} coverage warnings exceed the package budget of ${allowlist.coverageBudget} — close the gaps or raise the budget with a clause-referenced reason (coverage-budget)`,
      });
    } else if (count < allowlist.coverageBudget) {
      out.push({
        check: 'C55',
        severity: 'warning',
        message: `${ALLOWLIST_FILENAME}: coverage budget ${allowlist.coverageBudget} has slack — only ${count} coverage warnings remain; tighten the budget (the allowlist only shrinks) (coverage-budget)`,
      });
    }
  }
  // TODO.roadmap/26 — the text-coverage budget (C72 governs C71, the same
  // discipline): a package at 100 % normative-sentence coverage declares
  // 0; any new uncovered sentence exceeds it and fails the gate.
  if (
    allowlist.textCoverageBudget !== null &&
    [...TEXT_BUDGETED_RULES].some(r => activeRules.has(r))
  ) {
    const count = out.filter(
      i =>
        TEXT_BUDGETED_RULES.has(i.check) && !i.known && i.severity === 'warning',
    ).length;
    if (count > allowlist.textCoverageBudget) {
      out.push({
        check: 'C72',
        severity: 'error',
        message: `${ALLOWLIST_FILENAME}: ${count} uncovered normative sentences exceed the package text_coverage_budget of ${allowlist.textCoverageBudget} — bind the sentences, declare allowances with clause-referenced reasons, or raise the budget (text-coverage-budget)`,
      });
    } else if (count < allowlist.textCoverageBudget) {
      out.push({
        check: 'C72',
        severity: 'warning',
        message: `${ALLOWLIST_FILENAME}: text_coverage_budget ${allowlist.textCoverageBudget} has slack — only ${count} uncovered normative sentences remain; tighten the budget (the allowlist only shrinks) (text-coverage-budget)`,
      });
    }
  }
  return { issues: out, known, stale };
}
