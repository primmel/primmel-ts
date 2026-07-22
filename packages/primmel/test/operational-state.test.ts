// ─────────────────────────────────────────────────────────────────────
// Operational state machines (Primmel v3, TODO.roadmap/07) — the
// subject's HAS state as a first-class aspect:
//   - state_machine typed `kind operational` (vs the lifecycle family);
//   - has.state on the subject binds the machine;
//   - process steps `fires` transitions; preconditions gate on
//     `self.state = #ready`;
//   - evaluateStateGate classifies ok | invalid (a violated state gate
//     voids the RUN — invalid, never fail);
//   - foldTrajectory folds the fired step sequence into the run's state
//     trajectory (the trace record; storage is task 29's);
//   - linter rules C37 state-fires-resolve, C38 state-family-separation,
//     C39 state-machine-states-referenced, C40 anatomy-state-resolves,
//     C41 precondition-on-violation-known.
//
// Fixture: an R 144-style warm-up model — a compressed gaseous hydrogen
// measuring system that must be warmed up before it measures.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';
import {
  StateTrajectoryError,
  evaluateStateGate,
  extractStateGates,
  foldTrajectory,
} from '../src/operational-state';

// The warm-up machine: off → warming → ready → measuring → fault. `warm`
// is enabled from both off and warming (the multi-source form), so firing
// it on a cold instrument completes the warm-up into ready.
const MACHINE = `
state_machine CGHMOperationalStates {
  kind operational
  initial off
  states { off warming ready measuring fault }
  transition off -> warming action preheat
  transition [off, warming] -> ready action warm
  transition ready -> measuring action measure
  transition measuring -> ready action halt
  transition [off, warming, ready, measuring] -> fault action trip
  transition fault -> off action reset
}
`;

const SUBJECT = `
subject CGHM {
  is { metadata { name "Compressed gaseous hydrogen measuring system" } }
  has { state CGHMOperationalStates }
}
`;

// The gated test process: a state gate on #ready (no measurement unless
// warmed up) and steps firing the machine's transitions.
const PROCESS = `
process warm_up_and_measure {
  name "Gated measurement (R 144-style warm-up)"
  state CGHMOperationalStates
  preconditions {
    precondition warmed-up {
      check "ocl{self.state = #ready}"
      description "No measurement unless the measuring system is warmed up — a cold run is invalid, never a fail."
      on_violation invalid
    }
  }
  does {
    start_event s
    action warm_up { executor machine fires warm }
    action measure_run { executor machine fires measure }
    action halt_run { executor machine fires halt }
    end_event e
    flow { s -> warm_up -> measure_run -> halt_run -> e }
  }
}
`;

const FIXTURE = MACHINE + SUBJECT + PROCESS;

function makeStatePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-state-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'state.prl'), body);
  return dir;
}

const STATE_RULES = ['C37', 'C38', 'C39', 'C40', 'C41'];

describe('operational state machine — ser-des', () => {
  it('parses kind operational, has.state, fires, and the state gate', () => {
    const m = load(FIXTURE);

    const sm = m.stateMachines.find(
      s => s.entityName === 'CGHMOperationalStates',
    )!;
    assert.equal(sm.kind, 'operational');
    assert.equal(sm.initialState, 'off');
    assert.deepEqual(
      sm.states.map(s => s.name),
      ['off', 'warming', 'ready', 'measuring', 'fault'],
    );
    // The multi-source warm transition fans out to one per source.
    const warm = sm.transitions.filter(t => t.actionName === 'warm');
    assert.deepEqual(
      warm.map(t => t.from),
      ['off', 'warming'],
    );
    assert.ok(warm.every(t => t.to === 'ready'));

    const s = m.subjects.find(x => x.id === 'CGHM')!;
    assert.equal(s.has.state, 'CGHMOperationalStates');

    const p = m.processes.find(x => x.id === 'warm_up_and_measure')!;
    assert.equal(p.state, 'CGHMOperationalStates');
    assert.equal(p.preconditions[0].check, 'ocl{self.state = #ready}');
    assert.equal(p.preconditions[0].onViolation, 'invalid');
    const byId = new Map(p.does!.steps.map(st => [st.id, st]));
    assert.equal(byId.get('warm_up')!.fires, 'warm');
    assert.equal(byId.get('measure_run')!.fires, 'measure');
    assert.equal(byId.get('halt_run')!.fires, 'halt');
    assert.equal(byId.get('s')!.fires, '');
  });

  it('round-trips the fixture losslessly (fixpoint)', () => {
    const m1 = load(FIXTURE);
    const dumped = dump(m1);
    assert.ok(dumped.includes('kind operational'));
    assert.ok(dumped.includes('state CGHMOperationalStates'));
    assert.ok(dumped.includes('fires warm'));
    assert.ok(dumped.includes('ocl{self.state = #ready}'));
    const m2 = load(dumped);
    assert.deepEqual(m2.stateMachines, m1.stateMachines);
    assert.deepEqual(m2.subjects, m1.subjects);
    assert.deepEqual(m2.processes, m1.processes);
    assert.equal(dump(m2), dumped);
  });

  it('defaults a machine without kind to lifecycle and omits the line on dump', () => {
    const src = `state_machine Application {
  initial DRAFT
  states { DRAFT SUBMITTED }
  transition DRAFT -> SUBMITTED action submit { }
}
`;
    const m1 = load(src);
    assert.equal(m1.stateMachines[0].kind, 'lifecycle');
    const dumped = dump(m1);
    assert.ok(!dumped.includes('kind'), 'lifecycle stays the silent default');
    const m2 = load(dumped);
    assert.deepEqual(m2.stateMachines, m1.stateMachines);
    assert.equal(dump(m2), dumped);
  });

  it('accepts an explicit kind lifecycle and rejects an unknown kind', () => {
    const m = load(`state_machine M {
  kind lifecycle
  initial a
  states { a b }
  transition a -> b action go { }
}
`);
    assert.equal(m.stateMachines[0].kind, 'lifecycle');
    assert.throws(
      () => load('state_machine M { kind sideways initial a }'),
      /Unknown kind sideways \(valid: lifecycle, operational\)/,
    );
  });
});

describe('state gate extraction', () => {
  it('extracts only self.state comparisons — never plain enum literals', () => {
    assert.deepEqual(extractStateGates('ocl{self.state = #ready}'), [
      { state: 'ready', positive: true },
    ]);
    assert.deepEqual(
      extractStateGates('ocl{self.state = #ready and self.warmed_up}'),
      [{ state: 'ready', positive: true }],
    );
    assert.deepEqual(extractStateGates('ocl{self.state <> #fault}'), [
      { state: 'fault', positive: false },
    ]);
    assert.deepEqual(extractStateGates('ocl{#ready = self.state}'), [
      { state: 'ready', positive: true },
    ]);
    // An enum literal on another register is not a state gate.
    assert.deepEqual(extractStateGates('ocl{self.re_verdict = #fail}'), []);
  });
});

describe('evaluateStateGate — the warm-up acceptance', () => {
  const m = load(FIXTURE);
  const machine = m.stateMachines[0];
  const preconditions = m.processes[0].preconditions;

  it('starting cold (off) classifies invalid — never fail', () => {
    const r = evaluateStateGate(machine, 'off', preconditions);
    // The classification vocabulary is ok | invalid — there is no 'fail':
    // a violated state gate voids the run, it does not fail the instrument.
    assert.equal(r.outcome, 'invalid');
    assert.deepEqual(r.violations, [
      {
        preconditionId: 'warmed-up',
        gate: 'ready',
        actual: 'off',
        negated: false,
      },
    ]);
  });

  it('after firing warm → ready, the gate classifies ok', () => {
    const trajectory = foldTrajectory(machine, { at: '2026-07-20T09:00:00Z' }, [
      { id: 'warm_up', fires: 'warm', at: '2026-07-20T09:15:00Z' },
    ]);
    const current = trajectory[trajectory.length - 1].state;
    assert.equal(current, 'ready');
    const r = evaluateStateGate(machine, current, preconditions);
    assert.equal(r.outcome, 'ok');
    assert.deepEqual(r.violations, []);
  });

  it('intermediate nodes on the way to ready still classify invalid', () => {
    // preheat takes the machine off → warming; the gate wants #ready.
    const trajectory = foldTrajectory(machine, { at: '' }, [
      { id: 'preheat', fires: 'preheat', at: 't1' },
    ]);
    assert.equal(trajectory[trajectory.length - 1].state, 'warming');
    assert.equal(
      evaluateStateGate(machine, 'warming', preconditions).outcome,
      'invalid',
    );
  });

  it('a precondition without a state gate is ignored here', () => {
    const r = evaluateStateGate(machine, 'off', [
      {
        id: 'count-sufficient',
        check: 'ocl{measurement_count >= 100}',
        description: '',
        onViolation: 'invalid',
      },
    ]);
    assert.equal(r.outcome, 'ok');
    assert.deepEqual(r.violations, []);
  });

  it('honors negated gates and flags an off-model current node', () => {
    const noFault = [
      {
        id: 'no-fault',
        check: 'ocl{self.state <> #fault}',
        description: '',
        onViolation: 'invalid',
      },
    ];
    assert.equal(evaluateStateGate(machine, 'ready', noFault).outcome, 'ok');
    const violated = evaluateStateGate(machine, 'fault', noFault);
    assert.equal(violated.outcome, 'invalid');
    assert.equal(violated.violations[0].negated, true);
    // A node the machine does not declare asserts nothing: every gate fails.
    assert.equal(evaluateStateGate(machine, 'bogus', []).outcome, 'ok');
    assert.equal(
      evaluateStateGate(machine, 'bogus', noFault).outcome,
      'invalid',
    );
  });
});

describe('foldTrajectory — the run-trace state trajectory', () => {
  const m = load(FIXTURE);
  const machine = m.stateMachines[0];

  it('folds the fired step sequence into the trace', () => {
    const trajectory = foldTrajectory(machine, { at: '2026-07-20T09:00:00Z' }, [
      { id: 'warm_up', fires: 'warm', at: '2026-07-20T09:15:00Z' },
      { id: 'measure_run', fires: 'measure', at: '2026-07-20T09:20:00Z' },
      { id: 'halt_run', fires: 'halt', at: '2026-07-20T09:30:00Z' },
    ]);
    assert.deepEqual(trajectory, [
      { state: 'off', at: '2026-07-20T09:00:00Z', firedBy: '' },
      { state: 'ready', at: '2026-07-20T09:15:00Z', firedBy: 'warm_up' },
      {
        state: 'measuring',
        at: '2026-07-20T09:20:00Z',
        firedBy: 'measure_run',
      },
      { state: 'ready', at: '2026-07-20T09:30:00Z', firedBy: 'halt_run' },
    ]);
  });

  it('steps without fires leave the machine where it is', () => {
    const trajectory = foldTrajectory(machine, { at: 't0' }, [
      { id: 'look', at: 't1' },
      { id: 'warm_up', fires: 'warm', at: 't2' },
    ]);
    assert.deepEqual(trajectory, [
      { state: 'off', at: 't0', firedBy: '' },
      { state: 'ready', at: 't2', firedBy: 'warm_up' },
    ]);
  });

  it('honors an explicit initial state and the * wildcard from', () => {
    const tripMachine = machine;
    const trajectory = foldTrajectory(
      tripMachine,
      { state: 'warming', at: 't0' },
      [{ id: 'warm_up', fires: 'warm', at: 't1' }],
    );
    // warm is declared [off, warming] -> ready — enabled from warming.
    assert.equal(trajectory[1].state, 'ready');

    const wildcard = load(`state_machine W {
  kind operational
  initial a
  states { a b fault }
  transition a -> b action go { }
  transition * -> fault action trip { }
}
`).stateMachines[0];
    const t2 = foldTrajectory(wildcard, { at: 't0' }, [
      { id: 'oops', fires: 'trip', at: 't1' },
    ]);
    assert.equal(t2[1].state, 'fault');
  });

  it('throws StateTrajectoryError on an undeclared transition action', () => {
    assert.throws(
      () =>
        foldTrajectory(machine, { at: 't0' }, [
          { id: 'x', fires: 'teleport', at: 't1' },
        ]),
      (e: unknown) =>
        e instanceof StateTrajectoryError &&
        /fires "teleport", which state machine "CGHMOperationalStates" does not declare/.test(
          (e as Error).message,
        ),
    );
  });

  it('throws StateTrajectoryError when the transition is not enabled from the current node', () => {
    // measure is ready -> measuring; it cannot fire while off.
    assert.throws(
      () =>
        foldTrajectory(machine, { at: 't0' }, [
          { id: 'measure_run', fires: 'measure', at: 't1' },
        ]),
      (e: unknown) =>
        e instanceof StateTrajectoryError &&
        /is in state "off" — no such transition is enabled/.test(
          (e as Error).message,
        ),
    );
  });
});

describe('operational-state linter (C37–C41)', () => {
  it('the clean R 144-style fixture draws no C37–C41 issues', () => {
    const issues = checkPackage(makeStatePackage(FIXTURE)).filter(i =>
      STATE_RULES.includes(i.check),
    );
    assert.deepEqual(
      issues,
      [],
      `expected no state issues, got: ${issues
        .map(e => `[${e.check}] ${e.message}`)
        .join('\n')}`,
    );
  });

  it('C37 fires when a step fires an undeclared transition action', () => {
    const dir = makeStatePackage(
      MACHINE +
        `process p {
  state CGHMOperationalStates
  does {
    start_event s
    action a { executor machine fires teleport }
    end_event e
    flow { s -> a -> e }
  }
}
`,
    );
    const c37 = checkPackage(dir).filter(i => i.check === 'C37');
    assert.equal(c37.length, 1);
    assert.equal(c37[0].severity, 'error');
    assert.ok(c37[0].message.includes('"teleport"'));
    assert.ok(c37[0].message.includes('state-fires-resolve'));
  });

  it('C37 fires when a firing step has no bound machine, and when the binding dangles', () => {
    const noBinding = makeStatePackage(
      MACHINE +
        `process p {
  does {
    start_event s
    action a { executor machine fires warm }
    end_event e
    flow { s -> a -> e }
  }
}
`,
    );
    const c37a = checkPackage(noBinding).filter(i => i.check === 'C37');
    assert.equal(c37a.length, 1);
    assert.ok(c37a[0].message.includes('binds no state machine'));

    const dangling = makeStatePackage(
      `process p {
  state GhostMachine
  does {
    start_event s
    action a { executor machine fires warm }
    end_event e
    flow { s -> a -> e }
  }
}
`,
    );
    const c37b = checkPackage(dangling).filter(i => i.check === 'C37');
    assert.equal(c37b.length, 1);
    assert.ok(c37b[0].message.includes('"GhostMachine" is not declared'));
  });

  it('C39 fires on a gate naming an undeclared state', () => {
    const dir = makeStatePackage(
      MACHINE +
        `process p {
  state CGHMOperationalStates
  preconditions {
    precondition warmed-up {
      check "ocl{self.state = #lukewarm}"
      on_violation invalid
    }
  }
}
`,
    );
    const c39 = checkPackage(dir).filter(i => i.check === 'C39');
    assert.equal(c39.length, 1);
    assert.equal(c39[0].severity, 'error');
    assert.ok(c39[0].message.includes('#lukewarm'));
    assert.ok(c39[0].message.includes('state-machine-states-referenced'));
  });

  it('C39 fires when a gating process binds no machine (or a dangling one)', () => {
    const noBinding = makeStatePackage(
      `process p {
  preconditions {
    precondition warmed-up { check "ocl{self.state = #ready}" }
  }
}
`,
    );
    const c39a = checkPackage(noBinding).filter(i => i.check === 'C39');
    assert.equal(c39a.length, 1);
    assert.ok(c39a[0].message.includes('binds no state machine'));

    const dangling = makeStatePackage(
      `process p {
  state GhostMachine
  preconditions {
    precondition warmed-up { check "ocl{self.state = #ready}" }
  }
}
`,
    );
    const c39b = checkPackage(dangling).filter(i => i.check === 'C39');
    assert.equal(c39b.length, 1);
    assert.ok(c39b[0].message.includes('"GhostMachine" is not declared'));
  });

  it('C40 fires when has.state names no declared machine', () => {
    const dir = makeStatePackage(
      `subject CGHM {
  has { state GhostMachine }
}
`,
    );
    const c40 = checkPackage(dir).filter(i => i.check === 'C40');
    assert.equal(c40.length, 1);
    assert.equal(c40[0].severity, 'error');
    assert.ok(c40[0].message.includes('"GhostMachine"'));
    assert.ok(c40[0].message.includes('anatomy-state-resolves'));
  });

  it('C38 rejects a subject has.state bound to a LIFECYCLE machine', () => {
    const dir = makeStatePackage(
      `state_machine ApplicationLifecycle {
  initial draft
  states { draft submitted }
  transition draft -> submitted action submit { }
}
subject CGHM {
  has { state ApplicationLifecycle }
}
`,
    );
    const c38 = checkPackage(dir).filter(i => i.check === 'C38');
    assert.equal(c38.length, 1);
    assert.equal(c38[0].severity, 'error');
    assert.ok(c38[0].message.includes('lifecycle state machine'));
    assert.ok(c38[0].message.includes('state-family-separation'));
    // Resolution itself succeeded — C40 stays silent for this fixture.
    assert.deepEqual(
      checkPackage(dir).filter(i => i.check === 'C40'),
      [],
    );
  });

  it('C38 rejects a lifecycle cascade into an operational machine', () => {
    const dir = makeStatePackage(
      MACHINE +
        `state_machine ApplicationLifecycle {
  initial draft
  states { draft submitted }
  transition draft -> submitted action submit {
    cascade CGHMOperationalStates {
      set { state: "off" }
    }
  }
}
`,
    );
    const c38 = checkPackage(dir).filter(i => i.check === 'C38');
    assert.equal(c38.length, 1);
    assert.equal(c38[0].severity, 'error');
    assert.ok(c38[0].message.includes('(lifecycle)'));
    assert.ok(c38[0].message.includes('"CGHMOperationalStates"'));
    assert.ok(c38[0].message.includes('state-family-separation'));
  });

  it('C38 rejects an operational cascade into a lifecycle machine', () => {
    const dir = makeStatePackage(
      `state_machine ApplicationLifecycle {
  initial draft
  states { draft submitted }
  transition draft -> submitted action submit { }
}
state_machine CGHMOperationalStates {
  kind operational
  initial off
  states { off ready }
  transition off -> ready action warm {
    cascade ApplicationLifecycle {
      set { state: "submitted" }
    }
  }
}
`,
    );
    const c38 = checkPackage(dir).filter(i => i.check === 'C38');
    assert.equal(c38.length, 1);
    assert.equal(c38[0].severity, 'error');
    assert.ok(c38[0].message.includes('(operational)'));
    assert.ok(c38[0].message.includes('"ApplicationLifecycle"'));
    assert.ok(c38[0].message.includes('state-family-separation'));
  });

  it('same-family cascades and unbound families stay silent on C38', () => {
    // A lifecycle cascade into a plain data class (AuditEvent) is the v2
    // pattern, not a cross-family reference.
    const dir = makeStatePackage(
      MACHINE +
        `state_machine ApplicationLifecycle {
  initial draft
  states { draft submitted }
  transition draft -> submitted action submit {
    cascade AuditEvent {
      create { action: "submitted" actor: "ia" }
    }
  }
}
subject CGHM {
  has { state CGHMOperationalStates }
}
`,
    );
    assert.deepEqual(
      checkPackage(dir).filter(i => STATE_RULES.includes(i.check)),
      [],
    );
  });
});

describe('C41 precondition-on-violation-known', () => {
  it('on_violation fail on a STATE GATE always warns, naming the doctrine', () => {
    const dir = makeStatePackage(
      MACHINE +
        `process p {
  state CGHMOperationalStates
  preconditions {
    precondition warmed-up {
      check "ocl{self.state = #ready}"
      on_violation fail
    }
  }
}
`,
    );
    const c41 = checkPackage(dir).filter(i => i.check === 'C41');
    assert.equal(c41.length, 1);
    assert.equal(c41[0].severity, 'warning');
    assert.ok(c41[0].message.includes('"warmed-up"'));
    assert.ok(c41[0].message.includes('never fails the instrument'));
    assert.ok(c41[0].message.includes('precondition-on-violation-known'));
  });

  it('on_violation invalid on a state gate is silent', () => {
    // The clean fixture's gate declares `on_violation invalid` — C41
    // stays silent (STATE_RULES now includes C41, so the clean-fixture
    // test above asserts this too; pinned here explicitly).
    const issues = checkPackage(makeStatePackage(FIXTURE)).filter(
      i => i.check === 'C41',
    );
    assert.deepEqual(issues, []);
  });

  it('an unknown on_violation value warns', () => {
    const dir = makeStatePackage(
      MACHINE +
        `process p {
  state CGHMOperationalStates
  preconditions {
    precondition count-sufficient {
      check "ocl{measurement_count >= 100}"
      on_violation explode
    }
  }
}
`,
    );
    const c41 = checkPackage(dir).filter(i => i.check === 'C41');
    assert.equal(c41.length, 1);
    assert.equal(c41[0].severity, 'warning');
    assert.ok(c41[0].message.includes('"explode"'));
    assert.ok(c41[0].message.includes('the only known outcome is "invalid"'));
  });

  it('fail on a NON-state-gate precondition warns generically, without the doctrine', () => {
    const dir = makeStatePackage(
      MACHINE +
        `process p {
  state CGHMOperationalStates
  preconditions {
    precondition count-sufficient {
      check "ocl{measurement_count >= 100}"
      on_violation fail
    }
  }
}
`,
    );
    const c41 = checkPackage(dir).filter(i => i.check === 'C41');
    assert.equal(c41.length, 1);
    assert.equal(c41[0].severity, 'warning');
    assert.ok(c41[0].message.includes('the only known outcome is "invalid"'));
    assert.ok(!c41[0].message.includes('never fails the instrument'));
  });

  it('covers conformance-test preconditions too', () => {
    const dir = makeStatePackage(
      `conformance_test T {
  preconditions {
    precondition temperature-stability {
      check "ocl{temperature_variation <= 2}"
      on_violation fail
    }
  }
}
`,
    );
    const c41 = checkPackage(dir).filter(i => i.check === 'C41');
    assert.equal(c41.length, 1);
    assert.equal(c41[0].severity, 'warning');
    assert.ok(c41[0].message.includes('conformance_test T'));
    assert.ok(c41[0].message.includes('"temperature-stability"'));
  });
});
