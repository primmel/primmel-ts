// ─────────────────────────────────────────────────────────────────────
// The overlay deep-merge mechanism (smart TODO.roadmap/40 batch 3):
// the term-only `overlay true` escape generalized into the per-collection
// OVERLAY_DEEP_MERGE_FIELDS opt-in — field-wise merge (identity-keyed
// entry union preserving first-seen order, scalar-array append, scalar
// override) instead of the term-style whole-value replace. The opt-in
// set grows as its constructs land (workflowConfigs at B3.7,
// testReportChecklists at B3.10); these specs pin the merge helper's
// contract the construct codecs ride on.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OVERLAY_DEEP_MERGE_FIELDS,
  deepMergeOverlay,
} from '../src/ser-des/package';

describe('overlay deep-merge (smart TODO.roadmap/40 batch 3)', () => {
  it('the opt-in set carries exactly the landed overlay collections', () => {
    // workflowConfigs (B3.7) + testReportChecklists (B3.10). A field
    // name listed before its collection exists would be dead config.
    assert.deepEqual([...OVERLAY_DEEP_MERGE_FIELDS].sort(), [
      'testReportChecklists',
      'workflowConfigs',
    ]);
  });

  it('unions entry arrays by identity key preserving first-seen order', () => {
    const base = [
      { id: 'a', label: 'base a', gates: ['g1'] },
      { id: 'b', label: 'base b' },
      { id: 'c', label: 'base c' },
    ];
    const incoming = [
      { id: 'b', label: 'overlay b' },
      { id: 'd', label: 'overlay d' },
    ];
    const merged = deepMergeOverlay(base, incoming) as { id: string }[];
    // The overlaid entry merges IN PLACE — never reordered to the tail.
    assert.deepEqual(
      merged.map(e => e.id),
      ['a', 'b', 'c', 'd'],
    );
  });

  it('merges a shared entry field-wise: scalars override, arrays append', () => {
    const base = [
      {
        id: 'step',
        phase: 'dispatch',
        label: 'base label',
        gates: ['shared gate'],
        inputs: ['Application'],
      },
    ];
    const incoming = [
      {
        id: 'step',
        label: 'overlay label',
        gates: ['shared gate', 'rec gate one', 'rec gate two'],
      },
    ];
    const merged = deepMergeOverlay(base, incoming) as Record<
      string,
      unknown
    >[];
    assert.equal(merged.length, 1);
    const e = merged[0]!;
    // Facets the overlay does not name survive from the base.
    assert.equal(e.phase, 'dispatch');
    // Scalars the overlay names override.
    assert.equal(e.label, 'overlay label');
    // Scalar arrays append as a union — first occurrence keeps position.
    assert.deepEqual(e.gates, ['shared gate', 'rec gate one', 'rec gate two']);
    assert.deepEqual(e.inputs, ['Application']);
  });

  it('recurses into nested plain objects key-wise', () => {
    const base = { window: { years: 2 }, label: 'base' };
    const incoming = { window: { months: 6 } };
    assert.deepEqual(deepMergeOverlay(base, incoming), {
      window: { years: 2, months: 6 },
      label: 'base',
    });
  });

  it('consumes the overlay marker — it never survives into the merge', () => {
    const base = { id: 'x', label: 'base' };
    const incoming = { id: 'x', overlay: true, label: 'overlay' };
    assert.deepEqual(deepMergeOverlay(base, incoming), {
      id: 'x',
      label: 'overlay',
    });
  });

  it('scalar override: a re-typed facet replaces wholesale', () => {
    // Array over scalar (or the reverse) is no merge — the overlay's
    // value wins whole.
    assert.deepEqual(deepMergeOverlay({ a: 1 }, { a: [1, 2] }), { a: [1, 2] });
    assert.deepEqual(deepMergeOverlay({ a: ['x'] }, { a: 'y' }), { a: 'y' });
    assert.deepEqual(deepMergeOverlay(1, 2), 2);
  });

  it('a null incoming facet is the codec’s unstated marker — the base survives', () => {
    // Overlay codecs default unstated optional scalars to null (never
    // '') — the YAML overlay simply does not name the key, so the merge
    // must not let the default clobber the base.
    const base = [{ id: 'step', phase: 'dispatch', label: 'base label' }];
    const incoming = [{ id: 'step', phase: null, label: null, gates: ['g'] }];
    const merged = deepMergeOverlay(base, incoming) as Record<
      string,
      unknown
    >[];
    assert.equal(merged[0]!.phase, 'dispatch');
    assert.equal(merged[0]!.label, 'base label');
    assert.deepEqual(merged[0]!.gates, ['g']);
  });

  it('appends entry arrays that carry no id without merging', () => {
    // A non-keyed entry array (no string id on every element) falls back
    // to plain union append.
    assert.deepEqual(deepMergeOverlay([{ label: 'a' }], [{ label: 'b' }]), [
      { label: 'a' },
      { label: 'b' },
    ]);
  });
});
