// ─────────────────────────────────────────────────────────────────────
// The series-records family (C182, the variable↔subform type link):
// a test variable holding a captured series records its cells through
// the linked subform — the record form's fields type against the
// series' axes. The region moves verbatim from check.ts; the compiler
// and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import { parseExpression } from '../expressions';
import type { ExprAst } from '../expressions';
import type Standard from '../types/Standard';

export interface SeriesRecordsContext {
  standard: Standard;
  err: (check: string, message: string) => void;
}

export function runSeriesRecordsFamily({
  standard,
  err,
}: SeriesRecordsContext): void {
  // ── C182: series-record-fields (the variable↔subform type link) ────
  // A series variable whose series declares `record <form>` types its
  // row members by the record form's fields: a collection derivation's
  // lambda member (`m.<field>`) resolves against them — the derivation
  // over a captured collection is kind-checked, never kind-silent.
  {
    const recordFormFields = new Map<string, Set<string>>();
    for (const f of standard.forms ?? []) {
      recordFormFields.set(f.id, new Set((f.fields ?? []).map(x => x.name)));
    }
    const walkMembers = (
      n: ExprAst,
      bound: Map<string, string>,
      out: { source: string; field: string }[],
    ): void => {
      if (n.type === 'nav') {
        const inner = new Map(bound);
        inner.set(n.var, n.source);
        walkMembers(n.body, inner, out);
        return;
      }
      if (n.type === 'name' && n.path.length > 0) {
        // the lexer keeps dotted names in one path head: m.served is
        // path ['m.served'] — split the head to find the lambda param
        const parts = [...n.path[0]!.split('.'), ...n.path.slice(1)];
        if (parts.length > 1) {
          const src = bound.get(parts[0]!);
          if (src !== undefined) {
            out.push({ source: src, field: parts.slice(1).join('.') });
          }
        }
        return;
      }
      const kids: ExprAst[] =
        n.type === 'call'
          ? n.args
          : n.type === 'binop'
            ? [n.left, n.right]
            : n.type === 'unop'
              ? [n.operand]
              : n.type === 'ifelse'
                ? [n.cond, n.then, n.else]
                : [];
      for (const k of kids) {
        walkMembers(k, bound, out);
      }
    };
    for (const t of standard.conformanceTests ?? []) {
      for (const v of t.variables ?? []) {
        const rec = v.series?.record;
        if (!rec) {
          continue;
        }
        const fields = recordFormFields.get(rec);
        if (!fields) {
          err(
            'C182',
            `conformance test ${t.id}: variable "${v.name}" series record "${rec}" names no declared form — the row members type by the record form's fields (series-record-fields)`,
          );
          continue;
        }
        if (!v.derivation) {
          continue;
        }
        let ast: ExprAst;
        try {
          ast = parseExpression(
            v.derivation.replace(/^ocl\{/, '').replace(/\}$/, ''),
          );
        } catch {
          continue; // parse errors ride the derivation's own rules
        }
        const members: { source: string; field: string }[] = [];
        walkMembers(ast, new Map(), members);
        for (const m of members) {
          if (m.source === v.name && !fields.has(m.field)) {
            err(
              'C182',
              `conformance test ${t.id}: variable "${v.name}" derivation names "m.${m.field}" — the record form ${rec} declares no such field; the row members are its typed fields (series-record-fields)`,
            );
          }
        }
      }
    }
  }
}
