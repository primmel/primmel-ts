// ─────────────────────────────────────────────────────────────────────
// Cascade action vocabulary (smart repo task 52, BUG.R60-SSOT.md gap
// 12): transitions declare semantic side-effects — action lock | submit
// | notify | record + optional with { … } parameters — alongside the
// mechanical v2-G10 set/create form. Parse, dump, round-trip, and the
// closed-vocabulary parse error.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

const SRC = `
state_machine TestRequest {
  initial DRAFT
  states { DRAFT ISSUED IN_PROGRESS COMPLETED }
  transition DRAFT -> ISSUED action ia_issues {
    cascade AuditEvent {
      action record
      with { entity_type: "testRequests" action: "issued" }
    }
  }
  transition ISSUED -> IN_PROGRESS action lab_starts_testing {
    cascade TestAssignment {
      where "test_request_id = \${this.id}"
      set { status: "IN_PROGRESS" }
    }
  }
  transition IN_PROGRESS -> COMPLETED action lab_issues_test_report {
    cascade TestReport {
      action submit
      where "test_request_id = \${this.id}"
    }
    cascade FormInstance {
      action lock
      where "test_report_id = \${testReport.id} AND status != LOCKED"
    }
  }
}
`;

describe('cascade action facet (task 52)', () => {
  it('parses action + with on a cascade', () => {
    const m = load(SRC);
    const sm = m.stateMachines.find(s => s.entityName === 'TestRequest')!;
    const issued = sm.transitions.find(t => t.actionName === 'ia_issues')!;
    const rec = issued.cascades[0];
    assert.equal(rec.action, 'record');
    assert.equal(rec.targetEntity, 'AuditEvent');
    assert.deepEqual(rec.with, {
      entity_type: 'testRequests',
      action: 'issued',
    });
    const completed = sm.transitions.find(
      t => t.actionName === 'lab_issues_test_report',
    )!;
    assert.deepEqual(
      completed.cascades.map(c => [c.action, c.targetEntity, c.where]),
      [
        ['submit', 'TestReport', 'test_request_id = ${this.id}'],
        [
          'lock',
          'FormInstance',
          'test_report_id = ${testReport.id} AND status != LOCKED',
        ],
      ],
    );
  });

  it('keeps the mechanical set/create form action-less', () => {
    const m = load(SRC);
    const sm = m.stateMachines.find(s => s.entityName === 'TestRequest')!;
    const mech = sm.transitions.find(
      t => t.actionName === 'lab_starts_testing',
    )!.cascades[0];
    assert.equal(mech.action, null);
    assert.deepEqual(mech.with, {});
    assert.deepEqual(mech.set, [{ field: 'status', value: 'IN_PROGRESS' }]);
  });

  it('rejects an unknown cascade action at parse time', () => {
    const bad = SRC.replace('action record', 'action teleport');
    assert.throws(() => load(bad), /Unknown action teleport/);
  });

  it('rejects a cascade block mixing action with set/create', () => {
    // The schema's oneOf already forbids the mixed form; the kernel must
    // too — prl-to-yaml emits only the action branch, so a mixed block
    // would otherwise be accepted here and silently drop the set/create
    // half on emission (task-52 review, minor 3).
    const mixedSet = SRC.replace(
      'action record',
      'action record\n      set { status: "LOCKED" }',
    );
    assert.throws(() => load(mixedSet), /mutually exclusive/);
    const mixedCreate = SRC.replace(
      'set { status: "IN_PROGRESS" }',
      'action lock\n      create { kind: "note" }',
    );
    assert.throws(() => load(mixedCreate), /mutually exclusive/);
    const reversedOrder = SRC.replace(
      'action record',
      'set { status: "LOCKED" }\n      action record',
    );
    assert.throws(() => load(reversedOrder), /mutually exclusive/);
  });

  it('round-trips action cascades losslessly (fixpoint)', () => {
    const m1 = load(SRC);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(
      m2.stateMachines.find(s => s.entityName === 'TestRequest'),
      m1.stateMachines.find(s => s.entityName === 'TestRequest'),
    );
    assert.equal(dump(m2), dumped);
  });
});
