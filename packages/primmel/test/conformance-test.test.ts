import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

describe('Conformance tests', () => {
  it('parses a conformance_test with all fields', () => {
    const model = load(`root Root

version "v1.0.0"

metadata {
  title "Test"
  schema "Primmel 0.1"
}

start_event Start { }
end_event Done { }

provision ProvMPE {
  condition "Errors shall not exceed MPE"
  modality SHALL
}

conformance_test MeasurementError {
  name "Measurement error test"
  type Testing
  reference { R60doc#2.10.1 }
  targets {
    ProvMPE
  }
  procedure {
    1 "Check test conditions"
    2 "Insert load cell"
    3 "Record indications"
  }
  validate_measurement {
    "[error] <= [mpe_limit]"
  }
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    Done  { x 0 y 100 }
  }
  process_flow {
    E1 { from Start to Done }
  }
}`);

    assert.equal(model.conformanceTests.length, 1);
    const ct = model.conformanceTests[0];
    assert.equal(ct.id, 'MeasurementError');
    assert.equal(ct.name, 'Measurement error test');
    assert.equal(ct.type, 'Testing');
    assert.equal(ct.reference, 'R60doc#2.10.1');
    assert.deepEqual(ct.targets, ['ProvMPE']);
    assert.equal(ct.procedure.length, 3);
    assert.equal(ct.procedure[0].order, 1);
    assert.equal(ct.procedure[0].action, 'Check test conditions');
    assert.equal(ct.procedure[2].order, 3);
    assert.equal(ct.procedure[2].action, 'Record indications');
    assert.deepEqual(ct.measurements, ['[error] <= [mpe_limit]']);
  });

  it('round-trips through dump', () => {
    const original = `root Root

version "v1.0.0"

metadata {
  title "Test"
  schema "Primmel 0.1"
}

start_event Start { }
end_event Done { }

provision ProvMPE {
  condition "Test"
  modality SHALL
}

conformance_test CT1 {
  name "Test CT"
  type Inspection
  targets {
    ProvMPE
  }
  procedure {
    1 "Step one"
  }
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    Done  { x 0 y 100 }
  }
  process_flow {
    E1 { from Start to Done }
  }
}`;

    const model = load(original);
    const dumped = dump(model);
    assert.ok(dumped.includes('conformance_test CT1'));
    assert.ok(dumped.includes('name "Test CT"'));
    assert.ok(dumped.includes('type Inspection'));
    assert.ok(dumped.includes('1 "Step one"'));

    const reloaded = load(dumped);
    assert.equal(reloaded.conformanceTests.length, 1);
    assert.equal(reloaded.conformanceTests[0].procedure.length, 1);
  });

  it('handles conformance_test without optional fields', () => {
    const model = load(`root Root

version "v1.0.0"

metadata {
  title "T"
  schema "Primmel 0.1"
}

start_event S { }
end_event E { }

conformance_test Minimal {
  name "Minimal test"
}

canvas Root {
  elements { S { x 0 y 0 } E { x 0 y 100 } }
  process_flow { e { from S to E } }
}`);

    assert.equal(model.conformanceTests.length, 1);
    const ct = model.conformanceTests[0];
    assert.equal(ct.id, 'Minimal');
    assert.equal(ct.name, 'Minimal test');
    assert.equal(ct.type, '');
    assert.equal(ct.targets.length, 0);
    assert.equal(ct.procedure.length, 0);
  });
});
