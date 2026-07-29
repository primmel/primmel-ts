// ─────────────────────────────────────────────────────────────────────
// The cascade-step `via` facet + C95 cascade-transition-resolve (smart
// gap-close E12, analysis/cascade-machine-routing-design.md §4–§5): a
// status-writing cascade step (a mechanical `set` containing `status`,
// or a semantic `submit`/`lock`) on a machinated target declares
// `via <transition-action>` and ROUTES the write through a declared
// transition of the target's own machine — closing the raw-write leak
// (today the walker's cascade handlers Object.assign status onto target
// records with no machine consultation). Covers the grammar (parse,
// dump placement, round-trip fixpoint — clean and malformed), the C95
// rule's eight legs with per-leg positive AND negative pins (each
// single violation flips exactly one leg — the mutation proof), and the
// corpus leg: the 23 shipped packages show ZERO C95 errors and exactly
// the known leg-1 via-missing warnings the design enumerates (§3.2) —
// the rollout pin the smart declaration leg burns to zero (TODO-12).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';
import { CORPUS, CORPUS_AVAILABLE, CORPUS_SKIP } from './helpers/corpus';

// The corpus resolution (env-first, repo-relative default, loud skip) has
// one home — test/helpers/corpus.ts (TODO.v2/13 item 3c).
if (!CORPUS_AVAILABLE) {
  console.log(`cascade-via.test.ts: skipping the corpus legs — ${CORPUS_SKIP}`);
}

// ── The §3.2-style via-routed toy model ─────────────────────────────
// Two entity classes with machines (TestAssignment, FormInstance), one
// machine-less record store (AuditEvent), and the TestRequest machine
// whose cascades exercise every step shape: a self-step (status ==
// transition.to, raw by construction), a record-create, and the three
// via-routed cross-entity forms (mechanical set, multi-source target
// edge, semantic lock). The FormInstance machine carries TWO edges to
// LOCKED with distinct actions — the design's §4.1 ambiguity evidence
// (the written status alone names no transition) — one of them guarded
// (the leg-4 surface; the clean model never routes through it).
const ENTITIES = `
class TestRequest#data {
  store { testRequests }
  id: string { modality SHALL }
  status: enum {
    modality SHALL
    enum_values { DRAFT ISSUED IN_PROGRESS COMPLETED WITHDRAWN }
  }
  issued_date: date { modality MAY }
}

class TestAssignment#data {
  store { testAssignments }
  id: string { modality SHALL }
  test_request_id: string { modality SHALL }
  status: enum {
    modality SHALL
    enum_values { PENDING ACCEPTED IN_PROGRESS COMPLETED FAILED OMITTED }
  }
  started_date: date { modality MAY }
  omit_reason: string { modality MAY }
  result: string { modality MAY }
}

class FormInstance#data {
  store { formInstances }
  id: string { modality SHALL }
  test_report_id: string { modality SHALL }
  status: enum {
    modality SHALL
    enum_values { DRAFT IN_PROGRESS SUBMITTED LOCKED ACCEPTED REJECTED }
  }
  result: string { modality MAY }
}

class AuditEvent#data {
  store { auditEvents }
  id: string { modality SHALL }
  entity_type: string { modality SHALL }
  entity_id: string { modality SHALL }
  action: string { modality SHALL }
  status: string { modality MAY }
}
`;

const TARGET_MACHINES = `
state_machine TestAssignment {
  initial PENDING
  states { PENDING ACCEPTED IN_PROGRESS COMPLETED FAILED OMITTED }
  transition [PENDING, ACCEPTED] -> IN_PROGRESS action start {
  }
  transition [PENDING, ACCEPTED, IN_PROGRESS] -> COMPLETED action complete {
  }
  transition IN_PROGRESS -> FAILED action invalidate {
  }
  transition FAILED -> IN_PROGRESS action redo {
  }
  transition [PENDING, ACCEPTED, IN_PROGRESS, FAILED] -> OMITTED action omit {
  }
}

state_machine FormInstance {
  initial DRAFT
  states { DRAFT IN_PROGRESS SUBMITTED LOCKED ACCEPTED REJECTED }
  transition [DRAFT, IN_PROGRESS] -> SUBMITTED action lab_submits_with_report {
  }
  transition SUBMITTED -> LOCKED action test_report_issued {
  }
  transition LOCKED -> ACCEPTED action ia_accepts {
  }
  transition LOCKED -> SUBMITTED action test_report_recalled {
  }
  transition SUBMITTED -> LOCKED action supervisor_stamps {
    guard "admissible"
  }
}
`;

const OWNING_MACHINE = `
state_machine TestRequest {
  initial DRAFT
  states { DRAFT ISSUED IN_PROGRESS COMPLETED WITHDRAWN }
  transition DRAFT -> ISSUED action ia_issues {
    cascade TestRequest {
      set {
        status: "ISSUED"
        issued_date: "now"
      }
    }
    cascade AuditEvent {
      action record
      with {
        entity_type: "testRequests"
        entity_id: "\${this.id}"
        action: "issued"
      }
    }
  }
  transition ISSUED -> IN_PROGRESS action lab_starts_testing {
    cascade TestAssignment {
      where "test_request_id = \${this.id}"
      via start
      set {
        status: "IN_PROGRESS"
        started_date: "now"
      }
    }
  }
  transition IN_PROGRESS -> COMPLETED action lab_issues_test_report {
    cascade FormInstance {
      action lock
      where "test_report_id = \${this.id} AND status != LOCKED"
      via test_report_issued
    }
    cascade TestAssignment {
      where "test_request_id = \${this.id} AND status != OMITTED"
      via complete
      set {
        status: "COMPLETED"
      }
    }
  }
  transition IN_PROGRESS -> WITHDRAWN action ia_cancels {
    cascade TestAssignment {
      where "test_request_id = \${this.id} AND status != COMPLETED"
      via omit
      set {
        status: "OMITTED"
        omit_reason: "request withdrawn"
      }
    }
  }
}
`;

const CLEAN = ENTITIES + TARGET_MACHINES + OWNING_MACHINE;

function makeTmpPackage(...files: Record<string, string>[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-cascade-via-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  for (const record of files) {
    for (const [rel, body] of Object.entries(record)) {
      const full = join(dir, rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, body);
    }
  }
  return dir;
}

/** The toy package as the corpus spells it: entities + machines apart. */
function makeToyPackage(body: string): string {
  const entities = body.slice(0, body.indexOf('state_machine'));
  const machines = body.slice(body.indexOf('state_machine'));
  return makeTmpPackage({
    'entities/workflow.prl': entities,
    'evaluation/state-machines.prl': machines,
  });
}

function c95Issues(dir: string) {
  return checkPackage(dir).filter(i => i.check === 'C95');
}

describe('cascade via facet — grammar (smart gap-close E12)', () => {
  it('parses via on the mechanical set form and the semantic action form', () => {
    const m = load(CLEAN);
    const sm = m.stateMachines.find(s => s.entityName === 'TestRequest')!;
    const testing = sm.transitions.find(
      t => t.actionName === 'lab_starts_testing',
    )!;
    assert.equal(testing.cascades[0].via, 'start');
    const completed = sm.transitions.find(
      t => t.actionName === 'lab_issues_test_report',
    )!;
    assert.equal(completed.cascades[0].action, 'lock');
    assert.equal(completed.cascades[0].via, 'test_report_issued');
    assert.equal(completed.cascades[1].via, 'complete');
  });

  it('parses a via-less cascade to the empty string (the total-parser doctrine)', () => {
    const m = load(CLEAN);
    const sm = m.stateMachines.find(s => s.entityName === 'TestRequest')!;
    const issued = sm.transitions.find(t => t.actionName === 'ia_issues')!;
    assert.equal(issued.cascades[0].via, '');
    assert.equal(issued.cascades[1].via, '');
  });

  it('stays total on a via with no value — never throws, the linter judges', () => {
    const m = load(
      'state_machine M {\n  initial A\n  states { A B }\n  transition A -> B action go {\n    cascade N {\n      via\n    }\n  }\n}\n',
    );
    assert.equal(m.stateMachines[0].transitions[0].cascades[0].via, '');
  });

  it('pins the dump placement: via after where, before with/set/create', () => {
    const dumped = dump(load(CLEAN));
    assert.ok(
      dumped.includes(
        'where "test_request_id = ${this.id}"\n      via start\n      set {',
      ),
      `expected via between where and set in the dump, got:\n${dumped}`,
    );
    assert.ok(
      dumped.includes(
        'where "test_report_id = ${this.id} AND status != LOCKED"\n      via test_report_issued\n    }',
      ),
      `expected via last on the where-only semantic step, got:\n${dumped}`,
    );
  });

  it('round-trips the via-routed model losslessly (fixpoint)', () => {
    const m1 = load(CLEAN);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.stateMachines, m1.stateMachines);
    assert.equal(dump(m2), dumped);
  });

  it('round-trips a MALFORMED model byte-clean (via with no value)', () => {
    // The parser stays total on a value-less via: at end-of-block the
    // facet lands '' and the dump omits it; before another keyword the
    // parser takes that keyword as the value (the greedy-token idiom
    // every cascade keyword follows) — either way the dump re-parses to
    // the same model and the LINTER (C95), not the codec, owns the
    // judgment.
    const atEnd =
      'state_machine M {\n  initial A\n  states { A B }\n  transition A -> B action go {\n    cascade N {\n      via\n    }\n  }\n}\n';
    const m1 = load(atEnd);
    const dumped1 = dump(m1);
    assert.ok(
      !dumped1.includes('via'),
      `expected no via in the dump, got:\n${dumped1}`,
    );
    assert.deepEqual(load(dumped1).stateMachines, m1.stateMachines);
    assert.equal(dump(load(dumped1)), dumped1);

    const greedy =
      'state_machine M {\n  initial A\n  states { A B }\n  transition A -> B action go {\n    cascade N {\n      via\n      set { status: "B" }\n    }\n  }\n}\n';
    const m2 = load(greedy);
    assert.equal(m2.stateMachines[0].transitions[0].cascades[0].via, 'set');
    const dumped2 = dump(m2);
    assert.deepEqual(load(dumped2).stateMachines, m2.stateMachines);
    assert.equal(dump(load(dumped2)), dumped2);
  });

  it(
    'round-trips the REAL corpus machines byte-clean (the 34 shipped steps)',
    { skip: CORPUS_SKIP },
    () => {
      const text = readFileSync(
        join(CORPUS, 'oiml-smart-core', 'evaluation', 'state-machines.prl'),
        'utf8',
      );
      const m1 = load(text);
      assert.equal(
        m1.stateMachines.flatMap(s => s.transitions).flatMap(t => t.cascades)
          .length,
        44,
        'the shipped machines carry 44 cascade step instances after multi-source fan-out (34 spelled steps — 35 minus the E12 step-4 deletion)',
      );
      const dumped = dump(m1);
      const m2 = load(dumped);
      assert.deepEqual(m2.stateMachines, m1.stateMachines);
      assert.equal(dump(m2), dumped);
      // The shipped corpus declares its via facets (the smart
      // declaration leg landed, gap E12) — the corpus dump round-trips
      // them byte-clean (the facet is additive/OCP).
      assert.ok(
        m1.stateMachines
          .flatMap(s => s.transitions)
          .flatMap(t => t.cascades)
          .some(c => c.via !== ''),
        'the shipped corpus declares via facets (gap E12 declaration leg)',
      );
    },
  );
});

describe('C95 cascade-transition-resolve — the eight legs (§5)', () => {
  it('stays silent on the §3.2-style via-routed model (the positive leg)', () => {
    const issues = c95Issues(makeToyPackage(CLEAN));
    assert.deepEqual(
      issues,
      [],
      `expected no C95 issues, got:\n${issues.map(i => `[${i.severity}] ${i.message}`).join('\n')}`,
    );
  });

  it('stays silent on machines without cascades (additive/OCP)', () => {
    const issues = c95Issues(makeToyPackage(ENTITIES + TARGET_MACHINES));
    assert.deepEqual(issues, []);
  });

  it('stays silent on a status write to an entity with no declared machine (raw by design)', () => {
    // Q5/leg-1 boundary: the machinated-target condition is what brings a
    // status write under the routing contract; a machine-less store has
    // no machine to route through (and no states to typo-check against).
    const issues = c95Issues(
      makeToyPackage(
        CLEAN.replace(
          'cascade AuditEvent {\n      action record',
          'cascade AuditEvent {\n      set { status: "RECORDED" }\n    }\n    cascade AuditEvent {\n      action record',
        ),
      ),
    );
    assert.deepEqual(issues, []);
  });

  // ── the mutation proof: one violation, exactly one leg flips ──
  const MUTATIONS: Array<{
    leg: string;
    mutate: (src: string) => string;
    fragment: string;
    severity: 'error' | 'warning';
  }> = [
    {
      leg: '1 via-present',
      mutate: src => src.replace('      via start\n', ''),
      fragment:
        "writes status 'IN_PROGRESS' on machinated entity 'TestAssignment' but declares no via",
      severity: 'error',
    },
    {
      leg: '2 via-resolves',
      mutate: src => src.replace('via start', 'via teleport'),
      fragment:
        "via 'teleport' resolves to no transition of machine 'TestAssignment'",
      severity: 'error',
    },
    {
      leg: '3 via-matches-status',
      mutate: src =>
        src.replace(
          'via start\n      set {\n        status: "IN_PROGRESS"',
          'via complete\n      set {\n        status: "IN_PROGRESS"',
        ),
      fragment:
        "via 'complete' names no transition of machine 'TestAssignment' whose to is 'IN_PROGRESS'",
      severity: 'error',
    },
    {
      leg: '4 via-unguarded',
      mutate: src =>
        src.replace('via test_report_issued', 'via supervisor_stamps'),
      fragment:
        "via 'supervisor_stamps' names a guarded transition of machine 'FormInstance'",
      severity: 'error',
    },
    {
      leg: '5 via-forbidden-elsewhere (self-step)',
      mutate: src =>
        src.replace(
          'cascade TestRequest {\n      set {',
          'cascade TestRequest {\n      via ia_issues\n      set {',
        ),
      fragment: "declares via 'ia_issues' on a self-step",
      severity: 'error',
    },
    {
      leg: '5 via-forbidden-elsewhere (record step)',
      mutate: src =>
        src.replace(
          'cascade AuditEvent {\n      action record',
          'cascade AuditEvent {\n      action record\n      via start',
        ),
      fragment: "declares via 'start' on an action record step",
      severity: 'error',
    },
    {
      leg: '5 via-forbidden-elsewhere (payload-only step)',
      mutate: src =>
        src.replace(
          'set {\n        status: "IN_PROGRESS"\n        started_date: "now"\n      }',
          'set {\n        started_date: "now"\n      }',
        ),
      fragment:
        "declares via 'start' on a step that writes no status (payload-only)",
      severity: 'error',
    },
    {
      leg: '5 via-forbidden-elsewhere (machine-less target)',
      mutate: src =>
        src.replace(
          '    cascade AuditEvent {\n      action record',
          '    cascade AuditEvent {\n      via start\n      set { status: "RECORDED" }\n    }\n    cascade AuditEvent {\n      action record',
        ),
      fragment:
        "declares via 'start' on a step on entity 'AuditEvent', which declares no state machine",
      severity: 'error',
    },
    {
      leg: '5 via-forbidden-elsewhere (create step)',
      mutate: src =>
        src.replace(
          '    cascade AuditEvent {\n      action record',
          '    cascade AuditEvent {\n      via start\n      create { entity_type: "testRequests" }\n    }\n    cascade AuditEvent {\n      action record',
        ),
      fragment: "declares via 'start' on a create step",
      severity: 'error',
    },
    {
      leg: '6 self-consistency',
      // DRAFT is a DECLARED state of the owning machine, so leg 7 stays
      // silent — only leg 6 flips.
      mutate: src => src.replace('status: "ISSUED"', 'status: "DRAFT"'),
      fragment:
        "writes status 'DRAFT' on its own entity, but the owning transition's to is 'ISSUED'",
      severity: 'error',
    },
    {
      leg: '7 status-is-a-state',
      // One logical violation — the route lands on a state the target
      // machine never declares (both spellings carry the same typo, so
      // legs 2/3 stay silent and only the typo net flips).
      mutate: src =>
        src
          .replace('-> OMITTED action omit', '-> OMITED action omit')
          .replace('status: "OMITTED"', 'status: "OMITED"'),
      fragment:
        "writes status 'OMITED', which machine 'TestAssignment' does not declare as a state",
      severity: 'error',
    },
    {
      leg: '8 fields-resolve (where path)',
      mutate: src =>
        src.replace(
          'test_request_id = ${this.id}"\n      via start',
          'test_req_id = ${this.id}"\n      via start',
        ),
      fragment:
        "where path 'test_req_id' resolves to no declared field of entity 'TestAssignment'",
      severity: 'error',
    },
    {
      leg: '8 fields-resolve (set field)',
      mutate: src => src.replace('started_date: "now"', 'start_date: "now"'),
      fragment:
        "set field 'start_date' resolves to no declared field of entity 'TestAssignment'",
      severity: 'error',
    },
    {
      leg: '8 fields-resolve (with parameter)',
      mutate: src =>
        src.replace(
          'entity_type: "testRequests"',
          'entity_typ: "testRequests"',
        ),
      fragment:
        "with parameter 'entity_typ' resolves to no declared field of entity 'AuditEvent'",
      severity: 'error',
    },
  ];

  for (const m of MUTATIONS) {
    it(`leg ${m.leg}: one violation flips exactly this leg`, () => {
      const issues = c95Issues(makeToyPackage(m.mutate(CLEAN)));
      assert.equal(
        issues.length,
        1,
        `expected exactly one C95 issue, got:\n${issues.map(i => `[${i.severity}] ${i.message}`).join('\n')}`,
      );
      assert.equal(
        issues[0].severity,
        m.severity,
        `leg ${m.leg} severity (${m.severity})`,
      );
      assert.ok(
        issues[0].message.includes(m.fragment),
        `expected the leg-${m.leg} message "${m.fragment}", got:\n${issues[0].message}`,
      );
      assert.ok(
        issues[0].message.includes('(cascade-transition-resolve)'),
        'the message carries the rule name',
      );
    });
  }

  it('an action name shared by two edges resolves by action + written status (the §4.1 ambiguity)', () => {
    // FormInstance declares TWO edges to LOCKED (test_report_issued,
    // supervisor_stamps) — the via + the written status identify the
    // edge, so routing through the UNGUARDED one is clean even though
    // the guarded sibling shares the to-state.
    const issues = c95Issues(makeToyPackage(CLEAN));
    assert.deepEqual(issues, []);
    // …and routing the same written status through the guarded sibling
    // is the leg-4 mutation above.
  });
});

describe('corpus leg — the rollout pin, burned to zero (smart gap-close E12)', () => {
  it(
    'shows zero C95 issues of any severity across the 23 packages (the corpus is via-complete)',
    { skip: CORPUS_SKIP },
    () => {
      const dirs = readdirSync(CORPUS)
        .map(d => join(CORPUS, d))
        .filter(d => existsSync(join(d, 'package.primmel')))
        .sort();
      assert.equal(
        dirs.length,
        26,
        `expected the 26-package corpus at ${CORPUS}`,
      );
      // The smart declaration leg (gap E12) landed the 13 via facets +
      // the test_report_recalled edge and deleted the redundant step —
      // the corpus is via-complete, so NO C95 issue of any severity may
      // fire on any package. (Rollout history: during the declaration
      // window leg 1 warned at 18 step instances × the 5 machine-bearing
      // packages; leg 1 is the catalogued error now.)
      for (const dir of dirs) {
        const name = dir.split('/').pop()!;
        const issues = c95Issues(dir);
        assert.deepEqual(
          issues,
          [],
          `${name}: expected zero C95 issues (the corpus is via-complete), got:\n${issues.map(e => `[${e.severity}] ${e.message}`).join('\n')}`,
        );
      }
    },
  );
});
