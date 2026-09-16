// ─────────────────────────────────────────────────────────────────────
// evaluation_dimensions construct (smart TODO.roadmap/40 batch 3) — the
// form-facing classification field schema: the singleton shape, the
// parse-enforced type/setting vocabularies, the codec fixpoint (the
// required/editable booleans always emit), and C134 (the enum
// resolution per-register gated; the field-name resolution accepting an
// is_dimension attribute_definition OR a dimension id, WARNING when
// neither — the owner-settled r129 camelCase convention).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const DIMENSIONS_REGISTER = `
dimension accuracy_class {
  cardinality single
  values {
    A { label "Class A" }
    B { label "Class B" }
  }
}
dimension humidity_class {
  cardinality single
  values {
    NH { label "No humidity" }
    SH { label "Static humidity" }
  }
}
dimension technology {
  cardinality single
  values {
    digital { label "Digital" }
    analogue-passive { label "Analogue passive" }
  }
}
dimension load_type {
  cardinality single
  values {
    compression { label "Compression" }
    tension { label "Tension" }
  }
}
`;

const FIELDS = `
evaluation_dimensions evaluation {
  label "Type of Testing"
  field technology {
    label "Technology"
    enum technology
    required true
    editable false
    setting MUST
  }
  field accuracy_class {
    label "Accuracy Class"
    type string
    enum accuracy_class
    required true
    editable false
    setting MUST
  }
  field load_type {
    label "Load Type"
    enum load_type
    required false
    editable true
    setting MAY
    multiple true
  }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-evaldim-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('evaluation_dimensions construct (smart TODO.roadmap/40 batch 3)', () => {
  it('parses the register entries', () => {
    const m = load(FIELDS);
    assert.equal(m.evaluationDimensions.length, 1);
    const d = m.evaluationDimensions[0]!;
    assert.equal(d.id, 'evaluation');
    assert.equal(d.label, 'Type of Testing');
    assert.equal(d.fields.length, 3);
    const t = d.fields[0]!;
    assert.equal(t.id, 'technology');
    assert.equal(t.label, 'Technology');
    assert.equal(t.type, '');
    assert.equal(t.enumRef, 'technology');
    assert.equal(t.required, true);
    assert.equal(t.editable, false);
    assert.equal(t.setting, 'MUST');
    assert.equal(t.multiple, false);
    const l = d.fields[2]!;
    assert.equal(l.required, false);
    assert.equal(l.editable, true);
    assert.equal(l.setting, 'MAY');
    assert.equal(l.multiple, true);
  });

  it('round-trips byte-clean (the codec fixpoint; booleans always emit)', () => {
    const out = dump(load(FIELDS));
    assert.ok(out.includes('evaluation_dimensions evaluation {\n'));
    assert.ok(
      out.includes(
        '  field accuracy_class {\n    label "Accuracy Class"\n    type string\n    enum accuracy_class\n    required true\n    editable false\n    setting MUST\n  }\n',
      ),
    );
    assert.ok(
      out.includes(
        '    required false\n    editable true\n    setting MAY\n    multiple true\n',
      ),
    );
    assert.equal(dump(load(out)), out);
  });

  it('rejects an unknown field type at parse (the fail-closed precedent)', () => {
    assert.throws(
      () => load('evaluation_dimensions evaluation { field x { type enum } }'),
      /Unknown field type "enum"/,
    );
  });

  it('rejects an unknown setting at parse (the fail-closed precedent)', () => {
    assert.throws(
      () =>
        load(
          'evaluation_dimensions evaluation { field x { setting REQUIRED } }',
        ),
      /Unknown setting "REQUIRED"/,
    );
  });

  it('C134: a coherent register is clean', () => {
    const issues = checkPackage(
      makePackage(DIMENSIONS_REGISTER + FIELDS),
    ).filter(i => i.check === 'C134');
    assert.deepEqual(issues, []);
  });

  it('C134: an enum naming no declared dimension is flagged (gated)', () => {
    const body = `
${DIMENSIONS_REGISTER}
evaluation_dimensions evaluation {
  field accuracy_class {
    label "Accuracy Class"
    enum accuracy-category
    required true
    editable false
  }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C134' && i.severity === 'error',
    );
    assert.equal(issues.length, 1);
    assert.match(
      issues[0]!.message,
      /enum "accuracy-category" is not a declared classification dimension/,
    );
  });

  it('C134 gates on the dimension register — no dimensions, no enum leg', () => {
    const issues = checkPackage(makePackage(FIELDS)).filter(
      i => i.check === 'C134',
    );
    assert.deepEqual(issues, []);
  });

  it('C134: a field name resolving to an is_dimension attribute_definition is clean', () => {
    const body = `
attribute_definition accuracy_class {
  name "Accuracy class"
  value_type string
  is_dimension true
}
evaluation_dimensions evaluation {
  field accuracy_class {
    label "Accuracy Class"
    required true
    editable false
  }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C134',
    );
    assert.deepEqual(issues, []);
  });

  it('C134: a field name resolving to neither register warns (the legacy camelCase convention)', () => {
    const body = `
${DIMENSIONS_REGISTER}
evaluation_dimensions evaluation {
  field accuracyClass {
    label "Accuracy Class"
    enum accuracy_class
    required true
    editable false
  }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C134',
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.severity, 'warning');
    assert.match(
      issues[0]!.message,
      /the field name "accuracyClass" resolves to neither/,
    );
  });
});
