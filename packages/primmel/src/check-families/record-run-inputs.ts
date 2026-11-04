// ─────────────────────────────────────────────────────────────────────
// The record-run-inputs family — checkRecordRunInputs moved wholesale from check.ts (the
// family-module decomposition). The compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type { CheckIssue } from '../check';
import type Standard from '../types/Standard';

export function checkRecordRunInputs(standard: Standard): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const tests = new Map(
    (standard.conformanceTests ?? []).map(t => [t.id, t] as const),
  );
  const classes = new Map(
    (standard.dataclasses ?? []).map(d => [d.id, d] as const),
  );
  for (const form of standard.forms ?? []) {
    const slice = form.runInputs ?? [];
    if (slice.length === 0) {
      continue;
    }
    const ownerIds = form.conformanceProcessIds?.length
      ? form.conformanceProcessIds
      : form.conformanceProcessId
        ? [form.conformanceProcessId]
        : [];
    const owners = ownerIds
      .map(id => tests.get(id))
      .filter(t => t !== undefined);
    if (owners.length === 0) {
      issues.push({
        check: 'C183',
        severity: 'error',
        message: `form ${form.id}: run_inputs names ${slice.join(' ')} but the form binds no conformance test — the slice's contract is the owning test's run.inputs (record-run-inputs)`,
      });
      continue;
    }
    // The data class id may carry the record-dialect suffix (ProbeRecord#data)
    // or not — resolve both spellings.
    const dataClass =
      classes.get(form.dataClassId) ??
      classes.get(form.dataClassId.replace(/#data$/, ''));
    const attrIds = new Set((dataClass?.attributes ?? []).map(a => a.id));
    for (const name of slice) {
      const inTest = owners.some(t => (t.run?.inputs ?? []).includes(name));
      if (!inTest) {
        issues.push({
          check: 'C183',
          severity: 'error',
          message: `form ${form.id}: run_inputs "${name}" is not in the owning test's run.inputs (${owners.map(o => o.id).join(', ')}) — a record cannot carry what the run does not apply (record-run-inputs)`,
        });
      }
      if (!attrIds.has(name)) {
        issues.push({
          check: 'C183',
          severity: 'error',
          message: `form ${form.id}: run_inputs "${name}" is no field of the data class ${form.dataClassId} — the record's slice must be the record's shape (record-run-inputs)`,
        });
      }
    }
  }
  return issues;
}
