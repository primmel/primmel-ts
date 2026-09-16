// ─────────────────────────────────────────────────────────────────────
// The pair_list attribute block (smart TODO.roadmap/40 batch 4; the
// packages-as-SSOT epic) — the value_type pair-list declaration shape
// on attribute_definition (key/value slots, the key_dimension edge, the
// repeatable two-token component blocks) and the C124 pair-list-shape
// linter rule (declaration shape + per-register gated dimension
// resolution; the closed-registry-over-values leg stays app-side).
//
// Fixtures:
//   INTERFERING  — the r144 carrier shape: the interfering_components
//                  attribute with its key/value slots, the
//                  measurand_components dimension edge, and five
//                  declared components.
//   DIMENSION    — the dimension register entry the key_dimension edge
//                  resolves against.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const INTERFERING = `
attribute_definition interfering_components {
  symbol "I_c"
  name "Interfering components"
  definition "The maximum concentration of each interfering component."
  value_type pair-list
  pair_list {
    key component
    value max_concentration
    key_dimension measurand_components
    component co2 {
      name "Carbon dioxide"
    }
    component h2o {
      name "Water vapour"
      source { doc "urn:oiml:pub:r:144-1:2013" clause "5.3" }
    }
    component so2 {
      name "Sulfur dioxide"
    }
    component ch4 {
      name "Methane"
    }
    component h2 {
      name "Hydrogen"
    }
  }
}
`;

const DIMENSION = `
dimension measurand_components {
  label "Measurand components"
  cardinality set
  values {
    co2 { label "Carbon dioxide" }
    h2o { label "Water vapour" }
  }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-pairlist-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('pair_list facet (smart TODO.roadmap/40 batch 4)', () => {
  it('parses the block with its slots, dimension edge, and components', () => {
    const m = load(INTERFERING);
    const a = m.attributeDefinitions.find(
      x => x.id === 'interfering_components',
    )!;
    assert.equal(a.valueType, 'pair-list');
    const pl = a.pairList!;
    assert.equal(pl.key, 'component');
    assert.equal(pl.value, 'max_concentration');
    assert.equal(pl.keyDimension, 'measurand_components');
    assert.deepEqual(
      pl.components.map(c => c.id),
      ['co2', 'h2o', 'so2', 'ch4', 'h2'],
    );
    assert.equal(pl.components[0]!.name, 'Carbon dioxide');
    assert.equal(pl.components[1]!.source?.doc, 'urn:oiml:pub:r:144-1:2013');
    assert.equal(pl.components[1]!.source?.clause, '5.3');
    assert.equal(pl.components[2]!.name, 'Sulfur dioxide');
    assert.equal(pl.components[2]!.source, null);
  });

  it('round-trips the block losslessly (fixpoint)', () => {
    const once = dump(load(INTERFERING));
    const twice = dump(load(once));
    assert.equal(twice, once);
    const a = load(once).attributeDefinitions.find(
      x => x.id === 'interfering_components',
    )!;
    assert.deepEqual(
      a.pairList,
      load(INTERFERING).attributeDefinitions[0]!.pairList,
    );
  });

  it('omits the facet entirely when no pair_list is declared', () => {
    const m = load(`
attribute_definition plain {
  symbol "P"
  name "Plain"
  value_type scalar
}
`);
    assert.equal(m.attributeDefinitions[0]!.pairList, undefined);
    assert.ok(!dump(m).includes('pair_list'));
  });
});

describe('C124 pair-list-shape', () => {
  function c124Issues(body: string) {
    return checkPackage(makePackage(body)).filter(i => i.check === 'C124');
  }

  it('accepts a well-formed block (dimension register in scope)', () => {
    assert.deepEqual(c124Issues(DIMENSION + INTERFERING), []);
  });

  it('accepts a well-formed block with the register out of scope', () => {
    assert.deepEqual(c124Issues(INTERFERING), []);
  });

  it('flags a missing key or value slot', () => {
    const issues = c124Issues(`
attribute_definition broken {
  pair_list {
    component co2 { name "Carbon dioxide" }
  }
}
`);
    assert.equal(issues.length, 2);
    assert.match(issues[0]!.message, /key slot/);
    assert.match(issues[1]!.message, /value slot/);
  });

  it('flags a duplicate component id', () => {
    const issues = c124Issues(`
attribute_definition broken {
  pair_list {
    key component
    value max_concentration
    component co2 { name "Carbon dioxide" }
    component co2 { name "Again" }
  }
}
`);
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /declared twice/);
  });

  it('flags a dangling key_dimension when the dimension register is in scope', () => {
    const issues = c124Issues(
      DIMENSION +
        INTERFERING.replace(
          'key_dimension measurand_components',
          'key_dimension ghost_axis',
        ),
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /ghost_axis/);
    assert.match(issues[0]!.message, /pair-list-shape/);
  });
});
