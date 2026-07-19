// ─────────────────────────────────────────────────────────────────────
// W8 primmel check — cross-layer linter tests.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkPackage } from '../src/check';

const R60 =
  process.env.R60_PACKAGE ??
  '/Users/mulgogi/src/oimlsmart/smart/primmel-packages/oiml-r60';

describe('primmel check (W8)', () => {
  it('the R 60 package passes with zero errors', () => {
    const issues = checkPackage(R60);
    const errors = issues.filter(i => i.severity === 'error');
    assert.deepEqual(
      errors,
      [],
      `expected 0 errors, got: ${errors.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
    );
  });

  it('catches scope mismatches, dangling refs, and bad dimensions (fixture)', () => {
    // Synthetic fixture via a temp package
    const dir = makeTmpPackage();
    const issues = checkPackage(dir);
    const messages = issues.map(i => `[${i.check}] ${i.message}`).join('\n');
    assert.ok(
      messages.includes('attribute "bogus_attr" not defined'),
      'C1 bogus attr caught',
    );
    assert.ok(
      messages.includes('not a declared requirement'),
      'C2 dangling target caught',
    );
    assert.ok(
      messages.includes('not in the dimension'),
      'C3 bad dimension value caught',
    );
    assert.ok(messages.includes('both'), 'C4 duplicate store caught');
  });
});

function makeTmpPackage(): string {
  const { mkdtempSync, mkdirSync, writeFileSync } = require('fs');
  const { tmpdir } = require('os');
  const { join } = require('path');
  const dir = mkdtempSync(join(tmpdir(), 'primmel-check-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'model', 'instrument.prl'),
    `instrument T {
  dimension accuracy_class {
    scope group
    values { A B }
  }
}
attribute_definition e_max { symbol "E_max" origin design-fixed scope model }`,
  );
  mkdirSync(join(dir, 'entities'));
  writeFileSync(
    join(dir, 'entities', 'a.prl'),
    `class A#data { store { things } id: string { modality SHALL } }
class B#data { store { things } id: string { modality SHALL } }`,
  );
  mkdirSync(join(dir, 'specification'));
  writeFileSync(
    join(dir, 'specification', 'requirements.prl'),
    `requirement /req/x {
  binds_to { model.parameters.bogus_attr }
  applicability { accuracy_class: [Z] }
}
conformance_test /conf/t {
  targets { /req/missing }
  test_subject { accuracy_class: "Z" }
}`,
  );
  mkdirSync(join(dir, 'execution'));
  writeFileSync(
    join(dir, 'execution', 'f.prl'),
    `form F {
  name "F"
  field x { bind model.parameters.bogus_attr }
}`,
  );
  return dir;
}
