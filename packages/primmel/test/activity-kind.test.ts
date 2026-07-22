// ─────────────────────────────────────────────────────────────────────
// ISO/IEC 17000 activity taxonomy (TODO.roadmap/39) — the
// `activity_archetype` register construct and the process `activity_kind`
// classification facet, plus the C58 activity-kind-resolves linter rule.
//
// Fixtures:
//   REGISTER       — a small activity-archetype register (the two
//                    functional-approach functions + two determination
//                    types + one attestation type, with parents).
//   TAGGED         — an abstract process classified against the register
//                    (multi-kind: the ISO/IEC 17065 §7.4 evaluation case).
//   TAGGED_UNKNOWN — a process tagged with an undeclared kind.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const REGISTER = `
activity_archetype selection {
  label "selection"
  clause "A.2"
  definition "planning and preparation activities in order to collect or produce all the information and input needed for the subsequent determination function"
}
activity_archetype determination {
  label "determination"
  clause "A.3"
  definition "activities undertaken to develop complete information regarding fulfilment of the specified requirements by the object of conformity assessment or its sample"
}
activity_archetype testing {
  label "testing"
  clause "6.2"
  definition "determination of one or more characteristics of an object of conformity assessment (4.2), according to a procedure (5.2)"
  parent determination
}
activity_archetype certification {
  label "certification"
  clause "7.6"
  definition "third-party attestation (7.3) related to an object of conformity assessment (4.2), with the exception of accreditation (7.7)"
  parent attestation
}
activity_archetype attestation {
  label "attestation"
  clause "7.3"
  definition "issue of a statement, based on a decision (7.2), that fulfilment of specified requirements (5.1) has been demonstrated"
}
`;

const TAGGED = `
process type_evaluation {
  name "Type evaluation (ISO/IEC 17065 §7.4)"
  signature {
    in { test_reports : text }
    out { evaluation_report : text }
  }
  activity_kind { selection determination }
}
process issue_certificate {
  name "Certificate issuance"
  activity_kind { certification }
}
process untagged {
  name "No classification"
}
`;

const TAGGED_UNKNOWN = `
process divination_run {
  name "Not a conformity-assessment activity"
  activity_kind { divination }
}
`;

// A register whose archetype declares a parent the register does not
// declare — R23/C58 must flag the dangling parent edge itself.
const REGISTER_DANGLING_PARENT = `
activity_archetype selection {
  label "selection"
  clause "A.2"
  definition "planning and preparation activities in order to collect or produce all the information and input needed for the subsequent determination function"
}
activity_archetype testing {
  label "testing"
  clause "6.2"
  definition "determination of one or more characteristics of an object of conformity assessment (4.2), according to a procedure (5.2)"
  parent determination
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-actk-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('activity_archetype register construct (TODO.roadmap/39)', () => {
  it('parses id, label, clause, definition, parent', () => {
    const m = load(REGISTER);
    assert.equal(m.activityArchetypes.length, 5);
    const testing = m.activityArchetypes.find(a => a.id === 'testing')!;
    assert.ok(testing);
    assert.equal(testing.label, 'testing');
    assert.equal(testing.clause, '6.2');
    assert.ok(testing.definition.startsWith('determination of one or more'));
    assert.equal(testing.parent, 'determination');
    const selection = m.activityArchetypes.find(a => a.id === 'selection')!;
    assert.equal(selection.parent, '');
  });

  it('round-trips the register losslessly (fixpoint)', () => {
    const m1 = load(REGISTER);
    const dumped = dump(m1);
    assert.ok(dumped.includes('activity_archetype testing {'));
    assert.ok(dumped.includes('parent determination'));
    const m2 = load(dumped);
    assert.deepEqual(m2.activityArchetypes, m1.activityArchetypes);
    assert.equal(dump(m2), dumped);
  });
});

describe('process activity_kind facet (TODO.roadmap/39)', () => {
  it('parses single- and multi-kind classifications; untagged stays empty', () => {
    const m = load(TAGGED);
    const evaluation = m.processes.find(p => p.id === 'type_evaluation')!;
    assert.deepEqual(evaluation.activityKinds, ['selection', 'determination']);
    const issue = m.processes.find(p => p.id === 'issue_certificate')!;
    assert.deepEqual(issue.activityKinds, ['certification']);
    const untagged = m.processes.find(p => p.id === 'untagged')!;
    assert.deepEqual(untagged.activityKinds, []);
  });

  it('round-trips the classification losslessly (fixpoint)', () => {
    const m1 = load(REGISTER + TAGGED);
    const dumped = dump(m1);
    assert.ok(dumped.includes('activity_kind { selection determination }'));
    const m2 = load(dumped);
    assert.deepEqual(m2.processes, m1.processes);
    assert.equal(dump(m2), dumped);
  });
});

describe('C58 activity-kind-resolves', () => {
  it('accepts kinds declared by the in-scope register (incl. multi-kind)', () => {
    const issues = checkPackage(makePackage(REGISTER + TAGGED)).filter(
      i => i.check === 'C58',
    );
    assert.deepEqual(issues, []);
  });

  it('flags a kind the register does not declare (seeded violation)', () => {
    const issues = checkPackage(makePackage(REGISTER + TAGGED_UNKNOWN)).filter(
      i => i.check === 'C58',
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'error');
    assert.ok(issues[0].message.includes('divination_run'));
    assert.ok(issues[0].message.includes('"divination"'));
  });

  it('flags a register parent that resolves to no declared archetype (seeded violation)', () => {
    // The parent edge is checked even with no processes in scope (R23
    // checks the register before the abstract-process early-return).
    const issues = checkPackage(makePackage(REGISTER_DANGLING_PARENT)).filter(
      i => i.check === 'C58',
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'error');
    assert.ok(issues[0].message.includes('testing'));
    assert.ok(issues[0].message.includes('"determination"'));
  });

  it('is silent when no activity-archetype register is in scope', () => {
    const issues = checkPackage(makePackage(TAGGED + TAGGED_UNKNOWN)).filter(
      i => i.check === 'C58',
    );
    assert.deepEqual(issues, []);
  });
});
