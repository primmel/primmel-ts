// ─────────────────────────────────────────────────────────────────────
// The declared-predicates family — checkDeclaredPredicates moved wholesale from check.ts (the
// family-module decomposition). The compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type { CheckIssue } from '../check';
import type { FormField } from '../types/Form';
import type Standard from '../types/Standard';

export function checkDeclaredPredicates(standard: Standard): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const registry = new Set((standard.predicates ?? []).map(p => p.id));
  if (registry.size === 0) {
    return issues;
  }
  const visit = (
    owner: string,
    refs?: ReadonlyArray<{ predicate: string }> | null,
  ) => {
    for (const r of refs ?? []) {
      if (!registry.has(r.predicate)) {
        issues.push({
          check: 'C103',
          severity: 'error',
          message: `${owner}: ref predicate "${r.predicate}" is not declared in the composed predicate registry (declared-predicate)`,
        });
      }
    }
  };
  const visitFields = (owner: string, fields: FormField[]) => {
    for (const f of fields) {
      const here = `${owner} field ${f.name}`;
      visit(here, f.refs);
      // Nested object shape and hoisted array-item fields recurse.
      if (f.fields && f.fields.length > 0) {
        visitFields(here, f.fields);
      }
    }
  };

  const m = standard.packageManifest;
  if (m) {
    visit(`package "${m.id}"`, m.refs);
  }
  for (const r of standard.requirements ?? []) {
    visit(`requirement ${r.id}`, r.refs);
  }
  for (const t of standard.conformanceTests ?? []) {
    visit(`conformance_test ${t.id}`, t.refs);
  }
  for (const f of standard.forms ?? []) {
    visit(`form ${f.id}`, f.refs);
    visitFields(`form ${f.id}`, f.fields ?? []);
  }
  for (const s of standard.subforms ?? []) {
    visitFields(`subform ${s.id}`, s.fields ?? []);
  }
  for (const c of standard.calculations ?? []) {
    visit(`calculation ${c.id}`, c.refs);
  }
  for (const s of standard.symbols ?? []) {
    visit(`symbol ${s.id}`, s.refs);
  }
  for (const t of standard.terms ?? []) {
    visit(`term ${t.id}`, t.refs);
  }
  for (const t of standard.tables ?? []) {
    visit(`table ${t.id}`, t.refs);
  }
  for (const c of standard.constraints ?? []) {
    visit(`constraint ${c.id}`, c.refs);
  }
  for (const k of standard.competenceKinds ?? []) {
    visit(`competence_kind ${k.id}`, k.refs);
  }
  for (const s of standard.testSequences ?? []) {
    visit(`test_sequence ${s.id}`, s.refs);
  }
  for (const i of standard.instruments ?? []) {
    visit(`instrument ${i.id}`, i.refs);
  }
  return issues;
}
