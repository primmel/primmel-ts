// ─────────────────────────────────────────────────────────────────────
// The run plane (input ⇒ output ⇒ store): the run facet on the
// conformance test — who performs, the store the records land in, the
// trajectory the run folds. The form is the output record, the store
// is the registry; the run is the input that owns them.
// ─────────────────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPackage } from '../src/ser-des/package';
import { dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const PKG = `package { id test }
class ProbeRecord#data {
  meter_id: string {
    modality SHALL
    definition "The meter under test"
  }
}
data_registry probe-records {
  title "The probe records"
  data_class ProbeRecord#data
}
form probe {
  name "The probe record"
  data_class ProbeRecord#data
  field meter_id : string { required true }
}
state_machine run_states {
  kind operational
  initial idle
  state idle
  state done
  transition finish { from idle to done }
}
conformance_test /conf/x {
  name "X"
  type Testing
  targets { /req/x }
  result_forms { probe }
  run {
    performed_by laboratory
    store probe-records
    trajectory run_states
  }
  acceptance_criteria {
    type composite
    pass_if "ocl{true}"
  }
}
requirement /req/x {
  name "X"
  verification { method testing }
}
`;

function make(model: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-run-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'), { recursive: true });
  writeFileSync(join(dir, 'model', 'r.prl'), model);
  return dir;
}

describe('the run plane', () => {
  it('parses the run facet, dump-fixpoints, and checks clean', () => {
    const dir = make(PKG);
    const m = loadPackage(dir);
    const t = m.conformanceTests.find(x => x.id === '/conf/x')!;
    assert.equal(t.run?.performedBy, 'laboratory');
    assert.equal(t.run?.store, 'probe-records');
    assert.equal(t.run?.trajectory, 'run_states');
    const d1 = dump(m);
    writeFileSync(join(dir, 'model', 'r.prl'), d1);
    assert.equal(dump(loadPackage(dir)), d1);
    const errors = checkPackage(dir).filter(i => i.severity === 'error');
    assert.deepEqual(
      errors.map(i => i.check),
      [],
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('C180: an unknown store and trajectory are air', () => {
    const dir = make(
      PKG.replace('store probe-records', 'store ghost').replace(
        'trajectory run_states',
        'trajectory ghost',
      ),
    );
    const rules = checkPackage(dir)
      .filter(i => i.check === 'C180')
      .map(i => i.message);
    assert.equal(rules.length, 2);
    assert.ok(rules[0]?.includes('store "ghost"'));
    assert.ok(rules[1]?.includes('trajectory "ghost"'));
    rmSync(dir, { recursive: true, force: true });
  });

  it('C181: a store holding a foreign data class is a mismatch', () => {
    const dir = make(
      PKG.replace(
        'data_registry probe-records {',
        'class OtherRecord#data {\n  meter_id: string { modality SHALL definition "x" }\n}\ndata_registry probe-records {',
      ).replace(
        'data_class ProbeRecord#data',
        'data_class OtherRecord#data',
      ),
    );
    const msgs = checkPackage(dir)
      .filter(i => i.check === 'C181')
      .map(i => i.message);
    assert.ok(msgs.some(m => m.includes('must agree on the data class')));
    rmSync(dir, { recursive: true, force: true });
  });

  it('the performer vocabulary is parse-enforced (the executor pattern)', () => {
    const dir = make(
      PKG.replace('performed_by laboratory', 'performed_by intern'),
    );
    assert.throws(() => loadPackage(dir), /Unknown run performer intern/);
    rmSync(dir, { recursive: true, force: true });
  });
});
