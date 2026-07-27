// ─────────────────────────────────────────────────────────────────────
// Composition signature checks (TODO.roadmap/38) — typed transition
// boundaries. Transitions compose (∘: t₁: A→B, t₂: B→C ⊢ t₂∘t₁: A→C)
// only when the upstream output signature covers the downstream input
// signature. The kernel already declares the signatures (task 02's
// signature/registers parameter types) and the quantity typing (task
// 06's quantity_register kinds/units); these are the checks:
//
//   C74 process-io-type-coherence — one name carries ONE type across the
//       signature/register declaration positions (kinds resolved through
//       the quantity register; a unit token resolves to its kind).
//   C75 process-flow-io-cover — the step-chain dataflow: a read with no
//       writer on every incoming path (and no provided IN/instance/state
//       home) is an error; a write no step reads, no edge condition
//       references, and no OUT parameter names is a dead-output warning
//       (a capture-step write lands in evidence — never dead).
//   C76 subprocess-signature-bound — a `calls <p> { with { in / out } }`
//       step binds the callee's declared signature completely and
//       kind-compatibly; the callee resolves against the composed
//       process set, so a call across a `uses` boundary checks the same.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const REGISTER = `
quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg description "Mass." }
  kind time { dimensions { T 1 } si_unit s }
  kind dimensionless { dimensions { } si_unit "1" }
  unit kg { symbol "kg" label "kilogram" kind mass factor 1 }
  unit s { symbol "s" label "second" kind time factor 1 }
}
`;

const CALLEE = `
process callee {
  name "Creep method (the callee)"
  signature {
    in { applied_load : mass duration : time }
    out { indication_series : mass_series }
  }
}
`;

/** A complete, kind-compatible call bound into a clean dataflow. */
const CALLER_CLEAN = `
process caller {
  name "Caller — clean boundary"
  signature {
    in { test_load : mass soak : time }
    out { raw : mass_series }
  }
  registers { raw : mass_series }
  does {
    start_event s
    action run {
      executor machine
      read { test_load soak }
      calls callee {
        with {
          in { applied_load : test_load duration : soak }
          out { indication_series : raw }
        }
      }
      write { raw }
    }
    end_event e
    flow { s -> run -> e }
  }
}
`;

const dirs = new Map<string, string>();

function makePackage(files: Record<string, string>, manifest?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-cmp-'));
  writeFileSync(
    join(dir, 'package.primmel'),
    manifest ?? 'package { id test }',
  );
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

/** A single-package fixture: the SI register plus one process file. */
function makeProcessPackage(body: string): string {
  return makePackage({
    'model/register.prl': REGISTER,
    'model/process.prl': body,
  });
}

const boundaryIssues = (dir: string) =>
  checkPackage(dir).filter(i => ['C74', 'C75', 'C76'].includes(i.check));

describe('calls syntax (parse + round-trip)', () => {
  it('parses a calls step with its with { in / out } bindings', () => {
    const m = load(CALLER_CLEAN);
    const p = m.processes.find(x => x.id === 'caller')!;
    const run = p.does!.steps.find(s => s.id === 'run')!;
    assert.equal(run.calls, 'callee');
    assert.deepEqual(run.callIn, [
      { param: 'applied_load', bind: 'test_load' },
      { param: 'duration', bind: 'soak' },
    ]);
    assert.deepEqual(run.callOut, [
      { param: 'indication_series', bind: 'raw' },
    ]);
  });

  it('round-trips the calls step losslessly (fixpoint)', () => {
    const m1 = load(CALLEE + '\n' + CALLER_CLEAN);
    const dumped = dump(m1);
    assert.ok(dumped.includes('calls callee'));
    assert.ok(dumped.includes('with {'));
    const m2 = load(dumped);
    assert.deepEqual(m2.processes, m1.processes);
    assert.equal(dump(m2), dumped);
  });

  it('a bare `calls <p>` (no with block) parses and round-trips', () => {
    const m1 = load(`process p {
  does {
    start_event s
    action a { executor machine calls legacy_helper }
    end_event e
    flow { s -> a -> e }
  }
}
process legacy_helper { name "No signature" }
`);
    const a = m1.processes[0].does!.steps.find(s => s.id === 'a')!;
    assert.equal(a.calls, 'legacy_helper');
    assert.deepEqual(a.callIn, []);
    assert.deepEqual(a.callOut, []);
    const dumped = dump(m1);
    assert.deepEqual(load(dumped).processes, m1.processes);
    assert.equal(dump(load(dumped)), dumped);
  });
});

describe('C74 process-io-type-coherence', () => {
  it('a name declared with conflicting kinds fails (mass written, time read)', () => {
    const dir = makeProcessPackage(`process p {
  signature { out { indication : mass } }
  registers { indication : time }
  does {
    start_event s
    action a { executor machine write { indication } }
    action b { executor machine read { indication } }
    end_event e
    flow { s -> a -> b -> e }
  }
}
`);
    const c74 = checkPackage(dir).filter(i => i.check === 'C74');
    assert.equal(c74.length, 1);
    assert.ok(c74[0].message.includes('"indication"'));
    assert.ok(c74[0].message.includes('signature out "mass"'));
    assert.ok(c74[0].message.includes('registers "time"'));
    assert.equal(c74[0].severity, 'error');
  });

  it('fires on the abstract form too (declaration-level rule)', () => {
    const dir = makeProcessPackage(`process p {
  signature { in { x : mass } }
  registers { x : time }
}
`);
    const c74 = checkPackage(dir).filter(i => i.check === 'C74');
    assert.equal(c74.length, 1);
  });

  it('a unit token coheres with its kind (mass vs kg passes; mass vs s fails)', () => {
    const coherent = makeProcessPackage(`process p {
  signature { out { x : mass } }
  registers { x : kg }
}
`);
    assert.deepEqual(
      checkPackage(coherent).filter(i => i.check === 'C74'),
      [],
    );
    const incoherent = makeProcessPackage(`process p {
  signature { out { x : mass } }
  registers { x : s }
}
`);
    const c74 = checkPackage(incoherent).filter(i => i.check === 'C74');
    assert.equal(c74.length, 1);
    assert.ok(c74[0].message.includes('kg') === false); // kinds, not units
  });

  it('an untyped declaration composes with anything (gradual typing)', () => {
    const dir = makeProcessPackage(`process p {
  signature { out { x : mass } }
  registers { x }
}
`);
    assert.deepEqual(
      checkPackage(dir).filter(i => i.check === 'C74'),
      [],
    );
  });

  it('the clean caller/callee fixture draws no C74–C76 issues and no errors', () => {
    const dir = makeProcessPackage(CALLEE + '\n' + CALLER_CLEAN);
    assert.deepEqual(boundaryIssues(dir), []);
    const errors = checkPackage(dir).filter(i => i.severity === 'error');
    assert.deepEqual(
      errors,
      [],
      `expected zero errors, got: ${errors.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
    );
  });
});

describe('C75 process-flow-io-cover', () => {
  it('a read of a never-written register fails', () => {
    const dir = makeProcessPackage(`process p {
  registers { x : mass }
  does {
    start_event s
    action a { executor machine read { x } }
    end_event e
    flow { s -> a -> e }
  }
}
`);
    const c75 = checkPackage(dir).filter(i => i.check === 'C75');
    assert.equal(c75.length, 1);
    assert.ok(c75[0].message.includes('"a" reads "x"'));
    assert.equal(c75[0].severity, 'error');
  });

  it('a read covered on only one of two incoming paths fails', () => {
    const dir = makeProcessPackage(`process p {
  registers { x : mass }
  does {
    start_event s
    action a { executor machine write { x } }
    action b { executor machine }
    action c { executor machine read { x } }
    end_event e
    flow { s -> a -> c  s -> b -> c  c -> e }
  }
}
`);
    const c75 = checkPackage(dir).filter(i => i.check === 'C75');
    assert.equal(c75.length, 1);
    assert.ok(c75[0].message.includes('"c" reads "x"'));
  });

  it('a read covered on every incoming path passes', () => {
    const dir = makeProcessPackage(`process p {
  registers { x : mass }
  does {
    start_event s
    action a { executor machine write { x } }
    action b { executor machine write { x } }
    action c { executor machine read { x } }
    end_event e
    flow { s -> a -> c  s -> b -> c  c -> e }
  }
}
`);
    assert.deepEqual(boundaryIssues(dir), []);
  });

  it('an edge-condition read of a never-written register fails; a provided IN read passes', () => {
    const dir = makeProcessPackage(`process p {
  signature { in { threshold : mass } }
  registers { x : mass }
  does {
    start_event s
    action a { executor machine }
    gateway g
    end_event e
    end_event f
    flow {
      s -> a -> g
      g -> e { when "ocl{self.x > self.threshold}" }
      g -> f
    }
  }
}
`);
    const c75 = checkPackage(dir).filter(i => i.check === 'C75');
    assert.equal(c75.length, 1);
    assert.ok(c75[0].message.includes('"g"'));
    assert.ok(c75[0].message.includes('"x"'));
    assert.ok(!c75[0].message.includes('threshold'));
  });

  it('provided names (IN parameters, instance values, state) need no writer', () => {
    const dir = makeProcessPackage(`process p {
  signature { in { applied_load : mass } }
  registers { count : dimensionless }
  instances {
    by accuracy_class
    values { A { n_runs: 5 } }
  }
  does {
    start_event s
    action a { executor machine read { applied_load n_runs } write { count } }
    gateway g
    end_event e
    flow {
      s -> a -> g
      g -> e { when "ocl{self.count >= self.n_runs and self.state = #ready}" }
      g -> e
    }
  }
}
`);
    assert.deepEqual(boundaryIssues(dir), []);
  });

  it('a write with no reader is a dead-output warning', () => {
    const dir = makeProcessPackage(`process p {
  registers { x : mass y : mass }
  does {
    start_event s
    action a { executor machine write { x } }
    action b { executor machine read { x } write { y } }
    end_event e
    flow { s -> a -> b -> e }
  }
}
`);
    const c75 = checkPackage(dir).filter(i => i.check === 'C75');
    assert.equal(c75.length, 1);
    assert.equal(c75[0].severity, 'warning');
    assert.ok(c75[0].message.includes('"b" writes "y"'));
    assert.ok(c75[0].message.includes('dead output'));
  });

  it('a capture-step write lands in evidence — never dead; an OUT write is not dead either', () => {
    const dir = makeProcessPackage(`process p {
  signature { out { result : mass } }
  registers { conditions_log : text result : mass }
  does {
    start_event s
    action stabilize { executor actor role tech capture stab_form write { conditions_log } }
    action record { executor machine write { result } }
    end_event e
    flow { s -> stabilize -> record -> e }
  }
}
`);
    assert.deepEqual(boundaryIssues(dir), []);
  });

  it('a recurrence through a timer keeps its cover (fixpoint on the cycle)', () => {
    const dir = makeProcessPackage(`process p {
  signature { in { last_verdict : verdict } out { re_verdict : verdict } }
  registers { re_verdict : verdict }
  does {
    start_event issued
    action initial_verify { executor machine read { last_verdict } write { re_verdict } }
    timer_event every_12m { period "P12M" }
    signal_event tyre_change { signal "tyre-changed" }
    action reverify { executor machine read { last_verdict } write { re_verdict } }
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
`);
    assert.deepEqual(boundaryIssues(dir), []);
  });
});

describe('C76 subprocess-signature-bound', () => {
  const callerWith = (withBlock: string) => `process caller {
  signature { in { test_load : mass soak : time } out { raw : mass_series } }
  registers { raw : mass_series when : time }
  does {
    start_event s
    action run {
      executor machine
      read { test_load soak }
      calls callee ${withBlock}
      write { raw }
    }
    end_event e
    flow { s -> run -> e }
  }
}
`;

  it('a call naming no declared process fails', () => {
    const dir = makeProcessPackage(`process p {
  does {
    start_event s
    action a { executor machine calls ghost }
    end_event e
    flow { s -> a -> e }
  }
}
`);
    const c76 = checkPackage(dir).filter(i => i.check === 'C76');
    assert.equal(c76.length, 1);
    assert.ok(c76[0].message.includes('"ghost"'));
    assert.equal(c76[0].severity, 'error');
  });

  it('a signature-carrying callee called with NO with block fails on every parameter', () => {
    const dir = makeProcessPackage(CALLEE + '\n' + callerWith(''));
    const c76 = checkPackage(dir).filter(i => i.check === 'C76');
    // 2 unbound IN + 1 unmapped OUT
    assert.equal(c76.length, 3);
    assert.ok(c76.some(i => i.message.includes('IN parameter "applied_load"')));
    assert.ok(c76.some(i => i.message.includes('IN parameter "duration"')));
    assert.ok(
      c76.some(i => i.message.includes('OUT parameter "indication_series"')),
    );
  });

  it('a missing IN binding, a phantom binding, and a duplicate binding each fail', () => {
    // missing duration; phantom speed; applied_load bound twice
    const dir = makeProcessPackage(
      CALLEE +
        '\n' +
        callerWith(`{
        with {
          in { applied_load : test_load applied_load : soak speed : soak }
          out { indication_series : raw }
        }
      }`),
    );
    const c76 = checkPackage(dir).filter(i => i.check === 'C76');
    assert.ok(
      c76.some(i => i.message.includes('IN parameter "duration" is not bound')),
      'missing IN caught',
    );
    assert.ok(
      c76.some(i => i.message.includes('bound 2 times')),
      'duplicate binding caught',
    );
    assert.ok(
      c76.some(i =>
        i.message.includes('"speed" is not a declared IN parameter'),
      ),
      'phantom binding caught',
    );
  });

  it('a kind-incompatible binding fails (time register feeding a mass input)', () => {
    const dir = makeProcessPackage(
      CALLEE +
        '\n' +
        callerWith(`{
        with {
          in { applied_load : when duration : soak }
          out { indication_series : raw }
        }
      }`),
    );
    const c76 = checkPackage(dir).filter(i => i.check === 'C76');
    assert.equal(c76.length, 1);
    assert.ok(c76[0].message.includes('"when" (time)'));
    assert.ok(c76[0].message.includes('"applied_load" (mass)'));
    assert.ok(c76[0].message.includes('not kind-compatible'));
  });

  it('a kind-incompatible OUT mapping fails; a unit-vs-kind match passes', () => {
    const bad = makeProcessPackage(
      `process callee {
  signature { in { applied_load : mass } out { indication : mass } }
}
process caller {
  registers { load : kg note : text }
  does {
    start_event s
    action run {
      executor machine
      calls callee {
        with {
          in { applied_load : load }
          out { indication : note }
        }
      }
    }
    end_event e
    flow { s -> run -> e }
  }
}
`,
    );
    const c76 = checkPackage(bad).filter(i => i.check === 'C76');
    assert.equal(c76.length, 1);
    assert.ok(c76[0].message.includes('OUT parameter "indication"'));
    // The kg register feeding the mass IN is kind-coherent — no IN issue.
    assert.ok(!c76.some(i => i.message.includes('"applied_load"')));
  });

  it('a with block on a signature-less callee fails; a bare call to it passes', () => {
    const noSig = `process helper { name "No signature" }\n`;
    const bound = makeProcessPackage(
      noSig +
        `process p {
  does {
    start_event s
    action a { executor machine calls helper { with { in { x : y } } } }
    end_event e
    flow { s -> a -> e }
  }
}
`,
    );
    const c76 = checkPackage(bound).filter(i => i.check === 'C76');
    assert.equal(c76.length, 1);
    assert.ok(c76[0].message.includes('declares no signature'));

    const bare = makeProcessPackage(
      noSig +
        `process p {
  does {
    start_event s
    action a { executor machine calls helper }
    end_event e
    flow { s -> a -> e }
  }
}
`,
    );
    assert.deepEqual(boundaryIssues(bare), []);
  });

  it('caller-side binding names are step I/O for C12/C13', () => {
    // Undeclared caller-side name → C12; the OUT written only via the
    // call's out-mapping satisfies C13.
    const dir = makeProcessPackage(
      CALLEE +
        '\n' +
        `process caller {
  signature { in { test_load : mass soak : time } out { raw : mass_series } }
  registers { raw : mass_series }
  does {
    start_event s
    action run {
      executor machine
      read { soak }
      calls callee {
        with {
          in { applied_load : test_load duration : bogus_reg }
          out { indication_series : raw }
        }
      }
    }
    end_event e
    flow { s -> run -> e }
  }
}
`,
    );
    const issues = checkPackage(dir);
    const c12 = issues.filter(i => i.check === 'C12');
    assert.equal(c12.length, 1);
    assert.ok(c12[0].message.includes('"bogus_reg"'));
    // C13 stays silent: raw is written (via the out-mapping), both INs read.
    assert.deepEqual(
      issues.filter(i => i.check === 'C13'),
      [],
    );
    // And C76 does NOT repeat C12's resolution finding on the bogus name.
    assert.ok(
      !issues.some(i => i.check === 'C76' && i.message.includes('bogus_reg')),
    );
  });
});

describe('C76 across a uses boundary (post-merge)', () => {
  function makeComposition(callerBody: string): string {
    const coreDir = makePackage(
      { 'model/callee.prl': CALLEE },
      'package { id bound-core kind core }',
    );
    dirs.set('bound-core', coreDir);
    return makePackage(
      {
        'model/register.prl': REGISTER,
        'model/caller.prl': callerBody,
      },
      'package { id bound-rec kind rec uses { bound-core } }',
    );
  }
  const resolvePackage = (id: string): string | undefined => dirs.get(id);

  it('a kind-mismatched cross-package binding fails post-merge', () => {
    const recDir = makeComposition(`process caller {
  registers { when : time raw : mass_series soak : time }
  does {
    start_event s
    action run {
      executor machine
      calls callee {
        with {
          in { applied_load : when duration : soak }
          out { indication_series : raw }
        }
      }
      write { raw }
    }
    end_event e
    flow { s -> run -> e }
  }
}
`);
    const c76 = checkPackage(recDir, { resolvePackage }).filter(
      i => i.check === 'C76',
    );
    assert.equal(c76.length, 1);
    assert.ok(c76[0].message.includes('not kind-compatible'));
  });

  it('a compatible cross-package binding passes post-merge', () => {
    const recDir = makeComposition(`process caller {
  signature { in { test_load : mass soak : time } out { raw : mass_series } }
  registers { raw : mass_series }
  does {
    start_event s
    action run {
      executor machine
      read { test_load soak }
      calls callee {
        with {
          in { applied_load : test_load duration : soak }
          out { indication_series : raw }
        }
      }
      write { raw }
    }
    end_event e
    flow { s -> run -> e }
  }
}
`);
    assert.deepEqual(
      checkPackage(recDir, { resolvePackage }).filter(i =>
        ['C74', 'C75', 'C76'].includes(i.check),
      ),
      [],
    );
  });
});
