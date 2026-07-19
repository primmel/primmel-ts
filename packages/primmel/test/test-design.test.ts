import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

// conformance_test design block (data/schemas/cc.yaml $defs/testDesign,
// TODO.refactor/09): counts, severity × environment-class matrix, shared
// test-point set reference, schedule, and specimen governance.

const SRC = `conformance_test DryHeatTest {
  name "Dry heat test"
  type Testing
  design {
    counts {
      count field_automatic {
        min 500
        clause "4.4"
        note "Automatic field measurements"
        override { condition statistical_analysis by evaluator note "Fewer with 4.7 analysis" }
      }
      count field_manual {
        min 100
        clause "4.4"
      }
    }
    severities {
      severity "1 dry heat (operating)" {
        criterion I/MPE
        footnotes { a b }
        env climatic_environment_class { level 2 }
        env mechanical_environment_class null
        env electromagnetic_environment_class {
          amplitude 10
          unit "V/m"
          variable field_strength
          columns {
            ac { amplitude 10 unit "V/m" }
            dc null
            vehicle_dc { amplitude 10 unit "V" note "Vehicle supply" }
          }
        }
      }
    }
    test_points { ref r144-cgm-points }
    schedule {
      duration P7D
      cadence PT24H
      phases {
        phase soak { condition "stabilize at reference temperature" window PT2H }
      }
      constraints { "apply D_max and hold" "record at t=20 and t=30 min" }
    }
    specimens {
      count 1
      max_additional 2
      selection "ocl{sample.instrument_class = 'digital'}"
      continuity same_eut
      rules { unit-continuity }
    }
  }
}
`;

describe('conformance_test design block', () => {
  it('parses counts with override', () => {
    const m = load(SRC);
    const d = m.conformanceTests[0].design!;
    assert.equal(d.counts.length, 2);
    const c0 = d.counts[0];
    assert.equal(c0.context, 'field_automatic');
    assert.equal(c0.minCount, 500);
    assert.equal(c0.clause, '4.4');
    assert.equal(c0.note, 'Automatic field measurements');
    assert.deepEqual(c0.override, {
      condition: 'statistical_analysis',
      by: 'evaluator',
      note: 'Fewer with 4.7 analysis',
    });
    const c1 = d.counts[1];
    assert.equal(c1.context, 'field_manual');
    assert.equal(c1.minCount, 100);
    assert.equal(c1.override, null);
  });

  it('parses the severity × environment-class matrix', () => {
    const m = load(SRC);
    const d = m.conformanceTests[0].design!;
    assert.equal(d.severities.length, 1);
    const s = d.severities[0];
    assert.equal(s.row, '1 dry heat (operating)');
    assert.equal(s.criterion, 'I/MPE');
    assert.deepEqual(s.footnotes, ['a', 'b']);

    const climatic = s.envClassValues['climatic_environment_class']!;
    assert.equal(climatic.level, 2);
    assert.equal(climatic.amplitude, null);
    assert.equal(s.envClassValues['mechanical_environment_class'], null);

    const em = s.envClassValues['electromagnetic_environment_class']!;
    assert.equal(em.amplitude, 10);
    assert.equal(em.unit, 'V/m');
    assert.equal(em.variable, 'field_strength');
    assert.deepEqual(em.columns!.ac, {
      level: null,
      code: '',
      amplitude: 10,
      unit: 'V/m',
      note: '',
      variable: '',
    });
    assert.equal(em.columns!.dc, null);
    assert.equal(em.columns!.vehicleDc!.note, 'Vehicle supply');
  });

  it('parses test_points, schedule, and specimens', () => {
    const m = load(SRC);
    const d = m.conformanceTests[0].design!;
    assert.equal(d.testPointsRef, 'r144-cgm-points');

    const sch = d.schedule!;
    assert.equal(sch.duration, 'P7D');
    assert.equal(sch.cadence, 'PT24H');
    assert.deepEqual(sch.phases, [
      {
        id: 'soak',
        condition: 'stabilize at reference temperature',
        window: 'PT2H',
      },
    ]);
    assert.deepEqual(sch.constraints, [
      'apply D_max and hold',
      'record at t=20 and t=30 min',
    ]);

    const sp = d.specimens!;
    assert.equal(sp.count, 1);
    assert.equal(sp.maxAdditional, 2);
    assert.equal(sp.selection, "ocl{sample.instrument_class = 'digital'}");
    assert.equal(sp.selectionRef, '');
    assert.equal(sp.continuity, 'same_eut');
    assert.deepEqual(sp.rules, ['unit-continuity']);
  });

  it('parses a specimen selection { ref } block', () => {
    const m = load(`conformance_test T {
      design {
        specimens {
          count 1
          selection { ref unit-continuity }
          continuity same_eut_with_additional
        }
      }
    }`);
    const sp = m.conformanceTests[0].design!.specimens!;
    assert.equal(sp.selection, '');
    assert.equal(sp.selectionRef, 'unit-continuity');
    assert.equal(sp.continuity, 'same_eut_with_additional');
  });

  it('keeps tests without a design block unchanged', () => {
    const m = load('conformance_test T { name "Plain" }');
    assert.equal(m.conformanceTests[0].design, null);
    const m2 = load(dump(m));
    assert.deepEqual(m2.conformanceTests, m.conformanceTests);
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('design {'));
    assert.ok(dumped.includes('count field_automatic {'));
    assert.ok(dumped.includes('severity "1 dry heat (operating)" {'));
    assert.ok(dumped.includes('test_points { ref r144-cgm-points }'));

    const m2 = load(dumped);
    assert.deepEqual(m2.conformanceTests, m1.conformanceTests);
    assert.equal(dump(m2), dumped);
  });
});
