// ─────────────────────────────────────────────────────────────────────
// The artifact-contracts family — checkArtifactContracts moved wholesale from check.ts (the
// family-module decomposition). The compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type { CheckIssue } from '../check';
import type Standard from '../types/Standard';

export function checkArtifactContracts(standard: Standard): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const err = (check: string, message: string) =>
    issues.push({ check, severity: 'error', message });

  const setIds = new Set<string>();
  for (const ps of standard.promiseSets ?? []) {
    setIds.add(ps.id);
    setIds.add(`${ps.id}.promise_set`);
  }
  for (const s of standard.subjects ?? []) {
    if ((s.is?.promises ?? []).length > 0) {
      setIds.add(s.id);
      setIds.add(`${s.id}.promise_set`);
    }
  }

  for (const d of standard.artifactDefinitions ?? []) {
    if (!d.contractFrom) {
      continue;
    }
    if (!setIds.has(d.contractFrom)) {
      err(
        'C153',
        `artifact_definition ${d.id}: contract_from "${d.contractFrom}" does not resolve to a declared promise set (artifact-contract-derivation)`,
      );
    }
    const c = d.contentContract;
    if (c.fields.length > 0 || c.structure || c.media.length > 0) {
      err(
        'C153',
        `artifact_definition ${d.id}: declares both contract_from and inline contract fields — the derived contract is the referenced set's projection, never a restatement (artifact-contract-derivation)`,
      );
    }
  }
  return issues;
}
