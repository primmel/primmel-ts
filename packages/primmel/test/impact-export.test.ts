// ─────────────────────────────────────────────────────────────────────
// The impact-graph export (Primmel v3.2, TODO.primmel/11; MN 114 clause
// 17.8 — primmel/spec#18 ask 7): the adjacency form of the model's
// edge-bearing facets, keyed by package-authored element id, with the
// forward and reverse indexes a change-impact read consumes. Covers the
// edge registry (every construct family's rows), the provenance
// carriage, the reverse-index congruence, and the CLI arm.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  exportPackageImpact,
  IMPACT_GRAPH_VERSION,
  impactGraph,
  type ImpactGraph,
} from '../src/export/impact';
import { load } from '../src/ser-des/index';

const CLI = join(__dirname, '..', 'scripts', 'check.mts');

const MODEL = `quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg }
  unit kg { symbol "kg" kind mass factor 1 }
}
attribute_definition e_max {
  quantity_kind mass
  unit kg
  scope model
}
symbol e_l { label "e" quantity_kind mass unit kg }
instrument LoadCell {
  dimension accuracy_class {
    values {
      A { }
      B { }
      AB { implies { A B } }
    }
  }
}
behavior temp-effect {
  name "Temperature effect"
}
verdict v_base {
  quantity { kind mass unit kg }
  derive "ocl{...}"
  inputs { e_l }
  source { doc "urn:oiml:pub:r:60-1:2021" clause "5.3.2" }
}
verdict v_top {
  quantity { kind mass unit kg }
  derive "ocl{...}"
  inputs { v_base }
}
calculation mpe_absolute {
  name "MPE absolute"
  inputs {
    e_l : number { unit "kg" }
  }
  output : number { unit "kg" }
  expression "ocl{...}"
  lookup { key mpe_table }
  params { p_lc }
  ref derives-from "urn:oiml:pub:r:60-1:2021#clause-5.1"
}
requirement /req/metrological/mpe {
  name "Maximum permissible error"
  statement "The error of indication shall not exceed the mpe."
  binds_to { model.parameters.e_max }
  dependencies { /req/general/zero }
  applicability { accuracy_class: [A, B] }
  channel measurand_components
  limit {
    expression "ocl{...}"
    quantity { kind mass unit kg }
    accepts { verdict v_top op lte limit "ocl{...}" }
  }
  source { doc "urn:oiml:pub:r:60-1:2021" clause "5.3.2" }
}
requirement /req/general/zero {
  name "Zero"
  statement "s"
}
conformance_test /conf/mpe-test {
  name "MPE test"
  targets { /req/metrological/mpe }
  dependencies { /conf/zero-test }
  instances { by accuracy_class }
  result_forms { /form/eval }
  produces_artifacts { /artifact/tr }
}
conformance_test /conf/zero-test {
  name "Zero test"
}
form /form/eval {
  name "Evaluation report"
  requirements { /req/metrological/mpe }
  calculation_context { dimensions true tables { mpe_table } }
  field error_at_load : number {
    bind "model.parameters.e_max"
    verdict v_top
    targets { /req/metrological/mpe }
  }
}
formulas_used /conf/mpe-test {
  name "MPE formulas"
  description "d"
  formulas { mpe_absolute }
}
instance smp-1 {
  of LoadCell
  level sample
  model mod-1
  family fam-1
}
instance mod-1 {
  of LoadCell
  level model
  family fam-1
}
`;

function fixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-impact-'));
  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'package.primmel'),
    `package {
  id oiml-r60-demo
  kind rec
  title "Demo"
  version "2021"
  editions { 2021 2017 }
  baseUrn "urn:oiml:pub:r:60:2021"
  supersedes urn:oiml:pub:r:60:2017
  superseded_by { urn:oiml:pub:r:60:2031 }
  description "d"
}`,
  );
  writeFileSync(join(dir, 'model', 'm.prl'), MODEL);
  return dir;
}

describe('impact-graph export', () => {
  const graph: ImpactGraph = exportPackageImpact(fixtureDir()).graph;

  it('carries the version identifier and the package block', () => {
    assert.equal(graph.version, IMPACT_GRAPH_VERSION);
    assert.equal(graph.package.id, 'oiml-r60-demo');
    assert.equal(graph.package.baseUrn, 'urn:oiml:pub:r:60:2021');
  });

  it('the requirement row: binds_to / dependencies / accepts / applicability / channel', () => {
    const edges = graph.forward['/req/metrological/mpe'];
    const kinds = edges.map(e => `${e.kind}:${e.facet}:${e.target}`);
    assert.ok(kinds.includes('binding:binds_to:model.parameters.e_max'));
    assert.ok(kinds.includes('prerequisite:dependencies:/req/general/zero'));
    assert.ok(kinds.includes('acceptance:limit.accepts.verdict:v_top'));
    assert.ok(kinds.includes('classification:applicability:accuracy_class'));
    assert.ok(kinds.includes('evidence channel:channel:measurand_components'));
    // Clause provenance of the edge-bearing element rides every edge.
    for (const e of edges) {
      assert.deepEqual(e.source, {
        doc: 'urn:oiml:pub:r:60-1:2021',
        clause: '5.3.2',
      });
    }
  });

  it('the conformance_test row', () => {
    const edges = graph.forward['/conf/mpe-test'];
    const kinds = edges.map(e => `${e.kind}:${e.facet}:${e.target}`);
    assert.ok(kinds.includes('coverage:targets:/req/metrological/mpe'));
    assert.ok(kinds.includes('prerequisite:dependencies:/conf/zero-test'));
    assert.ok(kinds.includes('instantiation:instances.by:accuracy_class'));
    assert.ok(kinds.includes('evidence view:result_forms:/form/eval'));
    assert.ok(kinds.includes('issuance:produces_artifacts:/artifact/tr'));
  });

  it('the verdict row: inputs classify as derivation vs acceptance chain', () => {
    const base = graph.forward['v_base'];
    assert.ok(
      base.some(
        e =>
          e.kind === 'derivation' && e.facet === 'inputs' && e.target === 'e_l',
      ),
    );
    const top = graph.forward['v_top'];
    assert.ok(
      top.some(
        e =>
          e.kind === 'acceptance chain' &&
          e.facet === 'inputs' &&
          e.target === 'v_base',
      ),
    );
  });

  it('the calculation row incl. the derives-from provenance form', () => {
    const edges = graph.forward['mpe_absolute'];
    const kinds = edges.map(e => `${e.kind}:${e.facet}:${e.target}`);
    assert.ok(kinds.includes('derivation:inputs:e_l'));
    assert.ok(kinds.includes('data source:lookup:mpe_table'));
    assert.ok(kinds.includes('parameterization:params:p_lc'));
    // The ref derives-from folds onto the element's provenance slot (the
    // kernel's documented fold), so the edge carries the source form.
    assert.deepEqual(edges[0].source, {
      doc: 'urn:oiml:pub:r:60-1:2021',
      clause: '5.1',
    });
  });

  it('the form rows: requirements / calculation_context / field bindings / formulas_used', () => {
    const edges = graph.forward['/form/eval'];
    const kinds = edges.map(e => `${e.kind}:${e.facet}:${e.target}`);
    assert.ok(
      kinds.includes('evidence scope:requirements:/req/metrological/mpe'),
    );
    assert.ok(
      kinds.includes('derivation context:calculation_context:mpe_table'),
    );
    assert.ok(kinds.includes('binding:field.bind:model.parameters.e_max'));
    assert.ok(kinds.includes('binding:field.verdict:v_top'));
    assert.ok(kinds.includes('binding:field.targets:/req/metrological/mpe'));
    const bindEdge = edges.find(e => e.facet === 'field.bind');
    assert.equal(bindEdge?.via, 'error_at_load');
    const fu = graph.forward['/conf/mpe-test'].filter(
      e => e.facet === 'formulas_used',
    );
    assert.equal(fu.length, 1);
    assert.equal(fu[0].target, 'mpe_absolute');
    assert.equal(fu[0].kind, 'derivation');
  });

  it('the dimension row: value implies as subsumption edges', () => {
    const edges = graph.forward['accuracy_class'];
    assert.deepEqual(
      edges.map(e => ({ kind: e.kind, target: e.target, via: e.via })),
      [
        { kind: 'subsumption', target: 'accuracy_class.A', via: 'AB' },
        { kind: 'subsumption', target: 'accuracy_class.B', via: 'AB' },
      ],
    );
  });

  it('the instance row: of / model / family', () => {
    const edges = graph.forward['smp-1'];
    const kinds = edges.map(e => `${e.facet}:${e.target}`);
    assert.ok(kinds.includes('of:LoadCell'));
    assert.ok(kinds.includes('model:mod-1'));
    assert.ok(kinds.includes('family:fam-1'));
  });

  it('the manifest rows: composition + edition lineage', () => {
    const edges = graph.forward['oiml-r60-demo'];
    const kinds = edges.map(e => `${e.kind}:${e.facet}:${e.target}`);
    assert.ok(
      kinds.includes('edition lineage:supersedes:urn:oiml:pub:r:60:2017'),
    );
    assert.ok(
      kinds.includes('edition lineage:superseded_by:urn:oiml:pub:r:60:2031'),
    );
  });

  it('the reverse index is the same edge set keyed by target', () => {
    // Every forward edge appears exactly once in the reverse index.
    let forwardCount = 0;
    for (const [element, edges] of Object.entries(graph.forward)) {
      for (const e of edges) {
        forwardCount++;
        const hit = (graph.reverse[e.target] ?? []).filter(
          r =>
            r.element === element &&
            r.kind === e.kind &&
            r.facet === e.facet &&
            r.via === e.via,
        );
        assert.equal(
          hit.length,
          1,
          `reverse index entry for ${element} → ${e.target} (${e.facet})`,
        );
      }
    }
    let reverseCount = 0;
    for (const list of Object.values(graph.reverse)) {
      reverseCount += list.length;
    }
    assert.equal(reverseCount, forwardCount);
    // The change-impact read: who depends on v_top?
    const dependents = graph.reverse['v_top'].map(
      e => `${e.element} (${e.facet})`,
    );
    assert.ok(
      dependents.includes('/req/metrological/mpe (limit.accepts.verdict)'),
    );
    assert.ok(dependents.includes('/form/eval (field.verdict)'));
  });

  it('impactGraph composes with a bare load (no package dir needed)', () => {
    const m = load(`
      verdict a {
        quantity { kind mass unit kg }
        derive "ocl{...}"
        inputs { b }
      }
      verdict b {
        quantity { kind mass unit kg }
        derive "ocl{...}"
        inputs { c_s }
      }
      symbol c_s { label "c" }
    `);
    const g = impactGraph(m);
    assert.equal(g.package.id, '');
    assert.deepEqual(
      g.forward['a'].map(e => `${e.kind}:${e.target}`),
      ['acceptance chain:b'],
    );
    assert.equal(g.reverse['b'][0].element, 'a');
  });
});

describe('primmel export impact CLI', () => {
  it('prints the graph to stdout and the summary with --out', () => {
    const dir = fixtureDir();
    const out = join(dir, 'impact.json');
    const res = spawnSync(
      'npx',
      ['tsx', CLI, 'export', 'impact', dir, '--out', out],
      {
        encoding: 'utf8',
        env: { ...process.env, npm_config_loglevel: 'silent' },
      },
    );
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);
    assert.match(
      res.stdout,
      /wrote .*impact\.json — \d+ edges \(.*\), \d+ elements declaring, \d+ targets indexed/,
    );
    const written = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(written.version, 'impact-graph/1');
    assert.ok(written.forward['/req/metrological/mpe']);
    assert.ok(written.reverse['v_top']);
  });

  it('rejects --format (the rdf knob) on the impact surface', () => {
    const dir = fixtureDir();
    const res = spawnSync(
      'npx',
      ['tsx', CLI, 'export', 'impact', dir, '--format', 'turtle'],
      {
        encoding: 'utf8',
        env: { ...process.env, npm_config_loglevel: 'silent' },
      },
    );
    assert.equal(res.status, 2);
    assert.match(res.stderr, /--format applies to `primmel export rdf` only/);
  });
});
