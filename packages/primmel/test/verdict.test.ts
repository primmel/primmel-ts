import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

// Verdict construct — the canonical verdict chain ("derive once, reference
// everywhere"). Mirrors data/schemas/verdicts.yaml in the OIML SMART repo.

const SRC = `verdict mdlo_normalized {
  quantity { kind dimensionless }
  derive "ocl{abs(c_m * t_f / delta_t * (d_max - d_min) / (n * v_min))}"
  inputs { c_m t_f delta_t d_max d_min n v_min }
  source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1.4" }
}

verdict drift_error {
  quantity { kind volume-fraction unit "ppm" }
  derive "ocl{indication - cgm_certified_value}"
  inputs { indication cgm_certified_value }
  series_reduction max_abs_over_window
  source { doc "urn:oiml:pub:r:144-2:2013" clause "4.8" }
}
`;

describe('verdict construct', () => {
  it('parses a scalar verdict quantity', () => {
    const m = load(SRC);
    const v = m.verdicts.find(v => v.id === 'mdlo_normalized')!;
    assert.ok(v);
    assert.equal(v.quantityKind, 'dimensionless');
    assert.equal(v.unit, '');
    assert.equal(
      v.derive,
      'ocl{abs(c_m * t_f / delta_t * (d_max - d_min) / (n * v_min))}',
    );
    assert.deepEqual(v.inputs, [
      'c_m',
      't_f',
      'delta_t',
      'd_max',
      'd_min',
      'n',
      'v_min',
    ]);
    assert.equal(v.seriesReduction, null);
    assert.deepEqual(v.source, {
      doc: 'urn:oiml:pub:r:60-3:2021',
      clause: '2.1.4',
    });
  });

  it('parses a verdict with unit and series reduction', () => {
    const m = load(SRC);
    const v = m.verdicts.find(v => v.id === 'drift_error')!;
    assert.equal(v.quantityKind, 'volume-fraction');
    assert.equal(v.unit, 'ppm');
    assert.equal(v.derive, 'ocl{indication - cgm_certified_value}');
    assert.deepEqual(v.inputs, ['indication', 'cgm_certified_value']);
    assert.equal(v.seriesReduction, 'max_abs_over_window');
    assert.deepEqual(v.source, {
      doc: 'urn:oiml:pub:r:144-2:2013',
      clause: '4.8',
    });
  });

  it('rejects an unknown series_reduction', () => {
    assert.throws(
      () =>
        load(`verdict bad {
          quantity { kind mass }
          derive "ocl{a - b}"
          inputs { a b }
          series_reduction median
        }`),
      /Unknown series_reduction median/,
    );
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('verdict mdlo_normalized {'));
    assert.ok(dumped.includes('series_reduction max_abs_over_window'));
    assert.ok(dumped.includes('unit "ppm"'));

    const m2 = load(dumped);
    assert.deepEqual(m2.verdicts, m1.verdicts);
    assert.equal(dump(m2), dumped);
  });

  it('handles a verdict without optional unit, reduction, and source', () => {
    const m1 = load(`verdict plain {
      quantity { kind ratio }
      derive "ocl{a / b}"
      inputs { a b }
    }`);
    const v = m1.verdicts[0];
    assert.equal(v.quantityKind, 'ratio');
    assert.equal(v.unit, '');
    assert.equal(v.seriesReduction, null);
    assert.equal(v.source, null);

    const m2 = load(dump(m1));
    assert.deepEqual(m2.verdicts, m1.verdicts);
  });
});
