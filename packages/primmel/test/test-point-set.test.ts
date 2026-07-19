import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

// test_point_set construct (specification/test-point-sets.yaml): named,
// shared test-point sets referenced by conformance tests (R 144-2, 1.2).

const SRC = `test_point_set r144-cgm-points {
  description "CGM test points within the measuring range for error determination (R 144-2, 1.2)."
  source { doc "urn:oiml:pub:r:144-2:2013" clause "1.2" }
  cardinality {
    linear { min_points 3 rule "min +10 %, mid ±10 %, max −10 % of the measuring range" }
    nonlinear { min_points 5 rule "uniformly distributed" }
  }
  repetitions_per_point 3
  points {
    point min-10pct { fraction 0.10 anchor range_min offset "+10 % of range" }
    point mid { fraction 0.50 anchor range_mid offset "±10 %" }
    point max-10pct { fraction 0.90 anchor range_max offset "−10 % of range" }
  }
}
`;

describe('test_point_set construct', () => {
  it('parses description, source, and repetitions', () => {
    const m = load(SRC);
    const s = m.testPointSets.find(s => s.id === 'r144-cgm-points')!;
    assert.match(s.description, /CGM test points/);
    assert.deepEqual(s.source, {
      doc: 'urn:oiml:pub:r:144-2:2013',
      clause: '1.2',
    });
    assert.equal(s.repetitionsPerPoint, 3);
  });

  it('parses cardinality entries', () => {
    const m = load(SRC);
    const c = m.testPointSets[0].cardinality;
    assert.deepEqual(Object.keys(c), ['linear', 'nonlinear']);
    assert.deepEqual(c.linear, {
      minPoints: 3,
      rule: 'min +10 %, mid ±10 %, max −10 % of the measuring range',
    });
    assert.deepEqual(c.nonlinear, {
      minPoints: 5,
      rule: 'uniformly distributed',
    });
  });

  it('parses points', () => {
    const m = load(SRC);
    const points = m.testPointSets[0].points;
    assert.equal(points.length, 3);
    assert.deepEqual(points[0], {
      id: 'min-10pct',
      fraction: 0.1,
      anchor: 'range_min',
      offset: '+10 % of range',
    });
    assert.deepEqual(points[1], {
      id: 'mid',
      fraction: 0.5,
      anchor: 'range_mid',
      offset: '±10 %',
    });
    assert.equal(points[2].anchor, 'range_max');
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('test_point_set r144-cgm-points {'));
    assert.ok(dumped.includes('linear { min_points 3'));
    assert.ok(dumped.includes('repetitions_per_point 3'));
    assert.ok(dumped.includes('point mid {'));

    const m2 = load(dumped);
    assert.deepEqual(m2.testPointSets, m1.testPointSets);
    assert.equal(dump(m2), dumped);
  });

  it('handles a set without optional cardinality and points', () => {
    const m1 = load(`test_point_set sparse {
      description "Only a description"
    }`);
    const s = m1.testPointSets[0];
    assert.equal(s.source, null);
    assert.deepEqual(s.cardinality, {});
    assert.equal(s.repetitionsPerPoint, null);
    assert.deepEqual(s.points, []);
    const m2 = load(dump(m1));
    assert.deepEqual(m2.testPointSets, m1.testPointSets);
  });
});
