// ─────────────────────────────────────────────────────────────────────
// certificate_template construct (smart TODO.roadmap/40 batch 3) — the
// certificate rendering contract: the singleton shape, the
// parse-enforced obligation vocabulary, the codec fixpoint, and C136
// (the dimension_labels placeholder resolution gated, the
// characteristic binding resolutions + the XOR shape leg, the
// renderer-vocabulary type check at error, the number_format token
// check at warning).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const TEMPLATE = `
certificate_template certificate {
  number_format "{shortName}/{edition}-{scheme}-{authority}-{year2}.{seq}"
  dimension_labels {
    pattern "{measurand_components}-{measuring_principle}"
    separator "+"
  }
  characteristic e_max {
    type quantity
    label "E_max values"
    attribute e_max
    obligation mandatory
  }
  characteristic traceability_limitation {
    type statement
    label "Declared traceability limitation"
    obligation optional
  }
  anr_section {
    title "Additional National Requirements"
    covered_label "Evaluated"
    not_evaluated_label "Not evaluated in this evaluation"
    pending_label "Pending evaluation"
    none_targeted_note "No additional national requirements were targeted by the application."
  }
}
`;

const REGISTERS = `
dimension measurand_components {
  cardinality set
  values {
    co { label "CO" }
    no { label "NO" }
  }
}
dimension measuring_principle {
  cardinality single
  values {
    ndir { label "NDIR" }
  }
}
attribute_definition e_max {
  name "Maximum capacity"
  value_type QuantityValue
  is_dimension false
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-certtpl-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('certificate_template construct (smart TODO.roadmap/40 batch 3)', () => {
  it('parses the register entries', () => {
    const m = load(TEMPLATE);
    assert.equal(m.certificateTemplates.length, 1);
    const t = m.certificateTemplates[0]!;
    assert.equal(t.id, 'certificate');
    assert.equal(
      t.numberFormat,
      '{shortName}/{edition}-{scheme}-{authority}-{year2}.{seq}',
    );
    assert.equal(
      t.dimensionLabels?.pattern,
      '{measurand_components}-{measuring_principle}',
    );
    assert.equal(t.dimensionLabels?.separator, '+');
    assert.equal(t.characteristics.length, 2);
    const c = t.characteristics[0]!;
    assert.equal(c.id, 'e_max');
    assert.equal(c.type, 'quantity');
    assert.equal(c.label, 'E_max values');
    assert.equal(c.attribute, 'e_max');
    assert.deepEqual(c.attributes, []);
    assert.equal(c.dimension, '');
    assert.equal(c.obligation, 'mandatory');
    const s = t.characteristics[1]!;
    assert.equal(s.attribute, '');
    assert.equal(s.obligation, 'optional');
    assert.equal(t.anrSection?.title, 'Additional National Requirements');
    assert.equal(t.anrSection?.coveredLabel, 'Evaluated');
    assert.match(
      t.anrSection?.noneTargetedNote ?? '',
      /targeted by the application\.$/,
    );
  });

  it('round-trips byte-clean (the codec fixpoint)', () => {
    const out = dump(load(TEMPLATE));
    assert.ok(out.includes('certificate_template certificate {\n'));
    assert.ok(
      out.includes(
        '  dimension_labels {\n    pattern "{measurand_components}-{measuring_principle}"\n    separator "+"\n  }\n',
      ),
    );
    assert.ok(
      out.includes(
        '  characteristic e_max {\n    type quantity\n    label "E_max values"\n    attribute e_max\n    obligation mandatory\n  }\n',
      ),
    );
    assert.equal(dump(load(out)), out);
  });

  it('parses the multi-attribute binding (the attributes list)', () => {
    const m = load(
      'certificate_template certificate { characteristic temps { type quantity label "Temperature range" attributes { t_min t_max } obligation mandatory } }',
    );
    assert.deepEqual(
      m.certificateTemplates[0]!.characteristics[0]!.attributes,
      ['t_min', 't_max'],
    );
  });

  it('rejects an unknown obligation at parse (the fail-closed precedent)', () => {
    assert.throws(
      () =>
        load(
          'certificate_template certificate { characteristic x { obligation shall } }',
        ),
      /Unknown obligation "shall"/,
    );
  });

  it('C136: a coherent template is clean', () => {
    const issues = checkPackage(makePackage(REGISTERS + TEMPLATE)).filter(
      i => i.check === 'C136',
    );
    assert.deepEqual(issues, []);
  });

  it('C136: a dimension_labels placeholder naming no declared dimension is flagged (gated)', () => {
    const body = `
${REGISTERS}
certificate_template certificate {
  dimension_labels { pattern "{accuracy_class}-{measuring_principle}" }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C136',
    );
    assert.equal(issues.length, 1);
    assert.match(
      issues[0]!.message,
      /dimension_labels placeholder "\{accuracy_class\}" is not a declared classification dimension/,
    );
  });

  it('C136 gates the dimension_labels leg — no dimensions, no leg', () => {
    const issues = checkPackage(makePackage(TEMPLATE)).filter(
      i => i.check === 'C136',
    );
    assert.deepEqual(issues, []);
  });

  it('C136: the {dim:sep} placeholder spelling resolves the dimension part', () => {
    const body = `
${REGISTERS}
certificate_template certificate {
  dimension_labels { pattern "{measurand_components:+}-{bogus:+}" }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C136',
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /"\{bogus\}"/);
  });

  it('C136: a characteristic type outside the renderer vocabulary is an error', () => {
    const body = `
certificate_template certificate {
  characteristic x { type float label "X" }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C136',
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.severity, 'error');
    assert.match(
      issues[0]!.message,
      /type "float" is outside the renderer vocabulary/,
    );
  });

  it('C136: the XOR shape leg — two bindings on one characteristic', () => {
    const body = `
certificate_template certificate {
  characteristic x { type string attribute a dimension b }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C136',
    );
    assert.equal(issues.length, 1);
    assert.match(
      issues[0]!.message,
      /the XOR is attribute \| attributes \| dimension \| none/,
    );
  });

  it('C136: dangling characteristic bindings are flagged (per-register gated)', () => {
    const body = `
${REGISTERS}
certificate_template certificate {
  characteristic a { type quantity attribute bogus_attr }
  characteristic b { type quantity attributes { e_max bogus_attr2 } }
  characteristic c { type string dimension bogus_dim }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C136',
    );
    assert.equal(issues.length, 3);
    assert.match(
      issues[0]!.message,
      /attribute "bogus_attr" is not a declared attribute_definition/,
    );
    assert.match(
      issues[1]!.message,
      /attributes entry "bogus_attr2" is not a declared attribute_definition/,
    );
    assert.match(
      issues[2]!.message,
      /dimension "bogus_dim" is not a declared classification dimension/,
    );
  });

  it('C136: an unknown number_format placeholder warns (program-specific spelling)', () => {
    const body = `
certificate_template certificate {
  number_format "TW-1/{edition}-T5-{authority}-{year2}.{seq}"
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C136',
    );
    assert.deepEqual(issues, []);
    const bad = checkPackage(
      makePackage(
        'certificate_template certificate { number_format "{shortName}/{serial_no}" }',
      ),
    ).filter(i => i.check === 'C136');
    assert.equal(bad.length, 1);
    assert.equal(bad[0]!.severity, 'warning');
    assert.match(bad[0]!.message, /"\{serial_no\}" is not a known token/);
  });
});
