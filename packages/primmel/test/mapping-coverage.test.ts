// ─────────────────────────────────────────────────────────────────────
// Coverage calculus engine tests (TODO.roadmap/04; concept doc §5.3,
// §5.6; Mapping Guide slides 5–19, 46).
//
// The CANONICAL fixture is the doctrine's Process1–6 tree. The Mapping
// Guide's actual tree is:
//
//   Process1 ─┬─ Process5          (serial children — all required)
//             └─ Process6
//   Process2 ─┬─ Process3          (gateway children — at least one)
//             └─ Process4
//
// The fixture below relabels the children — Process3/4 under Process1,
// Process5/6 under gateway Process2, matching the concept-doc diagram.
// The two trees are isomorphic FOR THE CALCULUS: with mappings
// OpA ⇒ StdS#Process5 and OpB ⇒ StdS#Process3, exactly one child of
// each parent is directly mapped in both readings, so the asserted
// table is identical: Process5 full, Process3 full, Process2 minimal
// (gateway minimum met), Process4 no cover, Process1 partial, Process6
// no cover.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../src/ser-des/index';
import {
  applyView,
  buildProcessTree,
  collectMappings,
  computeCoverage,
  discoverTransitive,
  parseTargetRef,
  repoMap,
  type CoverageReport,
  type MappingRecord,
} from '../src/mapping-coverage';

/** The canonical reference tree (Process1–6). */
const REFERENCE_SRC = `
process Process1 {
  name "Process 1"
  process Process3 { name "Process 3" }
  process Process4 { name "Process 4" }
}
process Process2 {
  name "Process 2"
  child_composition gateway
  process Process5 { name "Process 5" }
  process Process6 { name "Process 6" }
}
`;

/** The implementation model: three operations, two mappings into StdS. */
const IMPL_SRC = `
process OpA { name "Operation A" }
process OpB { name "Operation B" }
process OpC { name "Operation C" }
map_profile StdS {
  mapping {
    OpA -> StdS#Process5
    OpB -> StdS#Process3
  }
}
`;

function canonicalReport(): CoverageReport {
  const impl = load(IMPL_SRC);
  const ref = load(REFERENCE_SRC);
  const mappings = collectMappings(impl, { modelId: 'OrgO' });
  return computeCoverage(impl, ref, mappings, 'StdS', {
    implementationId: 'OrgO',
    referenceId: 'StdS',
  });
}

function coverageOf(report: CoverageReport, id: string) {
  const c = report.components.find(x => x.id === id);
  assert.ok(c, `component ${id} in the report`);
  return c;
}

describe('mapping engine — parseTargetRef', () => {
  it('splits Namespace#ElementID and scopes bare ids by the profile ns', () => {
    assert.deepEqual(parseTargetRef('StdS#Process5', 'StdS'), {
      namespace: 'StdS',
      id: 'Process5',
      qualified: 'StdS#Process5',
    });
    assert.deepEqual(parseTargetRef('Process5', 'StdS'), {
      namespace: 'StdS',
      id: 'Process5',
      qualified: 'StdS#Process5',
    });
  });
});

describe('coverage calculus — the canonical Process1–6 fixture', () => {
  it('computes exactly the documented levels', () => {
    const report = canonicalReport();
    const table = Object.fromEntries(
      report.components.map(c => [c.id, c.coverage]),
    );
    assert.deepEqual(table, {
      Process1: 'partial',
      Process3: 'full',
      Process4: 'none',
      Process2: 'minimal',
      Process5: 'full',
      Process6: 'none',
    });
  });

  it('marks direct mappings and their sources', () => {
    const report = canonicalReport();
    const p5 = coverageOf(report, 'Process5');
    assert.equal(p5.directlyMapped, true);
    assert.deepEqual(p5.mappedBy, ['OpA']);
    const p3 = coverageOf(report, 'Process3');
    assert.equal(p3.directlyMapped, true);
    assert.deepEqual(p3.mappedBy, ['OpB']);
  });

  it('aggregates a gateway parent to minimal when the minimum is met', () => {
    const report = canonicalReport();
    const p2 = coverageOf(report, 'Process2');
    assert.equal(p2.coverage, 'minimal');
    assert.equal(p2.directlyMapped, false);
  });

  it('aggregates a serial parent to partial when not all children cover', () => {
    const report = canonicalReport();
    assert.equal(coverageOf(report, 'Process1').coverage, 'partial');
  });

  it('lists the unmapped implementation components', () => {
    const report = canonicalReport();
    assert.deepEqual(report.unmappedImplementation, ['OpC']);
  });

  it('tallies the summary', () => {
    const report = canonicalReport();
    assert.deepEqual(report.summary, {
      full: 2,
      minimal: 1,
      partial: 1,
      none: 2,
    });
  });
});

describe('coverage calculus — inheritance (downward)', () => {
  it('a mapped process fully covers its whole subprocess tree', () => {
    const impl = load(`
      process OpB { name "B" }
      map_profile StdS { mapping { OpB -> StdS#Process1 } }
    `);
    const ref = load(REFERENCE_SRC);
    const report = computeCoverage(
      impl,
      ref,
      collectMappings(impl, { modelId: 'OrgO' }),
      'StdS',
    );
    assert.equal(coverageOf(report, 'Process1').coverage, 'full');
    assert.equal(coverageOf(report, 'Process3').coverage, 'full');
    assert.equal(coverageOf(report, 'Process4').coverage, 'full');
    assert.equal(coverageOf(report, 'Process3').inheritedFrom, 'Process1');
    assert.equal(coverageOf(report, 'Process4').inheritedFrom, 'Process1');
    assert.equal(coverageOf(report, 'Process3').directlyMapped, false);
  });

  it('proposes inherited pairs, flagged and never asserted', () => {
    const impl = load(`
      process OpB { name "B" }
      map_profile StdS { mapping { OpB -> StdS#Process2 } }
    `);
    const ref = load(REFERENCE_SRC);
    const report = computeCoverage(
      impl,
      ref,
      collectMappings(impl, { modelId: 'OrgO' }),
      'StdS',
    );
    const inherited = report.proposals.filter(p => p.kind === 'inherited');
    assert.deepEqual(inherited.map(p => `${p.source}⇒${p.target}`).sort(), [
      'OpB⇒StdS#Process5',
      'OpB⇒StdS#Process6',
    ]);
    for (const p of inherited) {
      assert.equal(p.asserted, false, 'proposals are flagged, never asserted');
      assert.deepEqual(p.via, ['StdS#Process2']);
    }
  });
});

describe('coverage calculus — aggregation (upward) + closure', () => {
  it('all gateway branches mapped ⇒ parent full (slide 9, no mapping icon)', () => {
    const impl = load(`
      process OpA { name "A" }
      process OpX { name "X" }
      map_profile StdS {
        mapping {
          OpA -> StdS#Process5
          OpX -> StdS#Process6
        }
      }
    `);
    const ref = load(REFERENCE_SRC);
    const report = computeCoverage(
      impl,
      ref,
      collectMappings(impl, { modelId: 'OrgO' }),
      'StdS',
    );
    // Asserted as a coverage LEVEL by aggregation — without a direct pair.
    assert.equal(coverageOf(report, 'Process2').coverage, 'full');
    assert.equal(coverageOf(report, 'Process2').directlyMapped, false);
  });

  it('flags closure candidates for confirmation, never asserts them', () => {
    const impl = load(`
      process OpA { name "A" }
      process OpX { name "X" }
      map_profile StdS {
        mapping {
          OpA -> StdS#Process5
          OpX -> StdS#Process6
        }
      }
    `);
    const ref = load(REFERENCE_SRC);
    const report = computeCoverage(
      impl,
      ref,
      collectMappings(impl, { modelId: 'OrgO' }),
      'StdS',
    );
    const closure = report.proposals.filter(p => p.kind === 'closure');
    assert.deepEqual(closure.map(p => `${p.source}⇒${p.target}`).sort(), [
      'OpA⇒StdS#Process2',
      'OpX⇒StdS#Process2',
    ]);
    for (const p of closure) {
      assert.equal(p.asserted, false, 'closure is flagged, never asserted');
      assert.deepEqual(p.via.sort(), ['StdS#Process5', 'StdS#Process6']);
    }
  });

  it('serial parent: all children full ⇒ full; all none ⇒ none', () => {
    const impl = load(`
      process OpB { name "B" }
      process OpC { name "C" }
      map_profile StdS {
        mapping {
          OpB -> StdS#Process3
          OpC -> StdS#Process4
        }
      }
    `);
    const ref = load(REFERENCE_SRC);
    const full = computeCoverage(
      impl,
      ref,
      collectMappings(impl, { modelId: 'OrgO' }),
      'StdS',
    );
    assert.equal(coverageOf(full, 'Process1').coverage, 'full');

    const none = computeCoverage(
      load('process OpA { name "A" }'),
      ref,
      [],
      'StdS',
    );
    assert.equal(coverageOf(none, 'Process1').coverage, 'none');
    assert.equal(coverageOf(none, 'Process2').coverage, 'none');
  });
});

describe('coverage calculus — multi-target (one implementation, many references)', () => {
  const MULTI_IMPL = `
process OpA { name "A" }
map_profile StdS { mapping { OpA -> StdS#Process5 } }
map_profile StdT { mapping { OpA -> StdT#Control1 } }
`;
  const REF_T = `
process Control1 { name "Control 1" }
process Control2 { name "Control 2" }
`;

  it('computes independent per-target coverage', () => {
    const impl = load(MULTI_IMPL);
    const mappings = collectMappings(impl, { modelId: 'OrgO' });
    const refS = load(REFERENCE_SRC);
    const refT = load(REF_T);

    const reportS = computeCoverage(impl, refS, mappings, 'StdS');
    const reportT = computeCoverage(impl, refT, mappings, 'StdT');

    assert.equal(coverageOf(reportS, 'Process5').coverage, 'full');
    assert.equal(coverageOf(reportS, 'Process5').mappedBy.length, 1);
    // StdT components do not leak into the StdS report.
    assert.deepEqual(
      reportS.components.map(c => c.id),
      ['Process1', 'Process3', 'Process4', 'Process2', 'Process5', 'Process6'],
    );
    assert.equal(coverageOf(reportT, 'Control1').coverage, 'full');
    assert.equal(coverageOf(reportT, 'Control2').coverage, 'none');
    assert.deepEqual(
      reportT.components.map(c => c.id),
      ['Control1', 'Control2'],
    );
  });
});

describe('coverage report — unresolved mappings are explicit, never silent', () => {
  it('a fully-dangling mapping set yields a non-empty unresolved section', () => {
    const impl = load(`
      process OpA { name "A" }
      map_profile StdS { mapping { OpA -> StdS#Ghost } }
    `);
    const ref = load(REFERENCE_SRC);
    const report = computeCoverage(
      impl,
      ref,
      collectMappings(impl, { modelId: 'OrgO' }),
      'StdS',
    );
    // The dangling pair is reported — not silently dropped.
    assert.deepEqual(report.unresolvedMappings, [
      { source: 'OpA', target: 'StdS#Ghost' },
    ]);
    // No reference component is marked mapped by the dangling pair…
    assert.ok(report.components.every(c => !c.directlyMapped));
    assert.equal(report.summary.none, 6);
    // …and its source is NOT counted as mapped.
    assert.deepEqual(report.unmappedImplementation, ['OpA']);
  });

  it('a source stays mapped only through a RESOLVING pair', () => {
    const impl = load(`
      process OpA { name "A" }
      process OpB { name "B" }
      map_profile StdS {
        mapping {
          OpA -> StdS#Process5
          OpA -> StdS#Ghost
          OpB -> StdS#AlsoGhost
        }
      }
    `);
    const ref = load(REFERENCE_SRC);
    const report = computeCoverage(
      impl,
      ref,
      collectMappings(impl, { modelId: 'OrgO' }),
      'StdS',
    );
    assert.deepEqual(report.unresolvedMappings, [
      { source: 'OpA', target: 'StdS#Ghost' },
      { source: 'OpB', target: 'StdS#AlsoGhost' },
    ]);
    assert.equal(coverageOf(report, 'Process5').directlyMapped, true);
    // OpA has a resolving pair (mapped); OpB's only pair dangles (unmapped).
    assert.deepEqual(report.unmappedImplementation, ['OpB']);
  });

  it('the canonical fixture has no unresolved mappings', () => {
    assert.deepEqual(canonicalReport().unresolvedMappings, []);
  });
});

describe('discovery — process-level transitivity across the mapping space', () => {
  const record = (
    sourceModel: string,
    source: string,
    target: string,
  ): MappingRecord => ({
    source,
    sourceModel,
    target,
    targetModel: target.split('#')[0],
    description: '',
    justification: '',
    assertedCoverage: '',
  });

  it('A ⇒ B and B ⇒ C proposes A ⇒ C through the shared component', () => {
    const proposals = discoverTransitive([
      { modelId: 'aaa', mappings: [record('aaa', 'P1', 'bbb#P1')] },
      { modelId: 'bbb', mappings: [record('bbb', 'P1', 'ccc#P2')] },
      { modelId: 'ccc', mappings: [] },
    ]);
    assert.equal(proposals.length, 1);
    const p = proposals[0];
    assert.equal(p.kind, 'transitive');
    assert.equal(p.sourceModel, 'aaa');
    assert.equal(p.source, 'P1');
    assert.equal(p.targetModel, 'ccc');
    assert.equal(p.target, 'ccc#P2');
    assert.deepEqual(p.via, ['bbb#P1']);
    assert.equal(p.asserted, false, 'transitivity is discovery, not assertion');
  });

  it('model-level non-transitivity: no shared component ⇒ no proposal', () => {
    // Slide 15: aaa P1 ⇒ bbb P1 and bbb P2 ⇒ ccc P2 carry no logical
    // information — the engine must NOT chain them.
    const proposals = discoverTransitive([
      { modelId: 'aaa', mappings: [record('aaa', 'P1', 'bbb#P1')] },
      { modelId: 'bbb', mappings: [record('bbb', 'P2', 'ccc#P2')] },
    ]);
    assert.deepEqual(proposals, []);
  });

  it('chains of arbitrary depth unfold hop by hop', () => {
    const proposals = discoverTransitive([
      { modelId: 'user', mappings: [record('user', 'U1', 'product#P1')] },
      { modelId: 'product', mappings: [record('product', 'P1', 'std#S1')] },
      { modelId: 'std', mappings: [record('std', 'S1', 'law#L1')] },
    ]);
    assert.deepEqual(
      proposals.map(p => `${p.sourceModel}#${p.source}⇒${p.target}`).sort(),
      ['product#P1⇒law#L1', 'user#U1⇒std#S1'],
    );
  });
});

describe('the repo map (model level, declared links only)', () => {
  it('reports which models map to which — no transitive closure', () => {
    const models = [
      {
        modelId: 'aaa',
        mappings: [
          {
            source: 'P1',
            sourceModel: 'aaa',
            target: 'bbb#P1',
            targetModel: 'bbb',
            description: '',
            justification: '',
            assertedCoverage: '' as const,
          },
        ],
      },
      {
        modelId: 'bbb',
        mappings: [
          {
            source: 'P1',
            sourceModel: 'bbb',
            target: 'ccc#P2',
            targetModel: 'ccc',
            description: '',
            justification: '',
            assertedCoverage: '' as const,
          },
        ],
      },
    ];
    const edges = repoMap(models);
    assert.deepEqual(edges, [
      { from: 'aaa', to: 'bbb', pairs: 1 },
      { from: 'bbb', to: 'ccc', pairs: 1 },
    ]);
    // aaa ⇒ ccc is NOT inferred at model level (slide 14/15).
    assert.ok(!edges.some(e => e.from === 'aaa' && e.to === 'ccc'));
  });
});

describe('views — read-only lenses over a model', () => {
  it('projects the selected elements and their attributable coverage', () => {
    const impl = load(`
      process OpA { name "A" }
      process OpB { name "B" }
      process OpC { name "C" }
      view_profile QmsLens {
        description "The QMS lens"
        visible { OpA OpC }
        against StdS
      }
      map_profile StdS {
        mapping {
          OpA -> StdS#Process5
          OpB -> StdS#Process3
        }
      }
    `);
    const ref = load(REFERENCE_SRC);
    const report = computeCoverage(
      impl,
      ref,
      collectMappings(impl, { modelId: 'OrgO' }),
      'StdS',
    );
    const view = impl.viewProfiles[0];
    const projection = applyView(impl, view, report);

    assert.equal(projection.id, 'QmsLens');
    assert.equal(projection.against, 'StdS');
    assert.deepEqual(projection.elements, ['OpA', 'OpC']);
    // Only the coverage attributable to visible sources shows: Process5
    // (mapped from OpA) — not Process3 (mapped from the hidden OpB).
    assert.deepEqual(
      projection.coverage?.components.map(c => c.id),
      ['Process5'],
    );
    assert.deepEqual(projection.coverage?.summary, {
      full: 1,
      minimal: 0,
      partial: 0,
      none: 0,
    });
    assert.deepEqual(projection.coverage?.unmappedImplementation, ['OpC']);
  });

  it('never mutates the model or the report; the projection is frozen', () => {
    const impl = load(`
      process OpA { name "A" }
      view_profile Lens { visible { OpA } against StdS }
      map_profile StdS { mapping { OpA -> StdS#Process5 } }
    `);
    const ref = load(REFERENCE_SRC);
    const report = computeCoverage(
      impl,
      ref,
      collectMappings(impl, { modelId: 'OrgO' }),
      'StdS',
    );
    const componentsBefore = report.components.length;
    const projection = applyView(impl, impl.viewProfiles[0], report);

    assert.equal(
      report.components.length,
      componentsBefore,
      'the underlying report is untouched',
    );
    assert.ok(Object.isFrozen(projection));
    assert.ok(Object.isFrozen(projection.coverage));
    assert.ok(Object.isFrozen(projection.coverage?.components));
    try {
      (projection as { elements: string[] }).elements = [];
    } catch {
      // strict mode throws TypeError; sloppy mode silently ignores
    }
    assert.deepEqual(
      projection.elements,
      ['OpA'],
      'a view never edits the model it reads',
    );
  });
});

describe('buildProcessTree — the tree source', () => {
  it('builds the forest from declared parent/children links', () => {
    const ref = load(REFERENCE_SRC);
    const forest = buildProcessTree(ref);
    assert.deepEqual(
      forest.map(r => r.id),
      ['Process1', 'Process2'],
    );
    assert.deepEqual(
      forest[0].children.map(c => c.id),
      ['Process3', 'Process4'],
    );
    assert.equal(forest[1].composition, 'gateway');
    assert.equal(forest[0].composition, 'all');
  });

  it('lifts an alias forest by id prefix (the linter’s local reference copy)', () => {
    const impl = load(`
      process OpA { name "A" }
      process StdS#Process2 {
        name "alias of Process2"
        child_composition gateway
        process StdS#Process5 { name "alias of Process5" }
        process StdS#Process6 { name "alias of Process6" }
      }
    `);
    // The prefix is stripped: an alias StdS#Process5 stands in for the
    // reference element Process5.
    const forest = buildProcessTree(impl, { idPrefix: 'StdS#' });
    assert.deepEqual(
      forest.map(r => r.id),
      ['Process2'],
    );
    assert.equal(forest[0].composition, 'gateway');
    assert.deepEqual(
      forest[0].children.map(c => c.id),
      ['Process5', 'Process6'],
    );
  });
});

describe('coverage — the C21 alias rows in unmappedImplementation (TODO.v2/13 item 6)', () => {
  // The implementation declares the reference elements it maps to as
  // local `Namespace#…` alias processes (the C21 discipline). Aliases are
  // never mapping SOURCES, so they always list as unmapped — noise in an
  // uncovered-elements list (the VL-3 review's footnote filter). The
  // `unmappedAliases` option keeps the default honest ('include') and
  // opts into the domain-only list ('exclude').
  const IMPL_WITH_ALIASES = `
process OpA { name "Operation A" }
process OpC { name "Operation C" }
process StdS#Process5 { name "alias of Process5" }
process StdS#Process3 { name "alias of Process3" }
map_profile StdS {
  mapping {
    OpA -> StdS#Process5
  }
}
`;
  const report = (unmappedAliases?: 'include' | 'exclude'): CoverageReport => {
    const impl = load(IMPL_WITH_ALIASES);
    const ref = load(REFERENCE_SRC);
    const mappings = collectMappings(impl, { modelId: 'OrgO' });
    return computeCoverage(impl, ref, mappings, 'StdS', {
      implementationId: 'OrgO',
      referenceId: 'StdS',
      unmappedAliases,
    });
  };

  it('the default INCLUDES the alias rows (the honest full picture)', () => {
    assert.deepEqual(report().unmappedImplementation, [
      'OpC',
      'StdS#Process5',
      'StdS#Process3',
    ]);
    assert.deepEqual(report('include').unmappedImplementation, [
      'OpC',
      'StdS#Process5',
      'StdS#Process3',
    ]);
  });

  it("'exclude' drops the #-carrying rows, never the domain rows", () => {
    assert.deepEqual(report('exclude').unmappedImplementation, ['OpC']);
  });

  it('the option leaves the rest of the report untouched', () => {
    const full = report();
    const excluded = report('exclude');
    assert.deepEqual(excluded.components, full.components);
    assert.deepEqual(excluded.summary, full.summary);
    assert.deepEqual(excluded.unresolvedMappings, full.unresolvedMappings);
  });
});
