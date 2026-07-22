import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';
import { checkPackage } from '../src/check';

// Set dimensions (data/schemas/model.yaml + rc.yaml $defs/applicability):
// cardinality set vs single, label join separator, match any|all|exact on
// applicability conditions, and implies subsumption on dimension values.

const SRC = `instrument GasAnalysisSystem {
  extends MeasuringInstrumentModel
  dimension measurand_components {
    label "Measurand components"
    scope model
    cardinality set
    label_separator "+"
    description "Gas component set measured by the system — multi-select"
    reference { doc "urn:oiml:pub:r:144-1:2013" clause "1.1" }
    values {
      co { description "CO measured component" }
      no { description "NO measured component (part of NOx)" }
      no2 { description "Nitrogen dioxide" }
    }
  }
  dimension measurement_type {
    label "Measurement type"
    scope family
    values {
      average-speed {
        description "Average speed between two remote positions (section speed)"
        implies { fixed-distance }
      }
      fixed-distance { description "Speed over a fixed distance" }
    }
  }
}

requirement /req/metrological/per-component {
  name "Per-component error"
  applicability {
    measurand_components: [co, no] match all
  }
}

requirement /req/metrological/co-only {
  name "CO-only analyzer check"
  applicability {
    measurand_components: [co] match exact
  }
}
`;

describe('set dimensions', () => {
  it('parses a set-cardinality dimension with label separator', () => {
    const m = load(SRC);
    const inst = m.instruments.find(x => x.id === 'GasAnalysisSystem')!;
    const dim = inst.dimensions[0];
    assert.equal(dim.id, 'measurand_components');
    assert.equal(dim.cardinality, 'set');
    assert.equal(dim.labelSeparator, '+');
    assert.equal(dim.scope, 'model');
    assert.equal(dim.values.length, 3);
    assert.deepEqual(dim.source, {
      doc: 'urn:oiml:pub:r:144-1:2013',
      clause: '1.1',
    });
  });

  it('parses implies subsumption on dimension values', () => {
    const m = load(SRC);
    const inst = m.instruments.find(x => x.id === 'GasAnalysisSystem')!;
    const dim = inst.dimensions[1];
    const avg = dim.values.find(v => v.id === 'average-speed')!;
    assert.deepEqual(avg.implies, ['fixed-distance']);
    const fixed = dim.values.find(v => v.id === 'fixed-distance')!;
    assert.deepEqual(fixed.implies, []);
  });

  it('parses match any|all on applicability conditions', () => {
    const m = load(SRC);
    const r = m.requirements.find(
      r => r.id === '/req/metrological/per-component',
    )!;
    assert.deepEqual(r.applicability, [
      {
        dimension: 'measurand_components',
        values: ['co', 'no'],
        mapping: null,
        match: 'all',
      },
    ]);
  });

  it('parses match exact on applicability conditions', () => {
    const m = load(SRC);
    const r = m.requirements.find(r => r.id === '/req/metrological/co-only')!;
    assert.deepEqual(r.applicability, [
      {
        dimension: 'measurand_components',
        values: ['co'],
        mapping: null,
        match: 'exact',
      },
    ]);
  });

  it('defaults applicability match to null (existential any)', () => {
    const m = load(`requirement /req/x {
      applicability { accuracy_class: [A, B] }
    }`);
    assert.deepEqual(m.requirements[0].applicability, [
      {
        dimension: 'accuracy_class',
        values: ['A', 'B'],
        mapping: null,
        match: null,
      },
    ]);
  });

  it('rejects an unknown cardinality', () => {
    assert.throws(
      () =>
        load(`instrument I {
          dimension d {
            cardinality multi
            values { a }
          }
        }`),
      /Unknown cardinality multi/,
    );
  });

  it('rejects an unknown applicability match mode', () => {
    assert.throws(
      () =>
        load(`requirement /req/x {
          applicability { comps: [a, b] match some }
        }`),
      /Unknown match some/,
    );
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('cardinality set'));
    assert.ok(dumped.includes('label_separator "+"'));
    assert.ok(dumped.includes('implies { fixed-distance }'));
    assert.ok(dumped.includes('measurand_components: [co, no] match all'));
    assert.ok(dumped.includes('measurand_components: [co] match exact'));

    const m2 = load(dumped);
    assert.deepEqual(m2.instruments, m1.instruments);
    assert.deepEqual(m2.requirements, m1.requirements);
    assert.equal(dump(m2), dumped);
  });

  it('keeps single-cardinality dimensions unchanged (no cardinality emitted)', () => {
    const m1 = load(`instrument I {
      dimension accuracy_class {
        scope group
        values { A B C D }
      }
    }`);
    const dim = m1.instruments[0].dimensions[0];
    assert.equal(dim.cardinality, '');
    assert.equal(dim.labelSeparator, '');
    const dumped = dump(m1);
    assert.ok(!dumped.includes('cardinality'));
    const m2 = load(dumped);
    assert.deepEqual(m2.instruments, m1.instruments);
  });

  it('linter warns when match all|exact is declared on a single-cardinality dimension (C3)', () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = require('fs');
    const { tmpdir } = require('os');
    const { join } = require('path');
    const dir = mkdtempSync(join(tmpdir(), 'primmel-setdim-'));
    writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
    mkdirSync(join(dir, 'model'));
    writeFileSync(
      join(dir, 'model', 'instrument.prl'),
      `instrument T {
  dimension accuracy_class {
    scope group
    values { A B }
  }
  dimension measurand_components {
    scope model
    cardinality set
    values { co no }
  }
}`,
    );
    mkdirSync(join(dir, 'specification'));
    writeFileSync(
      join(dir, 'specification', 'requirements.prl'),
      `requirement /req/single-all {
  applicability { accuracy_class: [A] match all }
}
requirement /req/single-exact {
  applicability { accuracy_class: [A] match exact }
}
requirement /req/set-exact {
  applicability { measurand_components: [co] match exact }
}`,
    );
    const issues = checkPackage(dir);
    const c3 = issues.filter(i => i.check === 'C3');
    const warnings = c3.filter(i => i.severity === 'warning');
    assert.equal(warnings.length, 2);
    assert.ok(
      warnings.every(w =>
        w.message.includes('only meaningful on set dimensions'),
      ),
    );
    assert.ok(warnings.some(w => w.message.includes('/req/single-all')));
    assert.ok(warnings.some(w => w.message.includes('/req/single-exact')));
    // The set-cardinality exact condition stays silent.
    assert.ok(!warnings.some(w => w.message.includes('/req/set-exact')));
    // No C3 errors: every filtered value exists on its dimension.
    assert.equal(c3.filter(i => i.severity === 'error').length, 0);
  });
});
