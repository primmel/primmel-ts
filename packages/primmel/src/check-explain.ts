// ─────────────────────────────────────────────────────────────────────
// primmel check --explain (CLAUDE-2 #7, TODO.lang-gaps/21): the
// suppression × severity × level matrix was folklore — "learned by
// being surprised". This module prints a rule's adjudication: why it
// fires, what can suppress it, what each level does to it. The matrix
// is the one check.ts finalizes with (the KNOWN register, the budgets,
// the strict promotion) — printed from the same constants, never
// restated.
// ─────────────────────────────────────────────────────────────────────

import {
  BUDGETED_RULES,
  TEXT_BUDGETED_RULES,
  ALLOWLIST_FILENAME,
} from './check-allowlist';
import { activeRuleIds, checkRule, type CheckLevel } from './check-rules';

/** The adjudication lines for one rule id: the catalog row, the level
 *  behavior, the suppression avenues, and the matrix's footnotes. */
export function explainRule(id: string): string[] {
  const out: string[] = [];
  const rule = checkRule(id);
  if (!rule) {
    return [`no rule "${id}" in the catalog (primmel check --rules)`];
  }
  out.push(
    `${rule.id} — ${rule.name} (${rule.family} family, ${rule.level}-level, default severity: ${rule.severity})`,
  );
  out.push(`  docs: ${rule.docs}`);

  // Level behavior
  const normal = activeRuleIds('normal' as CheckLevel);
  const audit = activeRuleIds('audit' as CheckLevel);
  out.push('');
  out.push('runs at:');
  out.push(
    `  default level: ${normal.has(rule.id) ? 'yes' : 'no — audit-level rule (dormant; its allowlist entries never go STALE)'}`,
  );
  out.push(`  --audit:       ${audit.has(rule.id) ? 'yes' : 'no'}`);

  // Suppression avenues
  out.push('');
  out.push('suppression:');
  out.push(
    `  KNOWN — ${ALLOWLIST_FILENAME} allowlist_entry { rule ${rule.id} match "<message glob>" reason "…" audit_ref "…" } — the matching issue prints KNOWN and never counts, at every level, --strict included. A fixed site makes the entry STALE (C57 error): record known-bad data, never dead data.`,
  );
  if (BUDGETED_RULES.has(rule.id)) {
    out.push(
      `  budget — coverage_budget N in ${ALLOWLIST_FILENAME} caps this rule's warnings; within the budget they stay warnings even under --strict, exceeding it is C55's error.`,
    );
  }
  if (TEXT_BUDGETED_RULES.has(rule.id)) {
    out.push(
      `  budget — text_coverage_budget N caps this rule's warnings; within the budget they stay warnings, exceeding it is C72's error.`,
    );
  }
  if (rule.severity === 'warning') {
    out.push(
      '  --strict — a surviving warning (not KNOWN, not budget-covered) promotes to an error.',
    );
  } else {
    out.push(
      '  severity — an error at every level; --strict changes nothing. KNOWN remains the one suppression.',
    );
  }
  out.push(
    rule.level === 'audit'
      ? '  level — dormant at the default level (nothing to suppress until --audit runs it).'
      : '  level — runs at every level; no level change suppresses it.',
  );

  // The matrix (shared footnotes)
  out.push('');
  out.push('the adjudication matrix (applied in this order):');
  out.push(
    '  1. runs?        normal-level rules run by default; --audit adds the audit-level rules.',
  );
  out.push(
    '  2. KNOWN?       an allowlisted issue never counts, every level, --strict included.',
  );
  out.push(
    '  3. budget?      C51/C52 (coverage_budget) and C71 (text_coverage_budget) warnings within the budget stay warnings.',
  );
  out.push(
    '  4. --strict?    every other surviving warning promotes to an error.',
  );
  out.push(
    "  5. STALE?       an allowlist entry whose rule is ACTIVE but matches nothing is C57's error — the entry must die.",
  );
  return out;
}
