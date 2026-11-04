// ─────────────────────────────────────────────────────────────────────
// The verdict-chains family — checkVerdictChains moved wholesale from check.ts (the
// family-module decomposition). The compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type { CheckIssue } from '../check';
import { findCycle } from '../graph';
import type Standard from '../types/Standard';

export function checkVerdictChains(standard: Standard): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const symbolIds = new Set((standard.symbols ?? []).map(s => s.id));
  const testNames = new Set<string>();
  for (const t of standard.conformanceTests ?? []) {
    for (const v of t.variables ?? []) {
      testNames.add(v.name);
    }
    for (const o of t.observables ?? []) {
      testNames.add(o.name);
    }
  }
  const verdictIds = new Set((standard.verdicts ?? []).map(v => v.id));

  // C116 — every input resolves.
  for (const v of standard.verdicts ?? []) {
    for (const inp of v.inputs ?? []) {
      if (!symbolIds.has(inp) && !testNames.has(inp) && !verdictIds.has(inp)) {
        issues.push({
          check: 'C116',
          severity: 'error',
          message: `verdict ${v.id}: input "${inp}" resolves to no declared symbol, test variable or observable, or verdict (verdict-inputs-resolve)`,
        });
      }
    }
  }

  // C117 — the verdict→verdict subgraph never cycles. Self-derivation
  // stays in the adjacency: a verdict deriving from itself is the
  // length-1 cycle this rule exists for.
  const adj = new Map<string, string[]>();
  for (const v of standard.verdicts ?? []) {
    adj.set(
      v.id,
      (v.inputs ?? []).filter(i => verdictIds.has(i)),
    );
  }
  const cycle = findCycle(adj);
  if (cycle) {
    issues.push({
      check: 'C117',
      severity: 'error',
      message: `verdict chain cycle: ${cycle.join(' → ')} — the acceptance chain is a graph a consumer traverses, so it must be acyclic (verdict-chain-acyclic)`,
    });
  }
  return issues;
}
