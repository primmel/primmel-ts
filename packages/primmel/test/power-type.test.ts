// ─────────────────────────────────────────────────────────────────────
// The power-type discipline (the reconfiguration phase 8; the CDD
// family's central modelling relationship): every instance can serve
// as the definition of further instantiation, and a class's extends
// names a class or an instance.
//
// C20 resolves `of` against subjects, instruments, and instances;
// C155 keeps the of-chain coherent (no mixing with the upward
// subject-chain links) and acyclic; C156 resolves a class's extends
// against classes and instances; and the delegation walk (INV-10)
// continues through an of-to-instance link with no upward link.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPackage } from '../src/check';
import {
  resolveInstanceValue,
  instanceChain,
} from '../src/instance-resolution';
import { load } from '../src/ser-des/index';

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-powertype-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

const CHAIN = `
subject LoadCellModelFamily {
  is { attributes { p_lc : number { scope family } } }
}

instance grp-500 {
  of LoadCellModelFamily
  has { attributes { p_lc : 0.7 } }
}

instance mod-500-2t {
  of grp-500
  has { attributes { e_max : 2.2 t } }
}

instance smp-001 {
  of mod-500-2t
  has { test_context { d_min : 0 kg } }
}
`;

describe('power-type instantiation (parse + check)', () => {
  it('C20 accepts an of-reference to another instance', () => {
    const issues = checkPackage(makePackage(CHAIN));
    const c20 = issues.filter(i => i.check === 'C20');
    assert.deepEqual(c20, []);
    const c155 = issues.filter(i => i.check === 'C155');
    assert.deepEqual(c155, []);
  });

  it('C20 still rejects an of-reference to nothing declared', () => {
    const issues = checkPackage(makePackage('instance x {\n  of nowhere\n}\n'));
    assert.ok(
      issues.some(
        i =>
          i.check === 'C20' &&
          i.message.includes(
            'not a declared subject, instrument, class, or instance',
          ),
      ),
    );
  });

  it('C155 rejects mixing the power-type chain with an upward link', () => {
    const issues = checkPackage(
      makePackage(`
instance a {
  of LoadCellModelFamily
}

instance b {
  of a
  model c
}
`),
    );
    assert.ok(
      issues.some(i => i.check === 'C155' && i.message.includes('do not mix')),
    );
  });

  it('C155 rejects a cyclic of-chain', () => {
    const issues = checkPackage(
      makePackage(`
instance a {
  of b
}

instance b {
  of a
}
`),
    );
    assert.ok(
      issues.some(i => i.check === 'C155' && i.message.includes('cyclic')),
    );
  });

  it('C156 resolves a class extends against classes and instances', () => {
    const issues = checkPackage(
      makePackage(`
class A {
  a : string { modality SHALL }
}

class B {
  extends { A }
  b : string { modality SHALL }
}

class C {
  extends { nowhere }
  c : string { modality SHALL }
}
`),
    );
    assert.ok(
      !issues.some(i => i.check === 'C156' && i.message.includes('"B"')),
    );
    assert.ok(
      issues.some(
        i =>
          i.check === 'C156' &&
          i.message.includes(
            'class C: extends "nowhere" is not a declared class or instance',
          ),
      ),
    );
  });
});

describe('the prototype hop (a class extends an instance)', () => {
  const model = load(`
class Prototype {
  serial_number : string { modality SHALL }
}

instance p1 {
  of Prototype
  has { attributes { serial_number : "PROTO-001" } }
}

class ProductionUnit {
  extends { p1 }
  family_code : string { modality SHALL }
}

instance u7 {
  of ProductionUnit
  has { attributes { family_code : "F7" } }
}
`);

  it("an instance of the class inherits the prototype's exhibited values", () => {
    assert.equal(
      resolveInstanceValue(model, 'u7', 'parameters.serial_number')?.value,
      'PROTO-001',
    );
    assert.equal(
      resolveInstanceValue(model, 'u7', 'parameters.family_code')?.value,
      'F7',
    );
  });

  it('the instance chain crosses the class plane to the prototype', () => {
    assert.deepEqual(
      instanceChain(model, 'u7').map(i => i.id),
      ['u7', 'p1'],
    );
  });

  it("the prototype's own values still resolve on the prototype", () => {
    assert.equal(
      resolveInstanceValue(model, 'p1', 'parameters.serial_number')?.value,
      'PROTO-001',
    );
  });

  it('a chain of classes reaches the prototype transitively', () => {
    const m2 = load(`
class P {
  a : string { modality SHALL }
}

instance p1 {
  of P
  has { attributes { a : "one" } }
}

class Mid {
  extends { p1 }
}

class Leaf {
  extends { Mid }
}

instance i {
  of Leaf
}
`);
    assert.equal(resolveInstanceValue(m2, 'i', 'parameters.a')?.value, 'one');
  });

  it('a lower statement overrides the inherited prototype value', () => {
    const m3 = load(`
class P {
  a : string { modality SHALL }
}

instance p1 {
  of P
  has { attributes { a : "one" } }
}

class C {
  extends { p1 }
}

instance i {
  of C
  has { attributes { a : "two" } }
}
`);
    assert.equal(resolveInstanceValue(m3, 'i', 'parameters.a')?.value, 'two');
  });

  it('C155 rejects a prototype cycle: the class instantiates itself', () => {
    // x instantiates C; C's prototype IS x — x's continuation through
    // the class plane points back at x: the shapes' own recursion.
    const issues = checkPackage(
      makePackage(`
class C {
  extends { x }
  a : string { modality SHALL }
}

instance x {
  of C
  has { attributes { a : "seed" } }
}
`),
    );
    assert.ok(
      issues.some(i => i.check === 'C155' && i.message.includes('cyclic')),
      `expected a cyclic finding, got: ${JSON.stringify(issues.filter(i => i.check === 'C155').map(i => i.message))}`,
    );

    // The non-cyclic shape: a prototype chain terminates and stays
    // silent.
    const ok = checkPackage(
      makePackage(`
class C {
  a : string { modality SHALL }
}

instance x {
  of C
  has { attributes { a : "seed" } }
}

class D {
  extends { x }
  b : string { modality SHALL }
}

instance y {
  of D
}
`),
    );
    assert.deepEqual(
      ok.filter(i => i.check === 'C155'),
      [],
    );
  });
});

describe('the typed-payload bridge power-types (an instance is a class)', () => {
  it('payload fields resolve against an instance target through its class', () => {
    const issues = checkPackage(
      makePackage(`
class Reading {
  value : string { modality SHALL }
}

instance ref_reading {
  of Reading
  has { attributes { value : "1.000 kg" } }
}

subject S {
  is {
    attributes {
      d : string { payload_class ref_reading }
    }
  }
}
`),
    );
    assert.deepEqual(
      issues.filter(i => i.check === 'C152'),
      [],
    );
  });
});

describe('power-type delegation (INV-10 through the of-chain)', () => {
  const model = load(CHAIN);

  it('walks the of-chain upward with lower override', () => {
    assert.equal(
      resolveInstanceValue(model, 'smp-001', 'parameters.e_max')?.value,
      2.2,
    );
    assert.equal(
      resolveInstanceValue(model, 'smp-001', 'parameters.p_lc')?.value,
      0.7,
    );
    assert.equal(
      resolveInstanceValue(model, 'mod-500-2t', 'parameters.p_lc')?.value,
      0.7,
    );
  });

  it('the chain is the of-chain, terminating at the subject', () => {
    assert.deepEqual(
      instanceChain(model, 'smp-001').map(i => i.id),
      ['smp-001', 'mod-500-2t', 'grp-500'],
    );
  });

  it('a value restated lower overrides the instantiated instance', () => {
    const m2 = load(`
subject S {
  is { attributes { a : number { scope family } } }
}

instance p {
  of S
  has { attributes { a : 1 } }
}

instance q {
  of p
  has { attributes { a : 2 } }
}
`);
    assert.equal(resolveInstanceValue(m2, 'q', 'parameters.a')?.value, 2);
    assert.equal(resolveInstanceValue(m2, 'p', 'parameters.a')?.value, 1);
  });
});
