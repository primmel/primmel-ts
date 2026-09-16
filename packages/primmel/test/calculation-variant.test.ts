// ─────────────────────────────────────────────────────────────────────
// The calculation variant block (smart TODO.roadmap/40 batch 4; the
// packages-as-SSOT epic) — the executable realization of a calculation
// whose typed signature stays on the calculation itself (one concept,
// two realizations: the formulas.yaml engine rules duplicating a
// calculation id). The variant's params are engine call-site names and
// deliberately do NOT resolve against the calculation's inputs — there
// is no params-resolve rule.
//
// Fixtures:
//   LOAD_CELL_ERROR — the r60 carrier shape: the typed calculation plus
//                     its engine variant (label, description, params,
//                     expression).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const LOAD_CELL_ERROR = `
calculation loadCellError {
  name "loadCellError"
  description "Load cell error"
  inputs {
    avgIndicationAt75pct : number { unit "1" description "Average indication" }
    referenceIndication : number { unit "1" description "Reference indication" }
  }
  output : number { unit "1" }
  expression "E_L = (I - I_{ref}) / f"
  variant engine {
    type expression
    label "Load Cell Error E_L"
    description "E_L = (I - I_ref) / f"
    params { avgIndication referenceIndication conversion_factor_f }
    expression "(p.avgIndication - p.referenceIndication) / p.conversion_factor_f"
  }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-variant-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('calculation variant block (smart TODO.roadmap/40 batch 4)', () => {
  it('parses the variant with its facets', () => {
    const m = load(LOAD_CELL_ERROR);
    const c = m.calculations.find(x => x.id === 'loadCellError')!;
    assert.equal(c.variants!.length, 1);
    const v = c.variants![0]!;
    assert.equal(v.id, 'engine');
    assert.equal(v.type, 'expression');
    assert.equal(v.label, 'Load Cell Error E_L');
    assert.equal(v.description, 'E_L = (I - I_ref) / f');
    assert.deepEqual(v.params, [
      'avgIndication',
      'referenceIndication',
      'conversion_factor_f',
    ]);
    assert.equal(
      v.expression,
      '(p.avgIndication - p.referenceIndication) / p.conversion_factor_f',
    );
  });

  it('parses a table_lookup variant with its lookup block', () => {
    const m = load(`
calculation lookupMPE {
  name "lookupMPE"
  output : number { unit "g" }
  variant engine {
    type table_lookup
    label "MPE lookup"
    params { load }
    lookup { key load variable mpe multiplier 1 }
  }
}
`);
    const v = m.calculations[0]!.variants![0]!;
    assert.equal(v.type, 'table_lookup');
    assert.equal(v.lookup!.key, 'load');
    assert.equal(v.lookup!.variable, 'mpe');
    assert.equal(v.lookup!.multiplier, '1');
  });

  it('rejects an unknown variant type at parse (the fail-closed precedent)', () => {
    assert.throws(
      () =>
        load(`
calculation broken {
  output : number { unit "1" }
  variant engine {
    type alchemy
  }
}
`),
      /Unknown variant type "alchemy"/,
    );
  });

  it('rejects a variant facet without its block', () => {
    assert.throws(
      () =>
        load(`
calculation broken {
  output : number { unit "1" }
  variant engine
}
`),
      /variant engine is missing its block/,
    );
  });

  it('round-trips the variant losslessly (fixpoint)', () => {
    const once = dump(load(LOAD_CELL_ERROR));
    const twice = dump(load(once));
    assert.equal(twice, once);
    assert.deepEqual(
      load(once).calculations[0]!.variants,
      load(LOAD_CELL_ERROR).calculations[0]!.variants,
    );
  });
});

describe('C125 formula-variant-shape', () => {
  function c125Issues(body: string) {
    return checkPackage(makePackage(body)).filter(i => i.check === 'C125');
  }

  it('accepts a well-formed variant', () => {
    assert.deepEqual(c125Issues(LOAD_CELL_ERROR), []);
  });

  it('flags a duplicate variant id', () => {
    const issues = c125Issues(`
calculation dup {
  output : number { unit "1" }
  variant engine {
    type expression
    expression "p.a"
  }
  variant engine {
    type expression
    expression "p.b"
  }
}
`);
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /declared twice/);
  });

  it('flags an expression variant without its expression', () => {
    const issues = c125Issues(`
calculation broken {
  output : number { unit "1" }
  variant engine {
    type expression
    label "No expression"
  }
}
`);
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /requires the expression facet/);
  });

  it('flags a table_lookup variant without its lookup block', () => {
    const issues = c125Issues(`
calculation broken {
  output : number { unit "1" }
  variant engine {
    type table_lookup
  }
}
`);
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /requires the lookup block/);
  });

  it('flags a profile_lookup variant without its profile', () => {
    const issues = c125Issues(`
calculation broken {
  output : number { unit "1" }
  variant engine {
    type profile_lookup
  }
}
`);
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /requires the profile facet/);
  });

  it('never resolves variant params against the calculation inputs', () => {
    // The hard decision: params are call-site names, not input ids —
    // LOAD_CELL_ERROR's params (avgIndication, …) name no declared input
    // (avgIndicationAt75pct, …) and stay silent.
    assert.deepEqual(c125Issues(LOAD_CELL_ERROR), []);
  });
});
