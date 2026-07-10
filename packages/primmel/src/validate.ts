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
 * Validate a parsed Standard. Returns issues; empty array means clean.
 */
export function validate(standard: Standard): ValidationIssue[] {
  return new Validator(standard).run();
}

class Validator {
  private readonly issues: ValidationIssue[] = [];

  constructor(private readonly standard: Standard) {}

  run(): ValidationIssue[] {
    this.checkEmptyIds();
    this.checkFormReferences();
    this.checkStateMachineCascades();
    return this.issues;
  }

  private issue(
    severity: ValidationSeverity,
    code: string,
    construct: string,
    message: string,
    id?: string,
  ): void {
    this.issues.push({ severity, code, construct, message, id });
  }

  private checkEmptyIds(): void {
    const allItems: Array<{ kind: string; item: { id: string } }> = [
      ...this.standard.roles.map(item => ({ kind: 'role', item })),
      ...this.standard.provisions.map(item => ({ kind: 'provision', item })),
      ...this.standard.processes.map(item => ({ kind: 'process', item })),
      ...this.standard.forms.map(item => ({ kind: 'form', item })),
      ...this.standard.symbols.map(item => ({ kind: 'symbol', item })),
      ...this.standard.calculations.map(item => ({
        kind: 'calculation',
        item,
      })),
    ];
    for (const { kind, item } of allItems) {
      if (!item.id || item.id.trim() === '') {
        this.issue(
          'error',
          'empty-id',
          kind,
          `${kind} has an empty id — every ${kind} must declare a non-empty id`,
        );
      }
    }
  }

  private checkFormReferences(): void {
    const calcIds = new Set(this.standard.calculations.map(c => c.id));
    const procIds = new Set(this.standard.processes.map(p => p.id));
    const subformIds = new Set(this.standard.subforms.map(s => s.id));

    for (const form of this.standard.forms) {
      if (
        form.conformanceProcessId &&
        !procIds.has(form.conformanceProcessId)
      ) {
        this.issue(
          'error',
          'form-conformance-process-missing',
          'form',
          `Form "${form.id}" references conformance process "${form.conformanceProcessId}" which does not exist`,
          form.id,
        );
      }

      for (const field of iterFields(form)) {
        if (field.calculationId && !calcIds.has(field.calculationId)) {
          this.issue(
            'error',
            'form-calculation-missing',
            'form',
            `Form "${form.id}" field "${field.name}" references calculation "${field.calculationId}" which does not exist`,
            form.id,
          );
        }
        if (field.subformRef && !subformIds.has(field.subformRef.subformId)) {
          this.issue(
            'error',
            'form-subform-missing',
            'form',
            `Form "${form.id}" field "${field.name}" references subform "${field.subformRef.subformId}" which does not exist`,
            form.id,
          );
        }
      }
    }
  }

  private checkStateMachineCascades(): void {
    for (const sm of this.standard.stateMachines) {
      const stateNames = new Set(sm.states.map(s => s.name));
      // `*` is the conventional wildcard for "any state" — always valid.
      stateNames.add('*');
      for (const tr of sm.transitions) {
        if (tr.from && !stateNames.has(tr.from)) {
          this.issue(
            'warning',
            'state-machine-from-missing',
            'state_machine',
            `State machine "${sm.entityName}" transition from "${tr.from}" is not in declared states`,
            sm.entityName,
          );
        }
        if (tr.to && !stateNames.has(tr.to)) {
          this.issue(
            'warning',
            'state-machine-to-missing',
            'state_machine',
            `State machine "${sm.entityName}" transition to "${tr.to}" is not in declared states`,
            sm.entityName,
          );
        }
      }
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
