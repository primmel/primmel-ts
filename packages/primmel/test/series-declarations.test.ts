import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

// Series declarations (OIML SMART TODO.refactor/05): symbols, conformance
// test variables, and form datalist fields declare their series shape
// (typed axes + one measured cell) so the OCL series ops (reading_at /
// window / drift_over / pairwise_max_difference / group_by / change_since)
// can select over the declared identifiers.

const SRC = `symbol creep_readings {
  name "Creep readings"
  type collection
  series {
    axis elapsed_min { unit "min" role time }
    axis test_load { type string }
    cell { symbol change_v unit "v" }
  }
}

conformance_test Creep {
  name "Creep test"
  type Testing
  variables {
    variable creep_readings {
      type collection
      source measured
      description "Time-series creep readings at D_max"
      series {
        axis elapsed_min { unit "min" role time }
        cell { symbol change_v unit "v" }
      }
    }
    variable c_c {
      type number
      unit "v"
      source derived
      derivation "ocl{creep_readings->collect(r | r.change_v)->max()}"
    }
  }
}

form CreepForm {
  name "Creep data capture"
  field readings : array {
    label "Time-series indication readings"
    series {
      axis elapsed_min { unit "min" role time }
      cell { symbol change_v unit "v" }
    }
    items { object }
  }
}
`;

describe('series declarations', () => {
  it('types a symbol with series shape (axes + cell)', () => {
    const m = load(SRC);
    const s = m.symbols.find(s => s.id === 'creep_readings')!;
    assert.equal(s.type, 'collection');
    assert.ok(s.series);
    assert.equal(s.series.axes.length, 2);
    assert.deepEqual(s.series.axes[0], {
      id: 'elapsed_min',
      unit: 'min',
      type: '',
      role: 'time',
    });
    assert.deepEqual(s.series.axes[1], {
      id: 'test_load',
      unit: '',
      type: 'string',
      role: '',
    });
    assert.equal(s.series.cellSymbol, 'change_v');
    assert.equal(s.series.cellUnit, 'v');
  });

  it('types a conformance test variable with series shape', () => {
    const m = load(SRC);
    const ct = m.conformanceTests.find(t => t.id === 'Creep')!;
    const v = ct.variables[0];
    assert.equal(v.name, 'creep_readings');
    assert.equal(v.type, 'collection');
    assert.ok(v.series);
    assert.deepEqual(v.series.axes, [
      { id: 'elapsed_min', unit: 'min', type: '', role: 'time' },
    ]);
    assert.equal(v.series.cellSymbol, 'change_v');
    assert.equal(v.series.cellUnit, 'v');
    // Scalar variables carry no series declaration.
    assert.equal(ct.variables[1].series, null);
  });

  it('types a form datalist field with series shape', () => {
    const m = load(SRC);
    const f = m.forms.find(f => f.id === 'CreepForm')!;
    const field = f.fields[0];
    assert.equal(field.name, 'readings');
    assert.equal(field.type, 'array');
    assert.ok(field.series);
    assert.deepEqual(field.series!.axes, [
      { id: 'elapsed_min', unit: 'min', type: '', role: 'time' },
    ]);
    assert.equal(field.series!.cellSymbol, 'change_v');
    assert.equal(field.series!.cellUnit, 'v');
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('series {'));
    assert.ok(dumped.includes('axis elapsed_min { unit "min" role time }'));
    assert.ok(dumped.includes('cell { symbol change_v unit "v" }'));

    const m2 = load(dumped);
    assert.deepEqual(m2.symbols, m1.symbols);
    assert.deepEqual(m2.conformanceTests, m1.conformanceTests);
    assert.deepEqual(m2.forms, m1.forms);
    assert.equal(dump(m2), dumped);
  });

  it('supports multiple axes with at most one time role', () => {
    const m = load(`symbol warm_up_indications {
      name "Warm-up indication series"
      type collection
      series {
        axis elapsed_min { unit "min" role time }
        axis cgm { type reference_material }
        cell { symbol indication unit "ppm" }
      }
    }`);
    const s = m.symbols[0];
    assert.deepEqual(s.series!.axes, [
      { id: 'elapsed_min', unit: 'min', type: '', role: 'time' },
      { id: 'cgm', unit: '', type: 'reference_material', role: '' },
    ]);
    const m2 = load(dump(m));
    assert.deepEqual(m2.symbols, m.symbols);
  });
});
