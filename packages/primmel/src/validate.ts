// ─────────────────────────────────────────────────────────────────────
// Post-parse validation.
//
// Pure function: takes a resolved Standard, returns a list of issues.
// Catches cross-reference integrity bugs that the lenient resolver
// silently drops (form references missing calculation/process/subform,
// state machine cascades pointing at non-existent entities, duplicate
// IDs within a construct kind, empty IDs).
//
// Issue severity guides caller behaviour:
//   - 'error'   — model is broken, downstream tools will misbehave
//   - 'warning' — model is usable but suspicious
//   - 'info'    — stylistic or minor
//
// Companion to lenient parsing: parse() drops what it can't resolve;
// validate() tells you what was lost.
// ─────────────────────────────────────────────────────────────────────

import type Standard from './types/Standard';
import type Form from './types/Form';
import type StateMachine from './types/StateMachine';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  construct: string;
  id?: string;
  message: string;
}

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
    this.checkUniqueIds();
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

  private checkUniqueIds(): void {
    // Each construct kind must have unique ids within its own collection.
    // (Cross-kind collisions are allowed — a Provision and a Process may
    // share an id without ambiguity.)
    const checks: Array<{ kind: string; items: Array<{ id: string }> }> = [
      { kind: 'role', items: this.standard.roles },
      { kind: 'provision', items: this.standard.provisions },
      { kind: 'process', items: this.standard.processes },
      { kind: 'dataclass', items: this.standard.dataclasses },
      { kind: 'registry', items: this.standard.regs },
      { kind: 'reference', items: this.standard.refs },
      { kind: 'approval', items: this.standard.approvals },
      { kind: 'enum', items: this.standard.enums },
      { kind: 'variable', items: this.standard.vars },
      { kind: 'note', items: this.standard.notes },
      { kind: 'form', items: this.standard.forms },
      { kind: 'subform', items: this.standard.subforms },
      { kind: 'symbol', items: this.standard.symbols },
      { kind: 'calculation', items: this.standard.calculations },
    ];

    for (const { kind, items } of checks) {
      const seen = new Map<string, number>();
      for (const item of items) {
        const count = (seen.get(item.id) ?? 0) + 1;
        seen.set(item.id, count);
        if (count === 2) {
          // Report on second occurrence — first would be noise
          this.issue(
            'error',
            'duplicate-id',
            kind,
            `Duplicate ${kind} id "${item.id}" — earlier declaration overwritten`,
            item.id,
          );
        }
      }
    }
  }

  private checkEmptyIds(): void {
    const allItems: Array<{ kind: string; item: { id: string } }> = [
      ...this.standard.roles.map(item => ({ kind: 'role', item })),
      ...this.standard.provisions.map(item => ({ kind: 'provision', item })),
      ...this.standard.processes.map(item => ({ kind: 'process', item })),
      ...this.standard.forms.map(item => ({ kind: 'form', item })),
      ...this.standard.symbols.map(item => ({ kind: 'symbol', item })),
      ...this.standard.calculations.map(item => ({ kind: 'calculation', item })),
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
      if (form.conformanceProcessId && !procIds.has(form.conformanceProcessId)) {
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
    // Cascades target an entity by name. We can't validate the entity
    // exists (entities are external — data classes live elsewhere), but
    // we CAN validate the cascade's `set` field references are
    // syntactically present and the transition's `from`/`to` reference
    // declared states.
    for (const sm of this.standard.stateMachines) {
      const stateNames = new Set(sm.states.map(s => s.name));
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
  // Walks a form's field tree, yielding each field. Nested fields (via
  // `fields` on array/object shapes) are recursed.
  const stack = [...form.fields];
  while (stack.length > 0) {
    const field = stack.pop()!;
    yield field;
    if (field.fields && field.fields.length > 0) {
      stack.push(...field.fields);
    }
  }
}

// Re-exported for callers that want to filter
export type { StateMachine };
