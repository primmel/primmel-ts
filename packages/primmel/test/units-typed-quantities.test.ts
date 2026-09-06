// ─────────────────────────────────────────────────────────────────────
// The units-typed quantities (Primmel v3.2, TODO.primmel/11; MN 114
// clauses 11.1.2 and 13.7.1 — primmel/spec#18 ask 4; the register-entry
// corresponds binding of clause 13.4). Covers the limit `quantity`
// block, the calculation signature facets (quantity_kind, range), the
// register-entry corresponds parse/dump, the round-trip fixpoints, and
// the linter rules
//   C114 limit-quantity-coherence
//   C115 calculation-signature-shape
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const REGISTER = `quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg }
  kind count { si_unit "1" }
  unit kg { symbol "kg" kind mass factor 1 }
  unit g { symbol "g" kind mass factor 0.001 }
  unit counts { symbol "counts" kind count }
}
`;

function check(model: string) {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-qty-'));
  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'package.primmel'),
    'package { id p version "1" editions { 1 } baseUrn "urn:p:1" description "d" }',
  );
  writeFileSync(join(dir, 'model', 'm.prl'), model);
  return checkPackage(dir);
}

describe('limit quantity: parse + round-trip', () => {
  it('parses quantity { kind unit } on the limit block', () => {
    const m = load(`
      requirement /req/mpe {
        name "MPE"
        statement "s"
        limit {
          expression "ocl{self.e <= self.mpe}"
          uses { e mpe }
          quantity { kind mass unit kg }
        }
      }
    `);
    const q = m.requirements[0].limit?.quantity;
    assert.deepEqual(q, { kind: 'mass', unit: 'kg' });
  });

  it('round-trips the quantity block to a fixed point (between notes and accepts)', () => {
    const src = `requirement /req/mpe {
  name "MPE"
  statement "s"
  limit {
    expression "ocl{self.e <= self.mpe}"
    uses { e mpe }
    quantity { kind mass unit kg }
    accepts { verdict mpe_error op lte limit "ocl{self.e <= self.mpe}" }
  }
}
`;
    const first = dump(load(src));
    assert.equal(dump(load(first)), first);
    // The unit facet emits quoted always (the verdict-quantity spelling of
    // clause 11.3; the codec's canonical unit form everywhere else).
    assert.match(first, /quantity \{ kind mass unit "kg" \}/);
  });

  it('emits a compound unit quoted (counts/v), byte-clean both directions', () => {
    const src = `requirement /req/sensitivity {
  name "Sensitivity"
  statement "s"
  limit {
    expression "ocl{self.f > 0}"
    uses { f }
    quantity { kind volume-fraction unit "counts/v" }
  }
}
`;
    const first = dump(load(src));
    assert.match(first, /quantity \{ kind volume-fraction unit "counts\/v" \}/);
    assert.equal(dump(load(first)), first);
    assert.deepEqual(load(first).requirements[0].limit?.quantity, {
      kind: 'volume-fraction',
      unit: 'counts/v',
    });
  });

  it('a limit without quantity keeps its v3.1 shape', () => {
    const m = load(`
      requirement /req/x {
        name "X"
        statement "s"
        limit { expression "ocl{true}" }
      }
    `);
    assert.equal(m.requirements[0].limit?.quantity, null);
  });
});

describe('calculation signature: parse + round-trip', () => {
  it('parses quantity_kind and range on inputs and the output', () => {
    const m = load(`
      calculation mpe_absolute {
        name "MPE absolute"
        inputs {
          e_l : number { unit kg quantity_kind mass range { min 0 } description "Error of indication at the test load." }
          n_lc : integer { range { min 1 max 10000 } description "Number of intervals." }
        }
        output : number { unit kg quantity_kind mass range { min 0 } name "mpe" description "Maximum permissible error, absolute." }
        expression "ocl{...}"
      }
    `);
    const c = m.calculations[0];
    assert.equal(c.inputs[0].quantityKind, 'mass');
    assert.equal(c.inputs[0].hasRange, true);
    assert.equal(c.inputs[0].rangeMin, '0');
    assert.equal(c.inputs[0].rangeMax, undefined);
    assert.equal(c.inputs[1].rangeMin, '1');
    assert.equal(c.inputs[1].rangeMax, '10000');
    assert.equal(c.output.quantityKind, 'mass');
    assert.equal(c.output.hasRange, true);
    assert.equal(c.output.rangeMin, '0');
  });

  it('round-trips the signature facets to a fixed point', () => {
    const src = `calculation mpe_absolute {
  name "MPE absolute"
  inputs {
    e_l : number { unit "kg" quantity_kind mass description "Error." range { min 0 } }
  }
  output : number { unit "kg" quantity_kind mass name "mpe" range { min 0 max 5 } }
  expression "ocl{...}"
}
`;
    const first = dump(load(src));
    assert.equal(dump(load(first)), first);
    assert.match(first, /quantity_kind mass/);
    assert.match(first, /range \{ min 0 \}/);
    assert.match(first, /range \{ min 0 max 5 \}/);
  });

  it('a v3.1 calculation keeps its shape (no optional keys materialize)', () => {
    const src = `calculation c {
  name "C"
  inputs {
    x : number { unit "kg" description "d" }
  }
  output : number { unit "kg" }
  expression "ocl{...}"
}
`;
    const first = dump(load(src));
    assert.equal(dump(load(first)), first);
    const c = load(src).calculations[0];
    assert.equal(c.inputs[0].quantityKind, undefined);
    assert.equal(c.inputs[0].hasRange, undefined);
    assert.equal(c.output.quantityKind, undefined);
    assert.equal(c.output.hasRange, undefined);
  });
});

describe('register-entry corresponds (clause 13.4)', () => {
  it('parses and round-trips corresponds on kind and unit entries', () => {
    const src = `quantity_register si {
  kind mass { dimensions { M 1 } si_unit "kg" corresponds unitsml "kg" }
  unit kg { symbol "kg" kind mass corresponds unitsml "kg" }
}
`;
    const m = load(src);
    assert.equal(m.quantityRegisters[0].kinds[0].correspondences?.length, 1);
    assert.equal(
      m.quantityRegisters[0].kinds[0].correspondences?.[0].scheme,
      'unitsml',
    );
    assert.equal(
      m.quantityRegisters[0].units[0].correspondences?.[0].concept,
      'kg',
    );
    const first = dump(m);
    assert.equal(dump(load(first)), first);
    assert.match(first, /corresponds unitsml "kg"/);
  });
});

describe('C114 limit-quantity-coherence', () => {
  const VERDICTS = `verdict mpe_error {
  symbol "E"
  quantity { kind mass unit kg }
  derive "ocl{self.e - self.ref}"
  inputs { e ref }
}
`;

  it('a limit whose quantity agrees with the bound verdict is clean', () => {
    const issues = check(
      REGISTER +
        VERDICTS +
        `requirement /req/mpe {
  name "MPE"
  statement "s"
  limit {
    expression "ocl{...}"
    quantity { kind mass unit kg }
    accepts { verdict mpe_error op lte limit "ocl{...}" }
  }
}
`,
    ).filter(i => i.check === 'C114');
    assert.deepEqual(issues, []);
  });

  it('a kind mismatch is an error', () => {
    const issues = check(
      REGISTER +
        VERDICTS +
        `requirement /req/mpe {
  name "MPE"
  statement "s"
  limit {
    expression "ocl{...}"
    quantity { kind count unit kg }
    accepts { verdict mpe_error op lte limit "ocl{...}" }
  }
}
`,
    ).filter(i => i.check === 'C114');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'error');
    assert.match(
      issues[0].message,
      /kind "count" but accepts verdict mpe_error derives kind "mass"/,
    );
  });

  it('a unit mismatch is an error', () => {
    const issues = check(
      REGISTER +
        VERDICTS +
        `requirement /req/mpe {
  name "MPE"
  statement "s"
  limit {
    expression "ocl{...}"
    quantity { kind mass unit g }
    accepts { verdict mpe_error op lte limit "ocl{...}" }
  }
}
`,
    ).filter(i => i.check === 'C114');
    assert.equal(issues.length, 1);
    assert.match(
      issues[0].message,
      /unit "g" but accepts verdict mpe_error derives unit "kg"/,
    );
  });

  it('silent without accepts, without quantity, or on an unresolved verdict', () => {
    const base = (limit: string) =>
      check(
        REGISTER +
          VERDICTS +
          `requirement /req/mpe {
  name "MPE"
  statement "s"
  limit {
    expression "ocl{...}"
    ${limit}
  }
}
`,
      ).filter(i => i.check === 'C114');
    assert.deepEqual(base('quantity { kind count unit g }'), []);
    assert.deepEqual(
      base('accepts { verdict mpe_error op lte limit "ocl{...}" }'),
      [],
    );
    assert.deepEqual(
      base(
        'quantity { kind count unit g } accepts { verdict no_such op lte limit "ocl{...}" }',
      ),
      [],
    );
  });
});

describe('C115 calculation-signature-shape', () => {
  it('a fully resolved signature is clean', () => {
    const issues = check(
      REGISTER +
        `calculation c {
  name "C"
  inputs {
    x : number { unit kg quantity_kind mass range { min 0 max 5 } }
    c1 : enum { enum_values { A B } }
  }
  output : number { unit kg quantity_kind mass range { min 0 } }
  expression "ocl{...}"
}
`,
    ).filter(i => i.check === 'C115');
    assert.deepEqual(issues, []);
  });

  it('an unregistered quantity_kind is an error', () => {
    const issues = check(
      REGISTER +
        `calculation c {
  name "C"
  inputs { x : number { unit kg quantity_kind nope } }
  output : number { unit kg }
  expression "ocl{...}"
}
`,
    ).filter(i => i.check === 'C115');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'error');
    assert.match(
      issues[0].message,
      /quantity_kind "nope" resolves to no registered kind/,
    );
  });

  it('the typed-unit pair must agree in kind', () => {
    const issues = check(
      REGISTER +
        `calculation c {
  name "C"
  inputs { x : number { unit counts quantity_kind mass } }
  output : number { unit kg }
  expression "ocl{...}"
}
`,
    ).filter(i => i.check === 'C115');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'error');
    assert.match(issues[0].message, /unit "counts" measures kind count/);
  });

  it('an unregistered unit is the rollout WARNING leg (C33 §6.8 precedent)', () => {
    const issues = check(
      REGISTER +
        `calculation c {
  name "C"
  inputs { x : number { unit furlong quantity_kind mass } }
  output : number { unit kg }
  expression "ocl{...}"
}
`,
    ).filter(i => i.check === 'C115');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'warning');
    assert.match(
      issues[0].message,
      /unit "furlong" resolves to no registered unit/,
    );
  });

  it('the dimensionless default ("1") is not an authored unit — silent', () => {
    const issues = check(
      REGISTER +
        `calculation c {
  name "C"
  inputs { x : number { description "no unit declared" } }
  output : number { unit "1" }
  expression "ocl{...}"
}
`,
    ).filter(i => i.check === 'C115');
    assert.deepEqual(issues, []);
  });

  it('a range whose min exceeds its max is an error; open bounds pass', () => {
    const bad = check(
      REGISTER +
        `calculation c {
  name "C"
  inputs { x : number { unit kg range { min 5 max 1 } } }
  output : number { unit kg }
  expression "ocl{...}"
}
`,
    ).filter(i => i.check === 'C115');
    assert.equal(bad.length, 1);
    assert.equal(bad[0].severity, 'error');
    assert.match(bad[0].message, /range min 5 exceeds max 1/);
    const open = check(
      REGISTER +
        `calculation c {
  name "C"
  inputs { x : number { unit kg range { min 0 } } }
  output : number { unit kg }
  expression "ocl{...}"
}
`,
    ).filter(i => i.check === 'C115');
    assert.deepEqual(open, []);
  });

  it('an enum-typed input without enum_values is an error (the output is exempt)', () => {
    const bad = check(
      REGISTER +
        `calculation c {
  name "C"
  inputs { x : enum { description "no values" } }
  output : enum { unit "1" }
  expression "ocl{...}"
}
`,
    ).filter(i => i.check === 'C115');
    assert.equal(bad.length, 1);
    assert.match(bad[0].message, /enum-typed input declares its values/);
    assert.match(bad[0].message, /input x/);
  });

  it('silent when the package declares no quantity register', () => {
    const issues = check(
      `calculation c {
  name "C"
  inputs { x : number { unit furlong } }
  output : number { unit kg }
  expression "ocl{...}"
}
`,
    ).filter(i => i.check === 'C115');
    assert.deepEqual(issues, []);
  });
});
