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

  it('projects class fields with declared definitions as property entities', () => {
    const m3 = load(`
attribute_definition serial_number {
  name "Serial number"
  definition "The manufacturer's serial number."
  value_type string
  origin declared
  scope model
  category administrative
  corresponds iec-cdd "0112/2///61987#ABA123"
}

class LoadCellSample {
  serial_number : string { modality SHALL }
}
`);
    const o3 = projectCddal(m3, 'test-pkg');
    assert.equal(o3.stats.properties, 1);
    assert.match(o3.cddal, /instance serial_number < MDC_C003 \{/);
    assert.match(o3.cddal, / {2}code: "0112\/2\/\/\/61987#ABA123"/);
    assert.match(
      o3.cddal,
      / {2}definition\.en: "The manufacturer's serial number\."/,
    );
  });

  it('projects enums as value lists with one value term per value', () => {
    const m4 = load(`
enum accuracy {
  A { }
  C3 { }
}
`);
    const o4 = projectCddal(m4, 'test-pkg');
    assert.equal(o4.stats.valueLists, 1);
    assert.match(o4.cddal, /instance accuracy < MDC_C005 \{/);
    assert.match(o4.cddal, / {2}code: accuracy/);
    assert.match(o4.cddal, / {2}MDC_P043: \( A, C3 \)/);
    assert.match(o4.cddal, /instance A < MDC_C010 \{/);
    assert.match(o4.cddal, /instance C3 < MDC_C010 \{/);
  });

  it('projects a class extending an instance as the prototype superclass', () => {
    const m6 = load(`
class P {
  a : string { modality SHALL }
}

instance proto {
  of P
  has { attributes { a : "seed" } }
}

class Line {
  extends { proto }
  b : string { modality SHALL }
}
`);
    const o6 = projectCddal(m6, 'test-pkg');
    assert.match(o6.cddal, /instance Line < MDC_C002 \{/);
    assert.match(o6.cddal, / {2}superclass: proto/);
    assert.match(o6.cddal, /instance proto < MDC_C002 \{/);
    assert.match(o6.cddal, / {2}code: proto/);
  });

  it('carries language-tagged definition alternates from the l10n files', () => {
    const m5 = load(`
class C {
  description { "Default spelling" }
  a : string { modality SHALL }
}
`);
    const l10n = new Map([
      ['C.description', [{ tag: 'fra-Latn', value: 'Orthographe française' }]],
    ]);
    const o5 = projectCddal(m5, 'test-pkg', l10n);
    assert.match(o5.cddal, / {2}definition\.en: "Default spelling"/);
    assert.match(o5.cddal, / {2}definition\.fra-Latn: "Orthographe française"/);
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
