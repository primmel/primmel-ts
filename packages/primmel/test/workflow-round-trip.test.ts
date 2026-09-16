// ─────────────────────────────────────────────────────────────────────
// The workflow fidelity facets (smart TODO.roadmap/40 batch 5; the
// packages-as-SSOT epic; closes the kernel half of smart's
// TODO.refactor/16) — the process facet additions (guard / phase /
// machine_steps), the gateway edges (5b), the approval provenance +
// resolution (5c), and the workflow_stage register (5d). The fixtures
// carry the real r60 evaluation shapes (inline, the conformance-corpus
// precedent — no cross-repo dependency).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

// The r60 conduct_tests shape: the facets the old emitter dropped
// (label vs name is the emitter's; the kernel reads `name`).
const PROCESS = `
data_registry testRequests {
  name "Test requests"
}
process conduct_tests {
  name "Conduct tests"
  modality shall
  phase testing
  guard "Each TestRequest references >= 1 MeasuringInstrumentSample"
  guard "TestRequest.assigned_laboratory_id is accredited for the requested accuracy classes"
  machine_steps { verdict_computation evaluation_aggregation certificate_characteristics_derivation }
  reference_data_registry {
    testRequests
  }
  validate_measurement {
    "every([within_mpe]) = true"
  }
  source { doc "PD-05 §4.1" clause "" }
}
`;

describe('process workflow facets (smart TODO.roadmap/40 batch 5, step 5a)', () => {
  it('parses phase, the ordered guards, and the machine_steps list', () => {
    const m = load(PROCESS);
    assert.equal(m.processes.length, 1);
    const p = m.processes[0]!;
    assert.equal(p.modality, 'shall');
    assert.equal(p.phase, 'testing');
    assert.deepEqual(p.guards, [
      'Each TestRequest references >= 1 MeasuringInstrumentSample',
      'TestRequest.assigned_laboratory_id is accredited for the requested accuracy classes',
    ]);
    assert.deepEqual(p.machineSteps, [
      'verdict_computation',
      'evaluation_aggregation',
      'certificate_characteristics_derivation',
    ]);
    assert.deepEqual(
      p.input.map(r => r.id),
      ['testRequests'],
    );
    assert.deepEqual(p.measure, ['every([within_mpe]) = true']);
    assert.equal(p.source?.doc, 'PD-05 §4.1');
  });

  it('round-trips byte-clean (the codec fixpoint)', () => {
    const out = dump(load(PROCESS));
    assert.ok(out.includes('  phase testing\n'));
    assert.ok(
      out.includes(
        '  guard "Each TestRequest references >= 1 MeasuringInstrumentSample"\n' +
          '  guard "TestRequest.assigned_laboratory_id is accredited for the requested accuracy classes"\n',
      ),
    );
    assert.ok(
      out.includes(
        '  machine_steps { verdict_computation evaluation_aggregation certificate_characteristics_derivation }\n',
      ),
    );
    assert.ok(
      out.includes('  reference_data_registry {\n    testRequests\n  }\n'),
    );
    assert.equal(dump(load(out)), out);
  });

  it('provenance is spelled ONLY source { doc clause } — free citation strings land in doc', () => {
    const m = load(PROCESS);
    const src = m.processes[0]!.source!;
    assert.equal(src.doc, 'PD-05 §4.1');
    assert.equal(src.clause, '');
    const out = dump(m);
    assert.ok(out.includes('doc "PD-05 §4.1"'));
    // The accidental `reference { … }` emission has no keyword — it never
    // comes back.
    assert.ok(!out.includes('reference {'));
  });

  it('a process without the new facets keeps the batch-2 shape exactly', () => {
    const out = dump(load('process p { name "Plain" }'));
    assert.ok(out.includes('process p {\n  name "Plain"\n}\n'));
    assert.equal(dump(load(out)), out);
  });
});
