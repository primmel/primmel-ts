// ─────────────────────────────────────────────────────────────────────
// The verdict chain + the instance-parameter schema (Primmel v3.2,
// TODO.primmel/11; MN 114 clauses 11.3 and 11.1.3 — primmel/spec#18
// ask 5). A verdict's inputs may name another verdict (the acceptance
// chain as an explicit graph); a requirement parameter's `bind` names
// the aspect path the value instantiates from. Covers the bind codec,
// the round-trip fixpoint, and the linter rules
//   C116 verdict-inputs-resolve
//   C117 verdict-chain-acyclic
//   C118 requirement-parameter-shape
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage, checkVerdictChains } from '../src/check';

function check(model: string) {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-vc-'));
  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'package.primmel'),
    'package { id p version "1" editions { 1 } baseUrn "urn:p:1" description "d" }',
  );
  writeFileSync(join(dir, 'model', 'm.prl'), model);
  return checkPackage(dir);
}

const SUBJECT = `quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg }
  unit kg { symbol "kg" kind mass factor 1 }
}
attribute_definition e_max {
  quantity_kind mass
  unit kg
  scope model
}
instrument LoadCell {
  dimension accuracy_class { values { A { } B { } C { } D { } } }
}
`;

describe('parameter bind: parse + round-trip', () => {
  it('parses bind on a requirement parameter', () => {
    const m = load(`
      requirement /req/mpe {
        name "MPE"
        statement "s"
        parameters {
          param e_max: number {
            description "Maximum capacity of the instrument under test."
            unit kg
            bind "model.parameters.e_max"
            range { min 0 }
          }
        }
      }
    `);
    const p = m.requirements[0].parameters[0];
    assert.equal(p.bind, 'model.parameters.e_max');
    assert.equal(p.unit, 'kg');
    assert.equal(p.rangeMin, '0');
  });

  it('round-trips bind to a fixed point; absent bind keeps the v3.1 shape', () => {
    const src = `requirement /req/mpe {
  name "MPE"
  statement "s"
  parameters {
    param e_max: number { description "Maximum capacity." unit "kg" bind "model.parameters.e_max" range { min 0 } }
    param n_runs: integer { description "Repetitions." default 20 range { min 1 max 100 } }
  }
}
`;
    const first = dump(load(src));
    assert.equal(dump(load(first)), first);
    assert.match(first, /bind "model\.parameters\.e_max"/);
    assert.equal(load(src).requirements[0].parameters[1].bind, '');
  });
});

describe('C116 verdict-inputs-resolve', () => {
  it('inputs resolve against symbols, test variables/observables, and verdicts', () => {
    const m = load(`
      symbol c_m { label "c" }
      conformance_test t1 {
        name "T"
        variables { variable measured_m { type number unit "kg" source measured } }
        observables { observable obs1 { quantity_kind mass unit "kg" } }
      }
      verdict v_base {
        quantity { kind mass unit "kg" }
        derive "ocl{...}"
        inputs { c_m measured_m obs1 }
      }
      verdict v_top {
        quantity { kind mass unit "kg" }
        derive "ocl{...}"
        inputs { v_base }
      }
    `);
    assert.deepEqual(checkVerdictChains(m), []);
  });

  it('an input naming nothing declared is an error', () => {
    const m = load(`
      verdict v1 {
        quantity { kind mass unit "kg" }
        derive "ocl{...}"
        inputs { phantom }
      }
    `);
    const issues = checkVerdictChains(m);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].check, 'C116');
    assert.equal(issues[0].severity, 'error');
    assert.match(
      issues[0].message,
      /input "phantom" resolves to no declared symbol/,
    );
  });
});

describe('C117 verdict-chain-acyclic', () => {
  it('a verdict→verdict cycle is an error', () => {
    const m = load(`
      verdict a {
        quantity { kind mass unit "kg" }
        derive "ocl{...}"
        inputs { b }
      }
      verdict b {
        quantity { kind mass unit "kg" }
        derive "ocl{...}"
        inputs { a }
      }
    `);
    const issues = checkVerdictChains(m).filter(i => i.check === 'C117');
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /verdict chain cycle: a → b → a/);
  });

  it('self-derivation is the length-1 cycle', () => {
    const m = load(`
      verdict a {
        quantity { kind mass unit "kg" }
        derive "ocl{...}"
        inputs { a }
      }
    `);
    const issues = checkVerdictChains(m).filter(i => i.check === 'C117');
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /a → a/);
  });

  it('a legal chain is clean', () => {
    const m = load(`
      symbol s1 { label "s" }
      verdict a {
        quantity { kind mass unit "kg" }
        derive "ocl{...}"
        inputs { b }
      }
      verdict b {
        quantity { kind mass unit "kg" }
        derive "ocl{...}"
        inputs { s1 }
      }
    `);
    assert.deepEqual(checkVerdictChains(m), []);
  });
});

describe('C118 requirement-parameter-shape', () => {
  it('a bound, ranged, unit-carrying parameter is clean', () => {
    const issues = check(
      SUBJECT +
        `requirement /req/mpe {
  name "MPE"
  statement "s"
  parameters {
    param e_max: number { unit kg bind "model.parameters.e_max" range { min 0 max 500 } }
    param cls: enum { enum_values { A B C D } bind "model.classification.accuracy_class" }
  }
}
`,
    ).filter(i => i.check === 'C118');
    assert.deepEqual(issues, []);
  });

  it('a bind path naming no declared aspect is an error', () => {
    const issues = check(
      SUBJECT +
        `requirement /req/mpe {
  name "MPE"
  statement "s"
  parameters {
    param e_max: number { bind "model.parameters.phantom" }
  }
}
`,
    ).filter(i => i.check === 'C118');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'error');
    assert.match(
      issues[0].message,
      /bind "model\.parameters\.phantom" — attribute "phantom" not defined/,
    );
  });

  it('a classification bind names a dimension', () => {
    const issues = check(
      SUBJECT +
        `requirement /req/mpe {
  name "MPE"
  statement "s"
  parameters {
    param cls: enum { enum_values { A B } bind "model.classification.no_such_axis" }
  }
}
`,
    ).filter(i => i.check === 'C118');
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /dimension "no_such_axis" not declared/);
  });

  it('the unit leg is the rollout warning (the C33 §6.8 precedent)', () => {
    const issues = check(
      SUBJECT +
        `requirement /req/mpe {
  name "MPE"
  statement "s"
  parameters {
    param n: number { unit furlong }
  }
}
`,
    ).filter(i => i.check === 'C118');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'warning');
    assert.match(
      issues[0].message,
      /unit "furlong" resolves to no registered unit/,
    );
  });

  it('a range whose min exceeds its max is an error', () => {
    const issues = check(
      SUBJECT +
        `requirement /req/mpe {
  name "MPE"
  statement "s"
  parameters {
    param n: integer { range { min 100 max 1 } }
  }
}
`,
    ).filter(i => i.check === 'C118');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'error');
    assert.match(issues[0].message, /range min 100 exceeds max 1/);
  });
});
