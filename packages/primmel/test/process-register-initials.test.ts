// ─────────────────────────────────────────────────────────────────────
// Kernel anatomy follow-ups (smart-repo tasks 50/51 deferred items):
//   1. register INITIAL VALUES (TODO.roadmap/50) — registers are HAS
//      state slots and carry their starting content:
//      `registers { n_runs : count = 5 target_load : mass = 50 kg }`.
//      The literal follows the instance `key : value [unit]` contract
//      (one value token, an optional unit token, or the QuantityValue
//      block form); signature parameters and call bindings never carry
//      one (their values arrive at the call) — a `=` there is a parse
//      error, not a silent misread.
//   2. the process `source { doc "urn:…" clause "…" [fragment "…"] }`
//      provenance facet — the same shape requirement/table/calculation
//      carry; repeated blocks collect into sourceRefs (first-wins
//      scalar), like requirement.
// Both facets are OPTIONAL: existing .prl without them parses and
// round-trips unchanged.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

const REGISTERS = `
process creep_run {
  name "Creep test run"
  signature {
    in { applied_load : mass duration : time }
    out { indication_series : mass_series }
  }
  executor lab
  registers {
    conditions_log : text = "run started"
    n_runs : count = 5
    target_load : mass = 50 kg
    warmed_up : boolean = true
    tolerance_band : mass = { value 0.5 unit kg kind mass }
    indication_series : mass_series
  }
  does {
    start_event s
    action record { executor machine read { n_runs } write { indication_series } }
    end_event e
    flow { s -> record -> e }
  }
}
`;

const SOURCED = `
process creep_method {
  name "Creep test method (R 60-2, 2.7.3)"
  signature {
    in { applied_load : mass duration : time }
    out { indication_series : mass_series }
  }
  source { doc "urn:oiml:pub:r:60-2:2021" clause "2.7.3" }
  source { doc "urn:oiml:pub:r:60-1:2021" clause "5.3.2" fragment "s1" }
}
`;

describe('register initial values (TODO.roadmap/50)', () => {
  it('parses every literal shape — text, number, quantity, boolean token, block form', () => {
    const p = load(REGISTERS).processes[0];
    const by = (n: string) => p.registers.find(r => r.name === n)!;
    assert.deepEqual(by('conditions_log').initial, { value: 'run started' });
    assert.deepEqual(by('n_runs').initial, { value: 5 });
    assert.deepEqual(by('target_load').initial, { value: 50, unit: 'kg' });
    // A boolean literal stays the bare token — the declared register type
    // gives it meaning (the kernel's boolean-as-token convention).
    assert.deepEqual(by('warmed_up').initial, { value: 'true' });
    assert.deepEqual(by('tolerance_band').initial, {
      value: 0.5,
      unit: 'kg',
      quantityKind: 'mass',
    });
    // A register without an initial value is exactly as before.
    assert.equal(by('indication_series').initial, undefined);
    assert.equal(by('indication_series').type, 'mass_series');
  });

  it('a unit token never swallows the next register entry', () => {
    const p = load(REGISTERS).processes[0];
    assert.deepEqual(
      p.registers.map(r => r.name),
      [
        'conditions_log',
        'n_runs',
        'target_load',
        'warmed_up',
        'tolerance_band',
        'indication_series',
      ],
    );
  });

  it('round-trips byte-clean (dump fixed point)', () => {
    const once = load(REGISTERS);
    const d1 = dump(once);
    assert.ok(d1.includes('n_runs : count = 5'));
    assert.ok(d1.includes('target_load : mass = 50 kg'));
    assert.ok(d1.includes('conditions_log : text = "run started"'));
    const twice = load(d1);
    assert.deepEqual(twice.processes, once.processes);
    assert.equal(dump(twice), d1);
  });

  it('registers without initial values parse and round-trip unchanged', () => {
    const src = 'process p { registers { a : text b : mass } }';
    const once = load(src);
    const d1 = dump(once);
    assert.ok(d1.includes('registers { a : text b : mass }'));
    assert.equal(dump(load(d1)), d1);
  });

  it('a quoted-numeric initial value stays a string across the round-trip', () => {
    const once = load('process p { registers { code : text = "5" } }');
    assert.deepEqual(once.processes[0].registers[0].initial, { value: '5' });
    const twice = load(dump(once));
    assert.deepEqual(twice.processes[0].registers[0].initial, { value: '5' });
  });

  it('rejects an initial value on a signature parameter (values arrive at the call)', () => {
    assert.throws(
      () => load('process p { signature { in { a : mass = 5 } } }'),
      /initial values are a registers facet/,
    );
  });

  it('rejects an initial value on a call binding', () => {
    assert.throws(
      () =>
        load(`process callee { signature { in { x : mass } } }
process caller {
  does {
    start_event s
    action c { executor machine calls callee { with { in { x : a = 5 } } } }
    end_event e
    flow { s -> c -> e }
  }
}`),
      /initial values are a registers facet/,
    );
  });

  it('rejects "=" with no value', () => {
    assert.throws(
      () => load('process p { registers { a : mass = } }'),
      /"=" with no value/,
    );
  });

  it('rejects a multi-word unquoted initial value (the unit position stays unambiguous)', () => {
    assert.throws(
      () => load('process p { registers { a : text = one two three } }'),
      /quote multi-word values/,
    );
  });
});

describe('process source facet (clause-URN provenance)', () => {
  it('parses the requirement-shaped source block; repeats collect into sourceRefs', () => {
    const p = load(SOURCED).processes[0];
    assert.deepEqual(p.source, {
      doc: 'urn:oiml:pub:r:60-2:2021',
      clause: '2.7.3',
    });
    assert.deepEqual(p.sourceRefs, [
      { doc: 'urn:oiml:pub:r:60-2:2021', clause: '2.7.3' },
      { doc: 'urn:oiml:pub:r:60-1:2021', clause: '5.3.2', fragment: 's1' },
    ]);
  });

  it('round-trips byte-clean (dump fixed point), every source block preserved', () => {
    const once = load(SOURCED);
    const d1 = dump(once);
    // The canonical spelling (docs/primmel/18 §18.4): one derives-from
    // ref line per provenance block.
    assert.ok(
      d1.includes('ref derives-from "urn:oiml:pub:r:60-2:2021#clause-2.7.3"'),
    );
    assert.ok(
      d1.includes(
        'ref derives-from "urn:oiml:pub:r:60-1:2021#clause-5.3.2/s1"',
      ),
    );
    const twice = load(d1);
    assert.deepEqual(twice.processes, once.processes);
    assert.equal(dump(twice), d1);
  });

  it('a process without a source facet keeps source null and dumps none', () => {
    const once = load('process p { name "plain" }');
    assert.equal(once.processes[0].source, null);
    assert.equal(once.processes[0].sourceRefs, undefined);
    const d1 = dump(once);
    assert.ok(!d1.includes('source {'));
    assert.equal(dump(load(d1)), d1);
  });
});
