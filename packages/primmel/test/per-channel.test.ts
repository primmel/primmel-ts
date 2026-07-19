import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

// Per-channel verdict requirements (rc.yaml `channel` + evaluation config
// `per_channel`): a requirement marked with a channel dimension is verified
// once PER SELECTED VALUE of that set-cardinality dimension; the instrument
// declares the evaluation-level channel via per_channel.

const SRC = `instrument GasAnalysisSystem {
  extends MeasuringInstrumentModel
  per_channel measurand_components
  dimension measurand_components {
    label "Measurand components"
    scope model
    cardinality set
    values {
      co { description "CO measured component" }
      no { description "NO measured component" }
    }
  }
}

requirement /req/metrological/error-by-component {
  name "Error per measurand component"
  statement "The error of indication shall not exceed the MPE for each measurand component."
  channel measurand_components
  limit {
    expression "ocl{abs(error) <= mpe}"
    uses { error mpe }
  }
  applicability {
    measurand_components: [co, no] match all
  }
  verification { method testing }
}
`;

describe('per_channel verdict requirements', () => {
  it('parses the instrument per_channel declaration', () => {
    const m = load(SRC);
    const inst = m.instruments.find(x => x.id === 'GasAnalysisSystem')!;
    assert.equal(inst.perChannel, 'measurand_components');
    assert.equal(inst.dimensions[0].cardinality, 'set');
  });

  it('parses the requirement channel key', () => {
    const m = load(SRC);
    const r = m.requirements.find(
      r => r.id === '/req/metrological/error-by-component',
    )!;
    assert.equal(r.channel, 'measurand_components');
    assert.equal(r.limit?.expression, 'ocl{abs(error) <= mpe}');
    assert.equal(r.applicability[0].match, 'all');
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('per_channel measurand_components'));
    assert.ok(dumped.includes('channel measurand_components'));

    const m2 = load(dumped);
    assert.deepEqual(m2.instruments, m1.instruments);
    assert.deepEqual(m2.requirements, m1.requirements);
    assert.equal(dump(m2), dumped);
  });

  it('omits channel/per_channel for once-per-model requirements', () => {
    const m1 = load(`instrument LoadCell {
      extends MeasuringInstrumentModel
    }

requirement /req/metrological/mpe {
      name "MPE"
      limit {
        expression "ocl{abs(error) <= mpe}"
        uses { error mpe }
      }
    }`);
    assert.equal(m1.instruments[0].perChannel, '');
    assert.equal(m1.requirements[0].channel, '');
    const dumped = dump(m1);
    assert.ok(!dumped.includes('per_channel'));
    assert.ok(!dumped.includes('channel '));
    const m2 = load(dumped);
    assert.deepEqual(m2.instruments, m1.instruments);
    assert.deepEqual(m2.requirements, m1.requirements);
  });
});
