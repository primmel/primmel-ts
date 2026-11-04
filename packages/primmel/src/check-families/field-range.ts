// ─────────────────────────────────────────────────────────────────────
// The field-range family — checkFieldRange moved wholesale from check.ts (the
// family-module decomposition). The compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type { CheckIssue } from '../check';
import type { FormField } from '../types/Form';
import type Standard from '../types/Standard';

export function checkFieldRange(standard: Standard): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const TEMPLATE = /^\$\{.+\}$/;
  const boundKind = (v: number | string | null | undefined) => {
    if (v === undefined || v === null) {
      return 'absent';
    }
    if (typeof v === 'number') {
      return 'numeric';
    }
    if (TEMPLATE.test(v)) {
      return 'template';
    }
    return 'invalid';
  };
  const walk = (
    formId: string,
    fields: readonly FormField[],
    path: string,
  ): void => {
    for (const f of fields) {
      const where = path === '' ? `field ${f.name}` : `field ${path}.${f.name}`;
      const kMin = boundKind(f.min);
      const kMax = boundKind(f.max);
      if (kMin === 'invalid') {
        issues.push({
          check: 'C184',
          severity: 'error',
          message: `form ${formId}: ${where} min "${String(f.min)}" is neither a numeric literal nor a \${{…}} template (field-range-order)`,
        });
      }
      if (kMax === 'invalid') {
        issues.push({
          check: 'C184',
          severity: 'error',
          message: `form ${formId}: ${where} max "${String(f.max)}" is neither a numeric literal nor a \${{…}} template (field-range-order)`,
        });
      }
      if (
        kMin === 'numeric' &&
        kMax === 'numeric' &&
        (f.min as number) > (f.max as number)
      ) {
        issues.push({
          check: 'C184',
          severity: 'error',
          message: `form ${formId}: ${where} declares min ${f.min} > max ${f.max} — the range is empty by declaration (field-range-order)`,
        });
      }
      if (f.fields?.length) {
        walk(formId, f.fields, path === '' ? f.name : `${path}.${f.name}`);
      }
    }
  };
  for (const form of standard.forms ?? []) {
    walk(form.id, form.fields ?? [], '');
  }
  return issues;
}
