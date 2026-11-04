// ─────────────────────────────────────────────────────────────────────
// The uncertainty-budget family (C179): the budget is a declaration,
// never arithmetic — its target is a declared verdict (the measured
// quantity it backs), a Type A component names a declared test
// variable that holds a captured series, a Type B component states its
// distribution and half-width, and the coverage factor is a positive
// number. The propagation law is the GUM's — the evaluation plane's,
// never restated here.
//
// THE FAMILY-MODULE PATTERN (the check.ts decomposition, one family
// at a time): the family takes the context record it actually uses —
// `standard` and the two emit closures — and nothing else. The bodies
// move verbatim from check.ts; the compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type Standard from '../types/Standard';

export interface UncertaintyBudgetContext {
  standard: Standard;
  err: (check: string, message: string) => void;
  warn: (check: string, message: string) => void;
}

export function runUncertaintyBudgetFamily({
  standard,
  err,
  warn,
}: UncertaintyBudgetContext): void {
  const seriesVariables = new Map<string, boolean>();
  for (const t of standard.conformanceTests ?? []) {
    for (const v of t.variables ?? []) {
      seriesVariables.set(v.name, v.series !== null);
    }
  }
  for (const b of standard.uncertaintyBudgets ?? []) {
    if (!b.target) {
      err(
        'C179',
        `uncertainty_budget ${b.id}: declares no target — the budget backs a declared verdict's measured quantity (uncertainty-budget-resolves)`,
      );
    } else if (!(standard.verdicts ?? []).some(v => v.id === b.target)) {
      err(
        'C179',
        `uncertainty_budget ${b.id}: target "${b.target}" is not a declared verdict — the budget backs a measured quantity the verdicts own (uncertainty-budget-resolves)`,
      );
    }
    if (b.components.length === 0) {
      warn(
        'C179',
        `uncertainty_budget ${b.id}: declares no components — an empty budget states no uncertainty (uncertainty-budget-resolves)`,
      );
    }
    if (b.coverageK && !(Number(b.coverageK) > 0)) {
      err(
        'C179',
        `uncertainty_budget ${b.id}: coverage k "${b.coverageK}" is not a positive number (uncertainty-budget-resolves)`,
      );
    }
    for (const c of b.components) {
      if (c.type === 'A') {
        if (!c.series) {
          err(
            'C179',
            `uncertainty_budget ${b.id}: component ${c.id} is Type A but names no series — the statistics compute from a declared captured series (uncertainty-budget-resolves)`,
          );
        } else if (!seriesVariables.has(c.series)) {
          err(
            'C179',
            `uncertainty_budget ${b.id}: component ${c.id}'s series "${c.series}" is not a declared test variable (uncertainty-budget-resolves)`,
          );
        } else if (!seriesVariables.get(c.series)) {
          err(
            'C179',
            `uncertainty_budget ${b.id}: component ${c.id}'s series "${c.series}" declares no series shape — a Type A evaluation needs the captured series' axes and cell (uncertainty-budget-resolves)`,
          );
        }
      } else {
        if (!c.distribution) {
          err(
            'C179',
            `uncertainty_budget ${b.id}: component ${c.id} is Type B but states no distribution (uncertainty-budget-resolves)`,
          );
        }
        if (!c.halfWidth) {
          err(
            'C179',
            `uncertainty_budget ${b.id}: component ${c.id} is Type B but states no half_width — the distribution spans a half-width (uncertainty-budget-resolves)`,
          );
        }
      }
    }
  }
}
