// ─────────────────────────────────────────────────────────────────────
// Mapping diff tests (TODO.roadmap/28; doctrine §13.2): pairs added /
// removed, description/justification changes, and the coverage DELTA —
// a reference component dropping cover because the implementation
// deleted a mapped process is a COMPUTED finding (the coverage
// calculus), never an authored one (§13.7).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../src/ser-des/index';
import { diffStandards, formatDiffReport } from '../src/model-diff';

// The implementation model: two operations mapped into the reference
// namespace StdS, with the local alias forest (StdS#… copies) the
// coverage calculus aggregates over.
const IMPL_A = `
process OpA { name "Operation A" }
process OpB { name "Operation B" }
process StdS#Process1 {
  name "alias of StdS Process1"
  process StdS#Process2 { name "alias of StdS Process2" }
  process StdS#Process3 { name "alias of StdS Process3" }
}
map_profile StdS {
  mapping {
    OpA -> StdS#Process2 { description "A fulfils 2" justification "reviewed 2017" }
    OpB -> StdS#Process3 { description "B fulfils 3" }
  }
}
`;

describe('mapping diff — pairs', () => {
  it('no mapping change, no coverage delta on a no-op diff', () => {
    const d = diffStandards(load(IMPL_A), load(IMPL_A));
    assert.equal(d.mappings.added.length, 0);
    assert.equal(d.mappings.removed.length, 0);
    assert.equal(d.mappings.changed.length, 0);
    assert.equal(d.mappings.coverageDelta.length, 0);
    assert.equal(d.mappings.namespacesSkipped.length, 0);
  });

  it('a mapping pair added in the new version reports as added', () => {
    const b = IMPL_A.replace(
      'OpB -> StdS#Process3 { description "B fulfils 3" }',
      'OpB -> StdS#Process3 { description "B fulfils 3" }\n    OpB -> StdS#Process2 { description "B also fulfils 2" }',
    );
    const d = diffStandards(load(IMPL_A), load(b));
    assert.equal(d.mappings.added.length, 1);
    assert.equal(d.mappings.added[0].source, 'OpB');
    assert.equal(d.mappings.added[0].target, 'StdS#Process2');
    assert.equal(d.mappings.removed.length, 0);
  });

  it('a mapping pair removed in the new version reports as removed', () => {
    const b = IMPL_A.replace(
      '    OpB -> StdS#Process3 { description "B fulfils 3" }\n',
      '',
    );
    const d = diffStandards(load(IMPL_A), load(b));
    assert.equal(d.mappings.removed.length, 1);
    assert.equal(d.mappings.removed[0].source, 'OpB');
    assert.equal(d.mappings.removed[0].target, 'StdS#Process3');
  });

  it('description and justification changes classify per pair', () => {
    const both = diffStandards(
      load(IMPL_A),
      load(
        IMPL_A.replace('A fulfils 2', 'A fulfils 2 via sampling').replace(
          'reviewed 2017',
          'reviewed 2021',
        ),
      ),
    );
    assert.equal(both.mappings.changed.length, 1);
    assert.equal(both.mappings.changed[0].source, 'OpA');
    assert.deepEqual(both.mappings.changed[0].aspects, [
      'description',
      'justification',
    ]);
    const descOnly = diffStandards(
      load(IMPL_A),
      load(IMPL_A.replace('B fulfils 3', 'B fulfils 3 directly')),
    );
    assert.deepEqual(descOnly.mappings.changed[0].aspects, ['description']);
  });
});

describe('mapping diff — coverage delta (computed, never authored)', () => {
  it('a removed mapping drops the component full → none', () => {
    const b = IMPL_A.replace(
      '    OpB -> StdS#Process3 { description "B fulfils 3" }\n',
      '',
    );
    const d = diffStandards(load(IMPL_A), load(b));
    const delta = d.mappings.coverageDelta.find(
      c => c.namespace === 'StdS' && c.component === 'Process3',
    );
    assert.ok(delta, 'a Process3 coverage delta');
    assert.equal(delta.from, 'full');
    assert.equal(delta.to, 'none');
    // …and the root re-aggregates (was full with both children mapped,
    // drops to partial).
    const root = d.mappings.coverageDelta.find(c => c.component === 'Process1');
    assert.equal(root?.from, 'full');
    assert.equal(root?.to, 'partial');
  });

  it('deleting the mapped IMPLEMENTATION process removes the pair AND drops cover', () => {
    // The spec's example: a reference component drops from full cover
    // because the implementation deleted the mapped process — a computed
    // finding, not a discovered one.
    const b = IMPL_A.replace('process OpB { name "Operation B" }\n', '').replace(
      '    OpB -> StdS#Process3 { description "B fulfils 3" }\n',
      '',
    );
    const d = diffStandards(load(IMPL_A), load(b));
    assert.equal(d.removed.length, 1);
    assert.equal(d.removed[0].id, 'OpB');
    assert.equal(d.mappings.removed.length, 1);
    const delta = d.mappings.coverageDelta.find(c => c.component === 'Process3');
    assert.equal(delta?.from, 'full');
    assert.equal(delta?.to, 'none');
  });

  it('a namespace with no tree on either side is skipped, not zeroed', () => {
    const orphan = `
process OpA { name "Operation A" }
map_profile StdX {
  mapping { OpA -> StdX#Process9 }
}
`;
    const d = diffStandards(load(orphan), load(orphan));
    assert.deepEqual(d.mappings.namespacesSkipped, ['StdX']);
    assert.equal(d.mappings.coverageDelta.length, 0);
  });

  it('a caller-supplied reference tree computes the delta without aliases', () => {
    const reference = load(`
process Process1 {
  name "Process 1"
  process Process2 { name "Process 2" }
  process Process3 { name "Process 3" }
}
`);
    const b = IMPL_A.replace(
      '    OpB -> StdS#Process3 { description "B fulfils 3" }\n',
      '',
    );
    const d = diffStandards(load(IMPL_A), load(b), {
      references: { StdS: reference },
    });
    const delta = d.mappings.coverageDelta.find(c => c.component === 'Process3');
    assert.equal(delta?.from, 'full');
    assert.equal(delta?.to, 'none');
  });
});

describe('mapping diff — in the report', () => {
  it('formatDiffReport lists pair changes and coverage deltas', () => {
    const b = IMPL_A.replace(
      '    OpB -> StdS#Process3 { description "B fulfils 3" }\n',
      '',
    );
    const d = diffStandards(load(IMPL_A), load(b));
    const report = formatDiffReport(d);
    assert.match(report, /mappings: \+0 -1 ~0 pairs, 2 coverage deltas/);
    assert.match(report, /coverage StdS#Process3: full → none/);
  });
});
