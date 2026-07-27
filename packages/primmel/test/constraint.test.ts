import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

// constraint construct (TODO.roadmap/51 — BUG.R60-SSOT gap 7): the
// subject's own intrinsic validity rules (stereotype inv) — evaluated at
// declaration level; a violation invalidates the MEASUREMENT, never a fail.

const SRC = `constraint dead-load-max-geometry {
  stereotype inv
  name "Dead-load maximum geometry"
  check "ocl{model.parameters.d_max >= 0.9 * model.parameters.e_max and model.parameters.d_max <= model.parameters.e_max}"
  violation_meaning "The declared test setup does not realize the upper end of the measuring range — the type evaluation is void (R 60-1, 3.6; R 60-2, 2.7.3.4)."
  on_violation invalid
  source { doc "urn:oiml:pub:r:60-1:2021" clause "3.6" }
}

constraint warm-up-observability {
  stereotype inv
  check "ocl{model.parameters.warm_up_time.oclIsUndefined() or model.parameters.warm_up_time >= 0}"
  violation_meaning "The declared warm-up time is not a duration — the declaration cannot be judged."
  on_violation indeterminate
}
`;

describe('constraint construct', () => {
  it('parses every facet', () => {
    const m = load(SRC);
    const c = m.constraints.find(c => c.id === 'dead-load-max-geometry')!;
    assert.equal(c.stereotype, 'inv');
    assert.equal(c.name, 'Dead-load maximum geometry');
    assert.match(c.check, /^ocl\{/);
    assert.match(c.violationMeaning, /does not realize the upper end/);
    assert.equal(c.onViolation, 'invalid');
    assert.deepEqual(c.source, {
      doc: 'urn:oiml:pub:r:60-1:2021',
      clause: '3.6',
    });
  });

  it('defaults on_violation to invalid and tolerates absent name/source', () => {
    const m = load(SRC);
    const c = m.constraints.find(c => c.id === 'warm-up-observability')!;
    assert.equal(c.onViolation, 'indeterminate');
    assert.equal(c.name, '');
    assert.equal(c.source, null);
    const minimal = load(
      `constraint bare { check "ocl{true}" violation_meaning "x" }`,
    );
    assert.equal(minimal.constraints[0].onViolation, 'invalid');
    assert.equal(minimal.constraints[0].stereotype, '');
  });

  it('dump → re-parse round-trips (semantic fixed point)', () => {
    const once = load(SRC);
    const twice = load(dump(once));
    assert.deepEqual(
      twice.constraints.map(c => c.id).sort(),
      once.constraints.map(c => c.id).sort(),
    );
    const a = once.constraints.find(c => c.id === 'dead-load-max-geometry')!;
    const b = twice.constraints.find(c => c.id === 'dead-load-max-geometry')!;
    assert.deepEqual(b, a);
    // The dumper normalizes the default on_violation to its explicit token.
    const c = twice.constraints.find(c => c.id === 'warm-up-observability')!;
    assert.equal(c.onViolation, 'indeterminate');
  });
});
