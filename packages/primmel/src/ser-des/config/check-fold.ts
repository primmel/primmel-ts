// ─────────────────────────────────────────────────────────────────────
// The boolean-verdict fold (TODO.lang-gaps/03; the spec's check
// primitive, language-v3 §10, and C161, §16): "evaluate an expression
// and compare" is ONE construct, and the retired surface spellings
// materialize a `Check` into the checks collection at parse.
//
// This module is the fold's single source. The parsers call the
// per-construct derivations and register the returned checks; the
// checker (C161, the check-surface rule) re-derives the expectation
// from the Standard and compares it against the folds provenance the
// parse recorded — the completeness walk and the parse cannot drift.
//
// The fold is PARSE-SIDE only: a folded check is the view of its owner,
// the serializer emits the canonical form only (dump skips checks
// carrying `folds`), so serialization stays byte-identical for
// documents that spell the verdict the retired way.
//
// Spellings 1's pass_if retired at parse (wave 03 PR 2), spelling 5 —
// the validate_measurement strings — retired with it (wave 03 PR 3),
// and the two acceptance_criteria carriers — the conformance test's
// typed block and the requirement's raw block — retired with those
// (wave 03 PR 4): a retired spelling's derivation leaves this module
// with its refusal (the spelling no longer parses, the fold would be
// dead code), and the canonical check the verdict declares is an
// authored construct. The remaining derivations (the form's pass_fail
// view and the requirement limits) serve Standards built by hand or by
// an older parser.
// ─────────────────────────────────────────────────────────────────────

import type { Check } from '../../types/LmlAligned';
import type Form from '../../types/Form';
import type { Requirement } from '../../types/Requirement';
import Standard from '../../types/Standard';
import { freeIdentifiers, parseExpression } from '../../expressions';

/**
 * The fold-id convention: `<owner-kind>:<owner-id>:<facet-slot>` —
 * derived and stable, deterministic given the document. The facet slot
 * enumerates repeated carriers (`limit:2`); the retired
 * acceptance_criteria carriers named their criterion there
 * (`acceptance_criteria:<criterion-id>`) and the migrated corpus's
 * authored checks keep the same convention.
 */

/** Words the OCL dialect and the measurement-string idiom provide —
 *  never a declared name the spelling consumes. */
const EXPRESSION_KEYWORDS = new Set([
  // boolean / lambda / let core
  'and',
  'or',
  'not',
  'xor',
  'implies',
  'if',
  'then',
  'else',
  'let',
  'in',
  'true',
  'false',
  'self',
  'inv',
  'pre',
  'post',
  'ocl',
  // the iteration vocabulary
  'forAll',
  'exists',
  'every',
  'any',
  'one',
  'select',
  'reject',
  'collect',
  'isUnique',
  'sortedBy',
  'iterate',
  // the built-in functions
  'abs',
  'max',
  'min',
  'sum',
  'count',
  'size',
  'avg',
  'sqrt',
  'round',
  'floor',
  'ceiling',
  'includes',
  'excludes',
  'includesAll',
  'excludesAll',
  'isEmpty',
  'notEmpty',
  'first',
  'last',
  'at',
  'union',
  'intersection',
  'including',
  'excluding',
  'asSet',
  'asBag',
  'asSequence',
  'asOrderedSet',
]);

const WORD = /[A-Za-z_][A-Za-z0-9_]*/g;

/**
 * The identifiers a folded spelling's predicate names, in order of
 * appearance, deduplicated. The expression parser reads the OCL dialect
 * (the `ocl{…}` carrier sigil is stripped for the scan; the folded
 * expression keeps it verbatim); a string outside the dialect — the
 * measurement idiom's bracket lists — falls back to the word scan over
 * the same closed keyword filter. Total: never throws, never empty
 * strings.
 */
export function foldIdentifierInputs(expression: string): string[] {
  const body = expression
    .replace(/^\s*ocl\{/, '')
    .replace(/\}\s*$/, '')
    .trim();
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (name: string) => {
    if (name && !seen.has(name) && !EXPRESSION_KEYWORDS.has(name)) {
      seen.add(name);
      out.push(name);
    }
  };
  let parsed = false;
  try {
    const ids = freeIdentifiers(parseExpression(body));
    parsed = true;
    for (const n of ids.names) {
      push(n);
    }
    for (const c of ids.calls) {
      push(c);
    }
  } catch {
    parsed = false;
  }
  if (!parsed) {
    for (const m of body.matchAll(WORD)) {
      push(m[0]);
    }
  }
  return out;
}

function dedupe(names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export interface FoldContent {
  expression?: string;
  inputs?: string[];
  operator?: string;
  threshold?: string;
}

/** One folded check: id `<owner>:<facet>`, the owner's id on `source`
 *  (the Check.source field exists for exactly this provenance), and the
 *  structured `folds` provenance the C161 walk reads back. */
export function makeFoldCheck(
  owner: string,
  facet: string,
  content: FoldContent,
): Check {
  return {
    id: `${owner}:${facet}`,
    inputs: content.inputs ?? [],
    expression: content.expression ?? '',
    operator: content.operator ?? '',
    threshold: content.threshold ?? '',
    source: { doc: owner, clause: '' },
    folds: { owner, facet },
  };
}

// ── spelling 1: the form's pass_fail ─────────────────────────────────

/** `form <id> { pass_fail { criteria … pass_if "ocl{…}" } }` — the
 *  pass_if predicate folds verbatim; the inputs are the names the
 *  predicate consumes plus the derivation calculations it reads. */
export function formFoldChecks(form: Pick<Form, 'id' | 'passFail'>): Check[] {
  const pf = form.passFail;
  if (!pf || !pf.passIf) {
    return [];
  }
  const inputs = dedupe([
    ...foldIdentifierInputs(pf.passIf),
    ...pf.derivations.map(d => d.calculation),
  ]);
  return [
    makeFoldCheck(`form:${form.id}`, 'pass_fail', {
      expression: pf.passIf,
      inputs,
    }),
  ];
}

// ── spelling 4: the requirement's limits ─────────────────────────────

/** `requirement <id> { limit { expression … uses { … } accepts { … } } }`
 *  — every limit folds (the unnamed single is slot 1, the named list
 *  continues the enumeration); the expression is verbatim, the uses
 *  list is the inputs, and the accepts triple is the operator +
 *  threshold sugar. (The raw acceptance_criteria leg retired with its
 *  spelling's parse refusal — wave 03 PR 4.) */
export function requirementFoldChecks(r: Requirement): Check[] {
  const out: Check[] = [];
  const limits = [...(r.limit ? [r.limit] : []), ...(r.limits ?? [])];
  limits.forEach((lim, index) => {
    if (!lim.expression) {
      return;
    }
    out.push(
      makeFoldCheck(`requirement:${r.id}`, `limit:${index + 1}`, {
        expression: lim.expression,
        inputs: [...lim.uses],
        operator: lim.accepts?.op ?? '',
        threshold: lim.accepts?.limit ?? '',
      }),
    );
  });
  return out;
}

// ── the C161 completeness expectation ────────────────────────────────

/** The fold ids the Standard's spellings SHOULD carry — the same
 *  per-construct derivations the parsers registered by, re-derived
 *  from the parsed data. The C161 walk compares this against the
 *  `folds` provenance on standard.checks. The retired spellings'
 *  derivations left with their refusals (the validate_measurement
 *  strings, wave 03 PR 3; the two acceptance_criteria carriers, wave 03
 *  PR 4), so a Standard built by an older parser carrying them expects
 *  no folds for them — the spellings refuse before any walk could run
 *  on a fresh parse. The remaining derivations (the form pass_fail view
 *  and the requirement limits) serve Standards built by hand or by an
 *  older parser. */
export function expectedFoldIds(standard: Standard): string[] {
  const out: string[] = [];
  for (const f of standard.forms ?? []) {
    out.push(...formFoldChecks(f).map(c => c.id));
  }
  for (const r of standard.requirements ?? []) {
    out.push(...requirementFoldChecks(r).map(c => c.id));
  }
  return out;
}
