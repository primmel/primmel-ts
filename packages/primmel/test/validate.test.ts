import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../src/validate';
import type Standard from '../src/types/Standard';
import type Role from '../src/types/Role';
import type Process from '../src/types/process';
import type Provision from '../src/types/Provision';
import type Form from '../src/types/Form';
import type Symbol from '../src/types/Symbol';
import type Calculation from '../src/types/Calculation';
import type Subform from '../src/types/Subform';
import type StateMachine from '../src/types/StateMachine';

function makeStandard(overrides: Partial<Standard> = {}): Standard {
  return {
    meta: {
      schema: '',
      author: '',
      title: '',
      edition: '',
      namespace: '',
      shortname: '',
    },
    roles: [],
    provisions: [],
    pages: [],
    processes: [],
    dataclasses: [],
    regs: [],
    events: [],
    gateways: [],
    references: [],
    approvals: [],
    enums: [],
    variables: [],
    notes: [],
    tables: [],
    figures: [],
    links: [],
    mapProfiles: [],
    viewProfiles: [],
    terms: [],
    forms: [],
    subforms: [],
    symbols: [],
    calculations: [],
    stateMachines: [],
    root: null,
    ...overrides,
  } as Standard;
}

describe('validate — empty IDs', () => {
  it('reports error for a role with empty id', () => {
    const s = makeStandard({
      roles: [{ id: '' } as Role],
    });
    const issues = validate(s);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].code, 'empty-id');
    assert.equal(issues[0].construct, 'roles');
    assert.equal(issues[0].severity, 'error');
  });

  it('reports error for a role with whitespace-only id', () => {
    const s = makeStandard({
      roles: [{ id: '  ' } as Role],
    });
    const issues = validate(s);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].code, 'empty-id');
  });

  it('passes when all IDs are non-empty', () => {
    const s = makeStandard({
      roles: [{ id: 'r1', name: 'R1' } as Role],
      processes: [{ id: 'p1', name: 'P1' } as Process],
    });
    const issues = validate(s);
    assert.equal(issues.length, 0);
  });

  it('checks all construct types for empty IDs', () => {
    const s = makeStandard({
      roles: [{ id: '' } as Role],
      provisions: [{ id: '' } as Provision],
      processes: [{ id: '' } as Process],
      forms: [{ id: '', fields: [] } as unknown as Form],
      symbols: [{ id: '' } as unknown as Symbol],
      calculations: [{ id: '' } as Calculation],
    });
    const issues = validate(s);
    const constructs = issues.map(i => i.construct).sort();
    assert.deepEqual(constructs, [
      'calculations',
      'forms',
      'processes',
      'provisions',
      'roles',
      'symbols',
    ]);
  });
});

describe('validate — form references', () => {
  it('reports error when conformance process does not exist', () => {
    const s = makeStandard({
      forms: [
        {
          id: 'f1',
          conformanceProcessId: 'ghost',
          fields: [],
        } as unknown as Form,
      ],
    });
    const issues = validate(s);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].code, 'form-conformance-process-missing');
    assert.equal(issues[0].id, 'f1');
  });

  it('passes when conformance process exists', () => {
    const s = makeStandard({
      forms: [
        {
          id: 'f1',
          conformanceProcessId: 'p1',
          fields: [],
        } as unknown as Form,
      ],
      processes: [{ id: 'p1', name: 'P1' } as Process],
    });
    const issues = validate(s);
    assert.equal(issues.length, 0);
  });

  it('reports error when field calculation reference is dangling', () => {
    const s = makeStandard({
      forms: [
        {
          id: 'f1',
          fields: [
            {
              name: 'measurement',
              calculationId: 'missing-calc',
            } as Form['fields'][number],
          ],
        } as unknown as Form,
      ],
    });
    const issues = validate(s);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].code, 'form-calculation-missing');
    assert.ok(issues[0].message.includes('measurement'));
  });

  it('reports error when field subform reference is dangling', () => {
    const s = makeStandard({
      forms: [
        {
          id: 'f1',
          fields: [
            {
              name: 'detail',
              subformRef: { subformId: 'missing-subform' },
            } as Form['fields'][number],
          ],
        } as unknown as Form,
      ],
    });
    const issues = validate(s);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].code, 'form-subform-missing');
  });

  it('walks nested form fields', () => {
    const s = makeStandard({
      forms: [
        {
          id: 'f1',
          fields: [
            {
              name: 'parent',
              fields: [
                {
                  name: 'child',
                  calculationId: 'missing',
                } as Form['fields'][number],
              ],
            } as Form['fields'][number],
          ],
        } as unknown as Form,
      ],
    });
    const issues = validate(s);
    assert.equal(issues.length, 1);
    assert.ok(issues[0].message.includes('child'));
  });
});

describe('validate — state machine cascades', () => {
  it('warns when transition "from" references undeclared state', () => {
    const s = makeStandard({
      stateMachines: [
        {
          entityName: 'Order',
          states: [{ name: 'draft' }, { name: 'published' }],
          transitions: [{ from: 'draft', to: 'archived' }],
          cascades: [],
        } as unknown as StateMachine,
      ],
    });
    const issues = validate(s);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].code, 'state-machine-to-missing');
    assert.equal(issues[0].severity, 'warning');
  });

  it('passes when all transition states are declared', () => {
    const s = makeStandard({
      stateMachines: [
        {
          entityName: 'Order',
          states: [{ name: 'draft' }, { name: 'published' }],
          transitions: [{ from: 'draft', to: 'published' }],
          cascades: [],
        } as unknown as StateMachine,
      ],
    });
    const issues = validate(s);
    assert.equal(issues.length, 0);
  });

  it('treats * as a valid wildcard state', () => {
    const s = makeStandard({
      stateMachines: [
        {
          entityName: 'Order',
          states: [{ name: 'draft' }],
          transitions: [{ from: '*', to: 'draft' }],
          cascades: [],
        } as unknown as StateMachine,
      ],
    });
    const issues = validate(s);
    assert.equal(issues.length, 0);
  });

  it('warns on both from and to if both are undeclared', () => {
    const s = makeStandard({
      stateMachines: [
        {
          entityName: 'Order',
          states: [{ name: 'draft' }],
          transitions: [{ from: 'ghost1', to: 'ghost2' }],
          cascades: [],
        } as unknown as StateMachine,
      ],
    });
    const issues = validate(s);
    assert.equal(issues.length, 2);
    const codes = issues.map(i => i.code).sort();
    assert.deepEqual(codes, [
      'state-machine-from-missing',
      'state-machine-to-missing',
    ]);
  });
});

describe('validate — clean model', () => {
  it('returns no issues for a well-formed model', () => {
    const s = makeStandard({
      roles: [{ id: 'r1', name: 'Author' } as Role],
      processes: [{ id: 'p1', name: 'Write' } as Process],
      forms: [
        {
          id: 'f1',
          conformanceProcessId: 'p1',
          fields: [],
        } as unknown as Form,
      ],
      calculations: [{ id: 'c1' } as Calculation],
      subforms: [{ id: 'sf1' } as Subform],
    });
    const issues = validate(s);
    assert.equal(issues.length, 0);
  });

  it('returns no issues for an empty model', () => {
    const issues = validate(makeStandard());
    assert.equal(issues.length, 0);
  });
});
