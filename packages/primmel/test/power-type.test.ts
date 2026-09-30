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
    const issues = checkPackage(
      makePackage('instance x {\n  of nowhere\n}\n'),
    );
    assert.ok(
      issues.some(
        i =>
          i.check === 'C20' &&
          i.message.includes('not a declared subject, instrument, or instance'),
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
      issues.some(
        i => i.check === 'C155' && i.message.includes('do not mix'),
      ),
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
    assert.ok(!issues.some(i => i.check === 'C156' && i.message.includes('"B"')));
    assert.ok(
      issues.some(
        i =>
          i.check === 'C156' &&
          i.message.includes('class C: extends "nowhere" is not a declared class or instance'),
      ),
    );
  });
});

describe('power-type delegation (INV-10 through the of-chain)', () => {
  const model = load(CHAIN);

  it('walks the of-chain upward with lower override', () => {
    assert.equal(resolveInstanceValue(model, 'smp-001', 'parameters.e_max')?.value, 2.2);
    assert.equal(resolveInstanceValue(model, 'smp-001', 'parameters.p_lc')?.value, 0.7);
    assert.equal(resolveInstanceValue(model, 'mod-500-2t', 'parameters.p_lc')?.value, 0.7);
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
