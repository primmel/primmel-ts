// ─────────────────────────────────────────────────────────────────────
// Validation types + post-parse validation pass.
//
// Two issue surfaces:
//   - Parse-time (caught during parse): duplicate IDs, unknown keywords
//     in strict mode. Collected on ctx.issues by parse.ts.
//   - Post-parse (caught after resolution): dangling refs, missing
//     required fields, type mismatches. Caught by validate() here.
//
// ValidationIssue is the shared shape; `position` is optional because
// parse-time issues always have it (we know the source location) but
// post-parse issues may not (resolved objects don't carry positions).
//
// Checks are registered in `VALIDATORS`. Adding a new post-parse
// check is one entry in that array — mirrors the defineConstruct
// pattern in ser-des/config/index.ts.
// ─────────────────────────────────────────────────────────────────────

import type Standard from './types/Standard';
import type Form from './types/Form';
import type { Position } from './ser-des/tokenize';

export type { Position };

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  construct: string;
  id?: string;
  message: string;
  position?: Position;
}

/**
 * Alias used internally by ParseContext — issues collected during
 * parsing carry the same shape as post-parse issues.
 */
export type ParseIssue = ValidationIssue;

/**
 * A post-parse validation check. Receives the resolved Standard and
 * returns any issues it finds. Checks are independent — order does not
 * matter, no shared mutable state.
 */
export interface Validator {
  /** Stable name for test reporting and filtering. */
  name: string;
  check: (standard: Standard) => ValidationIssue[];
}

/**
 * Validate a parsed Standard. Returns issues; empty array means clean.
 * Iterates every registered Validator.
 */
export function validate(standard: Standard): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const v of VALIDATORS) {
    issues.push(...v.check(standard));
  }
  return issues;
}

// ── Registered validators ────────────────────────────────────────────
// Add a new post-parse check by appending one entry to this array.

export const VALIDATORS: Validator[] = [
  { name: 'empty-ids', check: checkEmptyIds },
  { name: 'form-references', check: checkFormReferences },
  { name: 'state-machine-cascades', check: checkStateMachineCascades },
];

// ── Check implementations ────────────────────────────────────────────

/**
 * Reports empty or whitespace-only IDs on any Standard array whose
 * elements expose `.id`. Iterates generically so adding a construct
 * type does not require editing this check.
 */
function checkEmptyIds(standard: Standard): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [field, items] of iterIdArrays(standard)) {
    for (const item of items) {
      if (!item.id || item.id.trim() === '') {
        issues.push({
          severity: 'error',
          code: 'empty-id',
          construct: field,
          message: `${field} has an empty id — every ${field} must declare a non-empty id`,
        });
      }
    }
  }
  return issues;
}

function checkFormReferences(standard: Standard): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const calcIds = new Set(standard.calculations.map(c => c.id));
  const procIds = new Set(standard.processes.map(p => p.id));
  const subformIds = new Set(standard.subforms.map(s => s.id));

  for (const form of standard.forms) {
    if (form.conformanceProcessId && !procIds.has(form.conformanceProcessId)) {
      issues.push({
        severity: 'error',
        code: 'form-conformance-process-missing',
        construct: 'form',
        message: `Form "${form.id}" references conformance process "${form.conformanceProcessId}" which does not exist`,
        id: form.id,
      });
    }

    for (const field of iterFields(form)) {
      if (field.calculationId && !calcIds.has(field.calculationId)) {
        issues.push({
          severity: 'error',
          code: 'form-calculation-missing',
          construct: 'form',
          message: `Form "${form.id}" field "${field.name}" references calculation "${field.calculationId}" which does not exist`,
          id: form.id,
        });
      }
      if (field.subformRef && !subformIds.has(field.subformRef.subformId)) {
        issues.push({
          severity: 'error',
          code: 'form-subform-missing',
          construct: 'form',
          message: `Form "${form.id}" field "${field.name}" references subform "${field.subformRef.subformId}" which does not exist`,
          id: form.id,
        });
      }
    }
  }
  return issues;
}

function checkStateMachineCascades(standard: Standard): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const sm of standard.stateMachines) {
    const stateNames = new Set(sm.states.map(s => s.name));
    // `*` is the conventional wildcard for "any state" — always valid.
    stateNames.add('*');
    for (const tr of sm.transitions) {
      if (tr.from && !stateNames.has(tr.from)) {
        issues.push({
          severity: 'warning',
          code: 'state-machine-from-missing',
          construct: 'state_machine',
          message: `State machine "${sm.entityName}" transition from "${tr.from}" is not in declared states`,
          id: sm.entityName,
        });
      }
      if (tr.to && !stateNames.has(tr.to)) {
        issues.push({
          severity: 'warning',
          code: 'state-machine-to-missing',
          construct: 'state_machine',
          message: `State machine "${sm.entityName}" transition to "${tr.to}" is not in declared states`,
          id: sm.entityName,
        });
      }
    }
  }
  return issues;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Yield (construct-name, array) pairs for every Standard array whose
 * elements expose an `id`. Used by checkEmptyIds to walk every
 * identifiable construct type without hardcoding the list.
 */
function* iterIdArrays(
  standard: Standard,
): Generator<[string, Array<{ id: string }>]> {
  for (const [field, value] of Object.entries(standard)) {
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0]?.id === 'string'
    ) {
      yield [field, value as Array<{ id: string }>];
    }
  }
}

function* iterFields(form: Form): Generator<Form['fields'][number]> {
  const stack = [...form.fields];
  while (stack.length > 0) {
    const field = stack.pop()!;
    yield field;
    if (field.fields && field.fields.length > 0) {
      stack.push(...field.fields);
    }
  }
}
