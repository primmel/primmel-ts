// ─────────────────────────────────────────────────────────────────────
// The closed-derivations family — checkClosedDerivations moved wholesale from check.ts (the
// family-module decomposition). The compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type { CheckIssue } from '../check';
import type Standard from '../types/Standard';

const CLOSED_DERIVATION_STOP = new Set([
  'self',
  'p',
  'ocl',
  'true',
  'false',
  'null',
  'undefined',
  // OCL navigation and collection operators
  'and',
  'or',
  'not',
  'implies',
  'if',
  'then',
  'else',
  'endif',
  'xor',
  'let',
  'in',
  'exists',
  'forAll',
  'select',
  'reject',
  'collect',
  'isEmpty',
  'size',
  'sum',
  'min',
  'max',
  'abs',
  'round',
  'floor',
  'sqrt',
  'includes',
  'excludes',
  'includesAll',
  'excludesAll',
  'count',
  'first',
  'last',
  'asSet',
  'asOrderedSet',
  'asSequence',
  'asBag',
  'sortedBy',
  'iterate',
  'oclIsUndefined',
  'oclIsKindOf',
  'oclIsTypeOf',
  'allInstances',
  // table-lookup engine vocabulary (the lookup facet names these)
  'lookup',
  'profile',
  // OCL collection statistics and arithmetic
  'average',
  'mean',
  'size',
  'div',
  'mod',
  'collect',
]);

// Attribute navigation: `head.field…` resolves when the HEAD is a
// declared name (an input, a calculation, an attribute, a class-typed
// value); the tail is navigation over that head's type, judged by the
// class layer (C152), not by the closed-derivation rule.
const CLOSED_DERIVATION_PATH_RE =
  /\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+/g;
const CLOSED_DERIVATION_IDENT_RE = /[A-Za-z_][A-Za-z0-9_]*/g;

export function checkClosedDerivations(standard: Standard): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const err = (check: string, message: string) =>
    issues.push({ check, severity: 'error', message });

  // The declared universe every derivation may reference.
  const declared = new Set<string>();
  for (const c of standard.calculations ?? []) {
    declared.add(c.id);
    declared.add(c.name);
  }
  for (const tb of standard.tables ?? []) {
    declared.add(tb.id);
  }
  for (const s of standard.symbols ?? []) {
    declared.add(s.id);
  }
  for (const v of standard.variables ?? []) {
    declared.add(v.id);
  }
  for (const a of standard.attributeDefinitions ?? []) {
    declared.add(a.id);
  }
  for (const e of standard.enums ?? []) {
    declared.add(e.id);
  }
  for (const d of standard.dataclasses ?? []) {
    declared.add(d.id);
  }
  for (const inst of standard.instruments ?? []) {
    for (const d of inst.dimensions ?? []) {
      declared.add(d.id);
    }
  }
  for (const d of standard.dimensions ?? []) {
    declared.add(d.id);
  }
  // A calculation's own output name is declared too (requirements bind
  // it), and so is every input of every calculation.
  for (const c of standard.calculations ?? []) {
    if (c.output?.name) {
      declared.add(c.output.name);
    }
    for (const i of c.inputs ?? []) {
      declared.add(i.name);
    }
  }

  const localsOf = (extra: string[]): Set<string> =>
    new Set([...declared, ...extra]);

  const checkExpression = (
    expr: string,
    locals: Set<string>,
    where: string,
  ): void => {
    if (!expr) {
      return;
    }
    // Values and lambdas are not references: single-quoted literals are
    // values; an identifier before `|` is a lambda parameter.
    const noLiterals = expr.replace(/'[^']*'/g, ' ');
    const noLambdas = noLiterals.replace(
      /\b([A-Za-z_][A-Za-z0-9_]*)\s*\|/g,
      ' ',
    );
    const stripped = noLambdas.replace(CLOSED_DERIVATION_PATH_RE, ' ');
    const seen = new Set<string>();
    for (const raw of stripped.match(CLOSED_DERIVATION_IDENT_RE) ?? []) {
      if (
        CLOSED_DERIVATION_STOP.has(raw) ||
        locals.has(raw) ||
        seen.has(raw) ||
        /^[a-z][0-9]?$/.test(raw)
      ) {
        continue;
      }
      seen.add(raw);
      err(
        'C149',
        `${where}: expression references "${raw}", which no declared calculation, table, symbol, measurement, or attribute defines (closed-derivation-references-declared)`,
      );
    }
  };

  for (const a of standard.attributeDefinitions ?? []) {
    checkExpression(a.derived, localsOf([]), `attribute_definition ${a.id}`);
  }
  for (const c of standard.calculations ?? []) {
    // The normative body is the declared expression; engine variants
    // are consumer code and outside the language's semantics.
    const inputs = (c.inputs ?? []).map(i => i.name);
    checkExpression(c.expression, localsOf(inputs), `calculation ${c.id}`);
  }
  for (const s of standard.symbols ?? []) {
    if (s.formula?.expression) {
      checkExpression(
        s.formula.expression,
        localsOf(s.formula.inputs ?? []),
        `symbol ${s.id}`,
      );
    }
  }
  for (const v of standard.verdicts ?? []) {
    checkExpression(v.derive, localsOf(v.inputs ?? []), `verdict ${v.id}`);
  }
  return issues;
}
