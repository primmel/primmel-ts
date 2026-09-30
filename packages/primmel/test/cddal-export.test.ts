// ─────────────────────────────────────────────────────────────────────
// The CDDAL export (TODO.reconfigure/04, "CDDAL interop"): the
// dictionary subset's power-typed projection — a class is a class
// entity (an instance of the class metaclass), an instance is a
// subclass-of-one — and the identifier-carry discipline (the verbatim
// id rides the code assignment; the sanitized symbol rides the name
// slot). The full round trip against the reference implementation is
// the conformance suite's CDDAL leg; these specs pin the projection
// itself.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from '../src/ser-des/index';
import { projectCddal, exportPackageCddal } from '../src/export/cddal';

const model = load(`
class LoadCellSample {
  serial_number : string { modality SHALL }
  e_max : quantity { modality SHALL unit "t" }
}

class FamilySample {
  extends { LoadCellSample }
  family_code : string { modality SHALL }
}

instance smp-001 {
  of FamilySample
  level sample
  has {
    attributes {
      serial_number : "HBK-001"
      e_max : 2.2 t
    }
  }
}
`);

describe('the CDDAL projection', () => {
  const out = projectCddal(model, 'test-pkg');

  it('projects every class as a class entity of the class metaclass', () => {
    assert.equal(out.stats.classes, 2);
    assert.match(out.cddal, /instance LoadCellSample < MDC_C002 \{/);
    assert.match(out.cddal, / {2}code: LoadCellSample/);
    assert.match(out.cddal, / {2}superclass: UNIVERSE/);
    assert.match(
      out.cddal,
      / {2}applicable_properties: \{ serial_number, e_max \}/,
    );
  });

  it('carries the class inheritance as the CDD superclass', () => {
    assert.match(out.cddal, /instance FamilySample < MDC_C002 \{/);
    assert.match(out.cddal, / {2}superclass: LoadCellSample/);
    assert.match(out.cddal, / {2}applicable_properties: \{ family_code \}/);
  });

  it('projects an instance as a subclass-of-one with its exhibited values', () => {
    assert.equal(out.stats.instances, 1);
    assert.match(out.cddal, /instance smp_001 < MDC_C002 \{/);
    assert.match(out.cddal, / {2}superclass: FamilySample/);
    assert.match(out.cddal, / {2}serial_number: "HBK-001"/);
    assert.match(out.cddal, / {2}e_max: "2.2 t"/);
    assert.equal(out.stats.assignments, 2);
  });

  it('carries the verbatim hyphenated id in the quoted code assignment', () => {
    assert.match(out.cddal, / {2}code: "smp-001"/);
  });

  it('escapes string values', () => {
    const m2 = load(`
class C {
  a : string { modality SHALL }
}

instance i {
  of C
  has { attributes { a : "quote \\" and backslash \\\\" } }
}
`);
    const o2 = projectCddal(m2, 'test-pkg');
    assert.match(o2.cddal, / {2}a: "quote \\" and backslash \\\\"/);
  });

  it('throws when the package carries no dictionary content', () => {
    const empty = load('note n1 { message "no dictionary content" }');
    assert.throws(
      () => projectCddal(empty, 'test-pkg'),
      /no dictionary content/,
    );
  });
});

describe('the CDDAL package export', () => {
  it('exports a package directory end to end', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'primmel-cddal-'));
    writeFileSync(join(dir, 'package.primmel'), 'package { id cddal-e2e }');
    mkdirSync(join(dir, 'model'));
    writeFileSync(
      join(dir, 'model', 'd.prl'),
      'class C { a : string { modality SHALL } }\ninstance i { of C has { attributes { a : "v" } } }\n',
    );
    const out = exportPackageCddal(dir);
    assert.equal(out.stats.classes, 1);
    assert.equal(out.stats.instances, 1);
    assert.match(out.cddal, /instance C < MDC_C002 \{/);
    assert.match(out.cddal, / {2}a: "v"/);
  });
});
