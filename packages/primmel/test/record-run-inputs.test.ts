// ─────────────────────────────────────────────────────────────────────
// The record form's applied-input slice (spec §10, spec#57):
// `run_inputs { … }` names the owning test's run.inputs members the
// record reflects as fields, and C183 record-run-inputs machine-checks
// the record↔run link end to end — every name is (a) the owning
// test's applied input AND (b) a field of the form's data class. The
// owning test resolves through the form's conformance_process
// binding; a slice with no resolvable owner is an error (the linkage
// IS the rule's point), and a form declaring no slice is untouched.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dump, load } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-run-inputs-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'main.prl'), body);
  return dir;
}

const BASE = `
class ProbeRecord#data {
  attribute envelope_temperature_min, Temperature { modality SHALL }
  attribute envelope_temperature_max, Temperature { modality SHALL }
  attribute indication, Counts { modality SHALL }
}

data_registry probe-records {
  title "Probe records"
  data_class ProbeRecord#data
}

variable envelope_temperature_min { type number source declared definition "the applied low" }
variable envelope_temperature_max { type number source declared definition "the applied high" }
variable indication { type number source measured definition "the observed" }

conformance_test /conf/probe {
  name "Probe"
  type Testing
  targets { /req/probe }
  result_forms { probe }
  run {
    performed_by laboratory
    store probe-records
    trajectory probe_states
    inputs { envelope_temperature_min envelope_temperature_max }
  }
}

state_machine probe_states {
  states { IDLE RUNNING }
  transition IDLE -> RUNNING action start { }
}

form probe {
  clause "1"
  data_class ProbeRecord#data
  conformance_process /conf/probe
  run_inputs { envelope_temperature_min envelope_temperature_max }
}
`;

describe('C183 record-run-inputs (spec#57)', () => {
  it('the coherent slice checks clean and round-trips', () => {
    const dir = makePackage(BASE);
    const issues = checkPackage(dir).filter(i => i.check === 'C183');
    assert.deepEqual(issues, []);
    const text = dump(
      load(`
      form probe {
        clause "1"
        data_class ProbeRecord#data
        conformance_process /conf/probe
        run_inputs { envelope_temperature_min envelope_temperature_max }
      }
    `),
    );
    assert.match(
      text,
      /run_inputs \{ envelope_temperature_min envelope_temperature_max \}/,
    );
  });

  it('a name the run does not apply is an error (the record cannot carry it)', () => {
    const dir = makePackage(
      BASE.replace(
        'run_inputs { envelope_temperature_min envelope_temperature_max }',
        'run_inputs { envelope_temperature_min indication }',
      ),
    );
    const issues = checkPackage(dir).filter(i => i.check === 'C183');
    assert.equal(issues.length, 1);
    assert.match(
      issues[0].message,
      /"indication" is not in the owning test's run\.inputs/,
    );
    assert.match(
      issues[0].message,
      /a record cannot carry what the run does not apply/,
    );
  });

  it('a name the data class lacks is an error (the slice must be the record shape)', () => {
    const dir = makePackage(
      BASE.replace(
        'run_inputs { envelope_temperature_min envelope_temperature_max }',
        'run_inputs { envelope_temperature_min envelope_temperature_max dwell_minutes }',
      ),
    );
    const issues = checkPackage(dir).filter(i => i.check === 'C183');
    // dwell_minutes fails BOTH arms: the run does not apply it, and the
    // record's shape lacks it.
    assert.equal(issues.length, 2);
    assert.match(
      issues[0].message,
      /"dwell_minutes" is not in the owning test's run\.inputs/,
    );
    assert.match(
      issues[1].message,
      /"dwell_minutes" is no field of the data class ProbeRecord#data/,
    );
  });

  it('a slice with no resolvable owning test is an error (the linkage is the point)', () => {
    const dir = makePackage(
      BASE.replace(
        'conformance_process /conf/probe',
        'conformance_process /conf/elsewhere',
      ),
    );
    const issues = checkPackage(dir).filter(i => i.check === 'C183');
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /binds no conformance test/);
  });

  it('a form without the slice is untouched (additive)', () => {
    const dir = makePackage(
      BASE.replace(
        '  run_inputs { envelope_temperature_min envelope_temperature_max }',
        '',
      ),
    );
    const issues = checkPackage(dir).filter(i => i.check === 'C183');
    assert.deepEqual(issues, []);
  });

  it('the multi-binding form (conformance_process_ids) resolves against each owner', () => {
    const second = BASE.replace('/conf/probe {', '/conf/probe2 {').replace(
      'inputs { envelope_temperature_min envelope_temperature_max }',
      'inputs { envelope_temperature_min }',
    );
    const dir = makePackage(
      `${BASE}\n${second.replace('conformance_test /conf/probe2 {', 'conformance_test /conf/probe2 {')}`.replace(
        'form probe {\n  clause "1"\n  data_class ProbeRecord#data\n  conformance_process /conf/probe\n  run_inputs { envelope_temperature_min envelope_temperature_max }\n}',
        'form probe {\n  clause "1"\n  data_class ProbeRecord#data\n  conformance_process_ids { /conf/probe /conf/probe2 }\n  run_inputs { envelope_temperature_min }\n}',
      ),
    );
    const issues = checkPackage(dir).filter(i => i.check === 'C183');
    assert.deepEqual(issues, []);
  });
});
