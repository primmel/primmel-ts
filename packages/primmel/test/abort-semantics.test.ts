// ─────────────────────────────────────────────────────────────────────
// The abort transition's semantics (spec §10, spec#56): WHO may fire
// `aborted` (the closed actor vocabulary — the run's performer or the
// scheme operator), the mandatory evidence (the reason — an abort
// without its reason is an unrecorded stop), the once-only transition,
// and the store doctrine (the captured evidence and programs STAND —
// the aborted run's partial records land in the declared store, marked
// by the terminal state, never deleted).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { abortRun, type Run } from '../src/runtime';

function run(): Run {
  return {
    instance: 'lc-1',
    test: '/conf/metrological-tests/creep',
    programs: [],
    verdicts: [],
    trajectory: [],
    evidence: [{ form: 'probe', fields: { indication: 100 } } as never],
  };
}

describe('the abort transition (spec#56)', () => {
  it('the performer fires the abort with its reason; the evidence stands', () => {
    const r = abortRun(run(), {
      by: 'laboratory',
      reason: 'the chamber lost conditioning mid-program',
      at: '2026-10-21T09:00:00Z',
    });
    assert.deepEqual(r.abort, {
      by: 'laboratory',
      reason: 'the chamber lost conditioning mid-program',
      at: '2026-10-21T09:00:00Z',
    });
    // The store doctrine: the captured record is the record.
    assert.equal(r.evidence.length, 1);
    assert.deepEqual(r.programs, []);
  });

  it('the scheme can direct the stop (the directed stop is a scheme finding)', () => {
    const r = abortRun(run(), {
      by: 'scheme',
      reason: 'IA-directed: the reference instrument is out of calibration',
    });
    assert.equal(r.abort?.by, 'scheme');
  });

  it('the actor vocabulary is closed', () => {
    for (const by of ['IA', 'lab', '', 42, null]) {
      assert.throws(
        () => abortRun(run(), { by: by as never, reason: 'x' }),
        undefined,
        `refuses ${String(by)}`,
      );
    }
  });

  it('the reason is mandatory and never blank', () => {
    assert.throws(
      () => abortRun(run(), { by: 'laboratory', reason: '' }),
      /reason is mandatory/,
    );
    assert.throws(
      () => abortRun(run(), { by: 'laboratory', reason: '   ' }),
      /reason is mandatory/,
    );
    // A padded reason is trimmed into the recorded evidence.
    const r = abortRun(run(), { by: 'manufacturer', reason: '  operator safety stop  ' });
    assert.equal(r.abort?.reason, 'operator safety stop');
  });

  it('at, when present, is an ISO 8601 datetime', () => {
    assert.throws(
      () => abortRun(run(), { by: 'laboratory', reason: 'x', at: 'tuesday' }),
      /ISO 8601/,
    );
  });

  it('the transition fires once', () => {
    const r = abortRun(run(), { by: 'laboratory', reason: 'first' });
    assert.throws(() => abortRun(r, { by: 'scheme', reason: 'second' }), /fires once/);
    assert.equal(r.abort?.reason, 'first');
  });
});
