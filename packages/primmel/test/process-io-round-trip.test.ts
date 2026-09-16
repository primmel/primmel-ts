// ─────────────────────────────────────────────────────────────────────
// Process I/O round-trip pin (smart TODO.roadmap/40 batch 5e): the raw
// `output { … }` / `reference_data_registry { … }` ids must survive
// load→dump→load with EVERY id re-emitted — OIML SMART points process
// I/O at entity-class store names (dataclass `store { … }`
// declarations), which the `regs` resolver cannot see; without the raw
// carriers (outputRefs/inputRefs, the provisionRefs doctrine) the load
// silently dropped them. Follows validate-provision-round-trip.test.ts.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

describe('process output / reference_data_registry round-trip', () => {
  it('every store id survives load→dump→load, incl. quoted entries', () => {
    const src = `root Root

version "v1.0.0"

metadata {
  title "Test"
  schema "Primmel 0.1"
}

process conduct_tests {
  name "Conduct Type Evaluation Tests"
  reference_data_registry { applications measuringInstrumentModels }
  output { testReports "TestReport containing FormInstance" }
}
`;
    const model = load(src);
    const proc = model.processes.find(p => p.id === 'conduct_tests');
    assert.deepEqual(
      proc?.inputRefs,
      ['applications', 'measuringInstrumentModels'],
      'both reference_data_registry ids parsed',
    );
    assert.deepEqual(
      proc?.outputRefs,
      ['testReports', 'TestReport containing FormInstance'],
      'the output ids parsed, the quoted entry one token',
    );
    // The ids name no declared data_registry — the resolved lists stay
    // empty and the raw carriers are the only carrier.
    assert.deepEqual(proc?.input, [], 'nothing resolves against regs');
    assert.deepEqual(proc?.output, [], 'nothing resolves against regs');

    const dumped = dump(model);
    assert.ok(
      dumped.includes('reference_data_registry {'),
      'the input block is re-emitted',
    );
    assert.ok(dumped.includes('applications'), 'first input id re-emitted');
    assert.ok(
      dumped.includes('measuringInstrumentModels'),
      'second input id re-emitted',
    );
    assert.ok(dumped.includes('output {'), 'the output block is re-emitted');
    assert.ok(dumped.includes('testReports'), 'first output id re-emitted');
    assert.ok(
      dumped.includes('"TestReport containing FormInstance"'),
      'the quoted output entry re-emitted quoted (one token)',
    );

    const reloaded = load(dumped);
    const proc2 = reloaded.processes.find(p => p.id === 'conduct_tests');
    assert.deepEqual(
      proc2?.inputRefs,
      ['applications', 'measuringInstrumentModels'],
      'both input ids survive the full load→dump→load cycle',
    );
    assert.deepEqual(
      proc2?.outputRefs,
      ['testReports', 'TestReport containing FormInstance'],
      'both output ids survive the full load→dump→load cycle',
    );
    // Fixed point: the second dump is byte-identical.
    assert.equal(dump(reloaded), dumped);
  });

  it('resolved data_registry ids still dump (the pre-5e path)', () => {
    const src = `root Root

version "v1.0.0"

metadata {
  title "Test"
  schema "Primmel 0.1"
}

data_registry RefData {
  name "Reference data"
}

process p {
  name "P"
  output { RefData }
}
`;
    const model = load(src);
    const proc = model.processes.find(p => p.id === 'p');
    assert.equal(proc?.output.length, 1, 'the registry resolves');
    assert.deepEqual(proc?.outputRefs, ['RefData'], 'the raw id carried');
    const dumped = dump(model);
    assert.ok(dumped.includes('output {'), 'the block is re-emitted');
    assert.ok(dumped.includes('RefData'), 'the id re-emitted');
    assert.equal(dump(load(dumped)), dumped, 'fixed point');
  });

  it('an unresolvable actor token survives load→dump→load (batch 5e)', () => {
    // The workflow steps' documentary actor spellings (kebab-case) name no
    // declared role — the resolver leniently nulls them, and without the
    // actorRef carrier the dump silently dropped the line.
    const src = `root Root

version "v1.0.0"

metadata {
  title "Test"
  schema "Primmel 0.1"
}

process test-request-dispatch {
  name "Test request dispatch"
  actor issuing-authority
}
`;
    const model = load(src);
    const proc = model.processes.find(p => p.id === 'test-request-dispatch');
    assert.equal(proc?.actor, null, 'no role resolves');
    assert.equal(proc?.actorRef, 'issuing-authority', 'the raw token carried');
    const dumped = dump(model);
    assert.ok(
      dumped.includes('actor issuing-authority'),
      'the actor line re-emitted verbatim',
    );
    const reloaded = load(dumped);
    assert.equal(
      reloaded.processes.find(p => p.id === 'test-request-dispatch')?.actorRef,
      'issuing-authority',
      'the token survives the full cycle',
    );
    assert.equal(dump(reloaded), dumped, 'fixed point');
  });

  it('a resolved actor still dumps its role id (the pre-5e path)', () => {
    const src = `root Root

version "v1.0.0"

metadata {
  title "Test"
  schema "Primmel 0.1"
}

role lab {
  name "Laboratory"
}

process p {
  name "P"
  actor lab
}
`;
    const model = load(src);
    const proc = model.processes.find(p => p.id === 'p');
    assert.equal(proc?.actor?.id, 'lab', 'the role resolves');
    assert.equal(proc?.actorRef, 'lab', 'the raw token carried');
    const dumped = dump(model);
    assert.ok(dumped.includes('actor lab'), 'the actor line re-emitted');
    assert.equal(dump(load(dumped)), dumped, 'fixed point');
  });
});
