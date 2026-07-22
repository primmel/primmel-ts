// ─────────────────────────────────────────────────────────────────────
// validate_provision round-trip pin (TODO.roadmap/17 review): the raw
// provision ids must survive load→dump→load with EVERY id re-emitted —
// a silent drop here is content loss the C5 coverage rule depends on
// (a process-verified requirement counts as covered, check.ts C5 leg b).
// Follows the nested-processes.test.ts round-trip pattern.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

describe('process validate_provision round-trip', () => {
  it('every provision id survives load→dump→load', () => {
    const src = `root Root

version "v1.0.0"

metadata {
  title "Test"
  schema "Primmel 0.1"
}

process ApplicationReview {
  name "Review the application"
  validate_provision { /req/cs/fee /req/cs/completeness }
}
`;
    const model = load(src);
    const proc = model.processes.find(p => p.id === 'ApplicationReview');
    assert.deepEqual(
      proc?.provisionRefs,
      ['/req/cs/fee', '/req/cs/completeness'],
      'both ids parsed',
    );

    const dumped = dump(model);
    assert.ok(
      dumped.includes('validate_provision {'),
      'the block is re-emitted',
    );
    assert.ok(dumped.includes('/req/cs/fee'), 'first id re-emitted');
    assert.ok(dumped.includes('/req/cs/completeness'), 'second id re-emitted');

    const reloaded = load(dumped);
    const proc2 = reloaded.processes.find(p => p.id === 'ApplicationReview');
    assert.deepEqual(
      proc2?.provisionRefs,
      ['/req/cs/fee', '/req/cs/completeness'],
      'both ids survive the full load→dump→load cycle',
    );
    // Fixed point: the second dump is byte-identical.
    assert.equal(dump(reloaded), dumped);
  });
});
