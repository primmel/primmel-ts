// ─────────────────────────────────────────────────────────────────────
// Process model extensions (Primmel v3, TODO.roadmap/02) — abstract and
// executable process forms, the full step vocabulary with executor
// typing, preconditions, per-classification instances, flow edges with
// OCL conditions, and the C10–C14 linter rules.
//
// Fixtures:
//   CREEP_METHOD  — an ABSTRACT process (signature + invariants +
//                   preconditions, no `does` body): always valid.
//   CREEP_RUN     — its EXECUTABLE refinement (R 60-style creep method
//                   sketch): does body, executor-typed steps, a gateway
//                   with OCL-conditioned edges, per-class instances.
//   REVERIFICATION — a timer recurrence sketch: timer_event with a
//                   period closing the self-loop, plus a signal_event.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const CREEP_METHOD = `
process creep_method {
  name "Creep test method (R 60-2, 2.7.3)"
  signature {
    in { applied_load : mass duration : time }
    out { indication_series : mass_series }
  }
  invariants {
    "ocl{self.applied_load <= self.e_max}"
  }
  preconditions {
    precondition warmed-up {
      check "ocl{self.state = #ready and self.warmed_up}"
      description "Run-validity: an unwarmed run is invalid, never a fail."
      on_violation invalid
    }
  }
  executor lab
  registers { conditions_log : text }
  state OperationalStates
}
`;

const CREEP_RUN = `
process creep_run {
  name "Creep test run — executable refinement of creep_method"
  signature {
    in { applied_load : mass duration : time }
    out { indication_series : mass_series }
  }
  preconditions {
    precondition warmed-up {
      check "ocl{self.state = #ready}"
      on_violation invalid
    }
  }
  executor lab
  registers { conditions_log : text indication_series : mass_series }
  instances {
    by accuracy_class
    values { A { n_runs: 5 } B { n_runs: 5 } C { n_runs: 3 } D { n_runs: 3 } }
  }
  does {
    start_event s
    action stabilize { executor actor role lab_technician capture stabilization_form write { conditions_log } }
    action apply_load { executor actor role lab_technician capture load_form read { applied_load } }
    action hold { executor machine wait duration }
    action record { executor machine read { applied_load } write { indication_series } }
    gateway enough
    end_event done
    end_event aborted
    flow {
      s -> stabilize -> apply_load -> hold -> record -> enough
      enough -> done { when "ocl{self.indication_series->size() >= self.n_runs}" }
      enough -> aborted
    }
  }
}
`;

const REVERIFICATION = `
process reverification {
  name "Periodic re-verification"
  signature {
    in { last_verdict : verdict }
    out { re_verdict : verdict }
  }
  registers { re_verdict : verdict }
  does {
    start_event issued
    action initial_verify { executor machine read { last_verdict } write { re_verdict } }
    timer_event every_12m { period "P12M" }
    signal_event tyre_change { signal "tyre-changed" }
    action reverify { executor actor role lab_technician capture reverify_form read { last_verdict } write { re_verdict } }
    end_event withdrawn
    flow {
      issued -> initial_verify -> every_12m
      every_12m -> reverify
      reverify -> every_12m
      tyre_change -> reverify
      reverify -> withdrawn { when "ocl{self.re_verdict = #fail}" }
    }
  }
}
`;

/** All eight step kinds in one body (round-trip + vocabulary coverage). */
const VOCABULARY = `
process vocabulary {
  registers { x : dimensionless }
  does {
    start_event s
    action a { executor machine }
    approval sign { executor actor role reviewer capture sign_form }
    gateway g
    parallel_gateway both
    timer_event t { period "P1M" }
    signal_event sig { signal "go" }
    end_event e
    flow {
      s -> a -> sign -> both
      both -> g
      both -> sig
      sig -> g
      g -> t { when "ocl{self.x}" }
      g -> e
      t -> a
    }
  }
}
`;

function makeProcessPackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-proc-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'process.prl'), body);
  return dir;
}

describe('v3 process — abstract form (signature + invariants)', () => {
  it('parses signature, invariants, preconditions, executor, registers, state', () => {
    const m = load(CREEP_METHOD);
    const p = m.processes.find(x => x.id === 'creep_method')!;
    assert.ok(p);

    assert.deepEqual(p.signature, {
      inputs: [
        { name: 'applied_load', type: 'mass' },
        { name: 'duration', type: 'time' },
      ],
      outputs: [{ name: 'indication_series', type: 'mass_series' }],
    });
    assert.deepEqual(p.invariants, ['ocl{self.applied_load <= self.e_max}']);
    assert.equal(p.preconditions.length, 1);
    assert.deepEqual(p.preconditions[0], {
      id: 'warmed-up',
      check: 'ocl{self.state = #ready and self.warmed_up}',
      description: 'Run-validity: an unwarmed run is invalid, never a fail.',
      onViolation: 'invalid',
    });
    assert.equal(p.executor, 'lab');
    assert.deepEqual(p.registers, [{ name: 'conditions_log', type: 'text' }]);
    assert.equal(p.state, 'OperationalStates');
    assert.equal(p.instances, null);
    // No does body — the abstract form.
    assert.equal(p.does, null);
  });

  it('round-trips the abstract process losslessly (fixpoint)', () => {
    const m1 = load(CREEP_METHOD);
    const dumped = dump(m1);
    assert.ok(dumped.includes('signature {'));
    assert.ok(dumped.includes('preconditions {'));
    const m2 = load(dumped);
    assert.deepEqual(m2.processes, m1.processes);
    assert.equal(dump(m2), dumped);
  });

  it('an abstract process is always valid (no C10–C14 issues)', () => {
    const dir = makeProcessPackage(CREEP_METHOD);
    const issues = checkPackage(dir).filter(i =>
      ['C10', 'C11', 'C12', 'C13', 'C14'].includes(i.check),
    );
    assert.deepEqual(issues, []);
  });
});

describe('v3 process — executable form (does body)', () => {
  it('parses steps with executor typing and per-class instances', () => {
    const m = load(CREEP_RUN);
    const p = m.processes.find(x => x.id === 'creep_run')!;
    assert.ok(p.does);
    const flow = p.does!;

    assert.equal(flow.steps.length, 8);
    const byId = new Map(flow.steps.map(s => [s.id, s]));

    assert.equal(byId.get('s')!.kind, 'start_event');
    const stabilize = byId.get('stabilize')!;
    assert.equal(stabilize.kind, 'action');
    assert.equal(stabilize.executor, 'actor');
    assert.equal(stabilize.role, 'lab_technician');
    assert.equal(stabilize.capture, 'stabilization_form');
    assert.deepEqual(stabilize.writes, ['conditions_log']);

    const hold = byId.get('hold')!;
    assert.equal(hold.executor, 'machine');
    assert.equal(hold.wait, 'duration');

    const record = byId.get('record')!;
    assert.deepEqual(record.reads, ['applied_load']);
    assert.deepEqual(record.writes, ['indication_series']);

    assert.equal(byId.get('enough')!.kind, 'gateway');
    assert.equal(byId.get('done')!.kind, 'end_event');

    // Chained flow + one conditioned edge.
    assert.equal(flow.edges.length, 7);
    assert.deepEqual(flow.edges[0], {
      from: 's',
      to: 'stabilize',
      condition: '',
    });
    assert.deepEqual(flow.edges[5], {
      from: 'enough',
      to: 'done',
      condition: 'ocl{self.indication_series->size() >= self.n_runs}',
    });
    assert.deepEqual(flow.edges[6], {
      from: 'enough',
      to: 'aborted',
      condition: '',
    });

    // Per-classification instances (R 60: n_runs A/B=5, C/D=3).
    assert.deepEqual(p.instances, {
      by: 'accuracy_class',
      values: {
        A: { n_runs: 5 },
        B: { n_runs: 5 },
        C: { n_runs: 3 },
        D: { n_runs: 3 },
      },
    });
  });

  it('round-trips the executable process losslessly (fixpoint)', () => {
    const m1 = load(CREEP_RUN);
    const dumped = dump(m1);
    assert.ok(dumped.includes('does {'));
    assert.ok(dumped.includes('gateway enough'));
    assert.ok(
      dumped.includes(
        'enough -> done { when "ocl{self.indication_series->size() >= self.n_runs}" }',
      ),
    );
    const m2 = load(dumped);
    assert.deepEqual(m2.processes, m1.processes);
    assert.equal(dump(m2), dumped);
  });

  it('parses a timer recurrence with a signal trigger', () => {
    const m = load(REVERIFICATION);
    const p = m.processes[0];
    const flow = p.does!;
    const byId = new Map(flow.steps.map(s => [s.id, s]));

    const timer = byId.get('every_12m')!;
    assert.equal(timer.kind, 'timer_event');
    assert.equal(timer.period, 'P12M');

    const sig = byId.get('tyre_change')!;
    assert.equal(sig.kind, 'signal_event');
    assert.equal(sig.signal, 'tyre-changed');

    // The self-loop reverify → every_12m → reverify exists in the flow.
    assert.ok(
      flow.edges.some(e => e.from === 'reverify' && e.to === 'every_12m'),
    );
    assert.ok(
      flow.edges.some(e => e.from === 'every_12m' && e.to === 'reverify'),
    );
  });

  it('round-trips the recurrence fixture losslessly (fixpoint)', () => {
    const m1 = load(REVERIFICATION);
    const dumped = dump(m1);
    assert.ok(dumped.includes('timer_event every_12m { period P12M }'));
    assert.ok(
      dumped.includes('signal_event tyre_change { signal tyre-changed }'),
    );
    const m2 = load(dumped);
    assert.deepEqual(m2.processes, m1.processes);
    assert.equal(dump(m2), dumped);
  });

  it('round-trips all eight step kinds (fixpoint)', () => {
    const m1 = load(VOCABULARY);
    const p = m1.processes[0];
    const kinds = p.does!.steps.map(s => s.kind);
    assert.deepEqual(kinds, [
      'start_event',
      'action',
      'approval',
      'gateway',
      'parallel_gateway',
      'timer_event',
      'signal_event',
      'end_event',
    ]);
    const dumped = dump(m1);
    assert.ok(dumped.includes('parallel_gateway both'));
    assert.ok(
      dumped.includes(
        'approval sign { executor actor role reviewer capture sign_form }',
      ),
    );
    const m2 = load(dumped);
    assert.deepEqual(m2.processes, m1.processes);
    assert.equal(dump(m2), dumped);
  });

  it('clean executable fixtures draw no C10–C14 issues', () => {
    const dir = makeProcessPackage(
      CREEP_RUN + '\n' + REVERIFICATION + '\n' + VOCABULARY,
    );
    const issues = checkPackage(dir).filter(i =>
      ['C10', 'C11', 'C12', 'C13', 'C14'].includes(i.check),
    );
    assert.deepEqual(
      issues,
      [],
      `expected no process issues, got: ${issues
        .map(e => `[${e.check}] ${e.message}`)
        .join('\n')}`,
    );
  });

  it('leaves plain v2 processes untouched (v3 fields default)', () => {
    const m = load(`process Legacy {
  name "Legacy v2 process"
}
`);
    const p = m.processes[0];
    assert.equal(p.name, 'Legacy v2 process');
    assert.equal(p.signature, null);
    assert.deepEqual(p.invariants, []);
    assert.deepEqual(p.preconditions, []);
    assert.equal(p.executor, '');
    assert.deepEqual(p.registers, []);
    assert.equal(p.state, '');
    assert.equal(p.instances, null);
    assert.equal(p.does, null);
    // A v2 process draws no linter issues either.
    const dir = makeProcessPackage(`process Legacy {
  name "Legacy v2 process"
}
`);
    assert.deepEqual(
      checkPackage(dir).filter(i =>
        ['C10', 'C11', 'C12', 'C13', 'C14'].includes(i.check),
      ),
      [],
    );
  });
});

describe('v3 process linter (C10–C14)', () => {
  it('C10 fires when the start event is missing or duplicated', () => {
    const missing = makeProcessPackage(`process p {
  does {
    action a { executor machine }
    end_event e
    flow { a -> e }
  }
}
`);
    const c10 = checkPackage(missing).filter(i => i.check === 'C10');
    assert.equal(c10.length, 1);
    assert.ok(c10[0].message.includes('0 start events'));
    assert.equal(c10[0].severity, 'error');

    const duplicated = makeProcessPackage(`process p {
  does {
    start_event s1
    start_event s2
    action a { executor machine }
    end_event e
    flow { s1 -> a s2 -> a a -> e }
  }
}
`);
    const c10b = checkPackage(duplicated).filter(i => i.check === 'C10');
    assert.equal(c10b.length, 1);
    assert.ok(c10b[0].message.includes('2 start events'));
  });

  it('C11 fires on a terminal path with no end event', () => {
    const dir = makeProcessPackage(`process p {
  does {
    start_event s
    action a { executor machine }
    flow { s -> a }
  }
}
`);
    const c11 = checkPackage(dir).filter(i => i.check === 'C11');
    assert.equal(c11.length, 1);
    assert.ok(c11[0].message.includes('"a"'));
    assert.ok(c11[0].message.includes('end_event'));
    assert.equal(c11[0].severity, 'error');
  });

  it('C11 fires on a flow edge to an undeclared step', () => {
    const dir = makeProcessPackage(`process p {
  does {
    start_event s
    end_event e
    flow { s -> e s -> ghost }
  }
}
`);
    const c11 = checkPackage(dir).filter(i => i.check === 'C11');
    assert.ok(c11.some(i => i.message.includes('"ghost"')));
  });

  it('C12 fires on a gateway edge condition over an undeclared register', () => {
    const dir = makeProcessPackage(`process p {
  registers { x : dimensionless }
  does {
    start_event s
    gateway g
    end_event e
    end_event f
    flow {
      s -> g
      g -> e { when "ocl{self.bogus > 1}" }
      g -> f
    }
  }
}
`);
    const issues = checkPackage(dir);
    const c12 = issues.filter(i => i.check === 'C12');
    assert.equal(c12.length, 1);
    assert.ok(c12[0].message.includes('"bogus"'));
    assert.equal(c12[0].severity, 'error');
    // The declared register x and the unconditioned edge stay silent.
  });

  it('C12 fires on step I/O naming an undeclared register', () => {
    const dir = makeProcessPackage(`process p {
  does {
    start_event s
    action a { executor machine write { bogus_reg } }
    end_event e
    flow { s -> a -> e }
  }
}
`);
    const c12 = checkPackage(dir).filter(i => i.check === 'C12');
    assert.equal(c12.length, 1);
    assert.ok(c12[0].message.includes('"bogus_reg"'));
  });

  it('C13 fires when an OUT parameter is never written (error) and an IN is never read (warning)', () => {
    const dir = makeProcessPackage(`process p {
  signature {
    in { applied : mass unused_in : mass }
    out { result : mass }
  }
  registers { result : mass }
  does {
    start_event s
    action a { executor machine read { applied } }
    end_event e
    flow { s -> a -> e }
  }
}
`);
    const c13 = checkPackage(dir).filter(i => i.check === 'C13');
    const errors = c13.filter(i => i.severity === 'error');
    const warnings = c13.filter(i => i.severity === 'warning');
    assert.equal(errors.length, 1);
    assert.ok(errors[0].message.includes('"result"'));
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].message.includes('"unused_in"'));
  });

  it('C14 fires on a self-loop without a timer event', () => {
    const dir = makeProcessPackage(`process p {
  does {
    start_event s
    action a { executor machine }
    action b { executor machine }
    end_event e
    flow {
      s -> a
      a -> b
      b -> a
      b -> e
    }
  }
}
`);
    const c14 = checkPackage(dir).filter(i => i.check === 'C14');
    assert.equal(c14.length, 1);
    assert.ok(c14[0].message.includes('no timer event'));
    assert.equal(c14[0].severity, 'error');
  });

  it('C14 fires on a direct self-loop edge', () => {
    const dir = makeProcessPackage(`process p {
  does {
    start_event s
    action a { executor machine }
    end_event e
    flow {
      s -> a
      a -> a
      a -> e
    }
  }
}
`);
    const c14 = checkPackage(dir).filter(i => i.check === 'C14');
    assert.equal(c14.length, 1);
    assert.ok(c14[0].message.includes('a → a'));
  });

  it('a loop closed through a timer event stays silent on C14', () => {
    const dir = makeProcessPackage(REVERIFICATION);
    const c14 = checkPackage(dir).filter(i => i.check === 'C14');
    assert.deepEqual(c14, []);
  });
});

describe('v3 process parser robustness', () => {
  it('rejects a fused arrow chain (s->a->e) with a clear parse error', () => {
    assert.throws(
      () =>
        load(`process p {
  does {
    start_event s
    action a { executor machine }
    end_event e
    flow { s->a->e }
  }
}
`),
      /flow edge "s->a->e" contains a fused arrow — separate steps and "->" with whitespace/,
    );
  });

  it('rejects a fused unicode arrow chain (s→a→e)', () => {
    assert.throws(
      () =>
        load(`process p {
  does {
    start_event s
    action a { executor machine }
    end_event e
    flow { s→a→e }
  }
}
`),
      /flow edge "s→a→e" contains a fused arrow/,
    );
  });

  it('rejects a partially fused hop (a ->b)', () => {
    assert.throws(
      () =>
        load(`process p {
  does {
    start_event s
    end_event e
    flow { s ->e }
  }
}
`),
      /flow edge "->e" contains a fused arrow/,
    );
  });

  it('spaced chains and OCL `->` inside a when condition stay clean', () => {
    const m = load(`process p {
  registers { x : dimensionless }
  does {
    start_event s
    gateway g
    end_event e
    end_event f
    flow {
      s -> g
      g -> e { when "ocl{self.x->size() > 1}" }
      g -> f
    }
  }
}
`);
    const flow = m.processes[0].does!;
    assert.equal(flow.edges.length, 3);
    assert.deepEqual(flow.edges[1], {
      from: 'g',
      to: 'e',
      condition: 'ocl{self.x->size() > 1}',
    });
  });

  it('an unknown `kw value { block }` entry in a step body does not misalign the walk', () => {
    const m = load(`process p {
  does {
    start_event s
    action a { executor actor future_hint draft { note "v" } role lab_technician }
    action b { note_block { x y } executor machine }
    end_event e
    flow { s -> a -> b -> e }
  }
}
`);
    const byId = new Map(m.processes[0].does!.steps.map(s => [s.id, s]));
    // `future_hint draft { note "v" }` skipped whole — role still lands.
    assert.equal(byId.get('a')!.executor, 'actor');
    assert.equal(byId.get('a')!.role, 'lab_technician');
    // `note_block { x y }` (bare block, no value) skipped — executor lands.
    assert.equal(byId.get('b')!.executor, 'machine');
  });

  it('an unknown `kw value { block }` entry in preconditions does not misalign the walk', () => {
    const m = load(`process p {
  preconditions {
    future_entry meta { tag "v" }
    precondition warmed { check "ocl{self.x}" on_violation invalid }
  }
}
`);
    assert.equal(m.processes[0].preconditions.length, 1);
    assert.deepEqual(m.processes[0].preconditions[0], {
      id: 'warmed',
      check: 'ocl{self.x}',
      description: '',
      onViolation: 'invalid',
    });
  });
});
