// ─────────────────────────────────────────────────────────────────────
// The ISO/IEC 17067 scheme-type register (smart TODO.roadmap/40 batch 2;
// the packages-as-SSOT epic) — the `scheme_activity_kind` and
// `scheme_type` constructs, the parse-enforced family/attestation_object
// vocabularies, the C122 scheme-type-resolves linter rule (per-register
// gated, the C58 doctrine), and the C98 deferral of the hard-coded
// no-surveillance set to the register's surveillance.required.
//
// Fixtures:
//   MENUS      — a small Table-1 menu set (one common function, two
//                determination kinds, one attestation kind, one
//                surveillance kind).
//   TYPES      — type_1a (no surveillance) and type_5 (surveillance
//                required) over the menus.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const MENUS = `
scheme_activity_kind review {
  family common
  row "I"
  label "review"
  source { doc "urn:iso-iec:std:iso-iec:17067:2013" clause "5.2" }
}
scheme_activity_kind testing {
  family determination
  row "II a)"
  label "testing (of product items)"
}
scheme_activity_kind inspection {
  family determination
  row "II b)"
  label "inspection (of product items)"
}
scheme_activity_kind issue_statement {
  family attestation
  row "III a)"
  label "issuing a statement of conformity"
}
scheme_activity_kind market_sampling {
  family surveillance
  row "IV a)"
  label "sampling from the market"
}
`;

const TYPES = `
scheme_type type_1a {
  label "scheme type 1a"
  clause "5.3.2"
  description "Samples are tested against the requirements; the attestation covers the sample."
  attestation_object batch
  determination { testing inspection }
  attestation { issue_statement }
  surveillance {
    required false
  }
  notes { "The conformity statement applies to the sample only." }
  source { doc "urn:iso-iec:std:iso-iec:17067:2013" clause "5.3.2" }
}
scheme_type type_5 {
  label "scheme type 5"
  clause "5.3.7"
  description "The surveillance part of this scheme allows periodic assessment."
  sampling "Surveillance samples are taken periodically from the market or the factory."
  attestation_object ongoing_production
  determination { testing inspection }
  attestation { issue_statement }
  surveillance {
    required true
    activities { market_sampling }
  }
  notes { "If the surveillance includes audit of the management system, an initial audit is needed." }
  source { doc "urn:iso-iec:std:iso-iec:17067:2013" clause "5.3.7" }
}
`;

function makePackage(body: string, manifest = 'package { id test }'): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-scht-'));
  writeFileSync(join(dir, 'package.primmel'), manifest);
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('scheme_activity_kind construct (smart TODO.roadmap/40 batch 2)', () => {
  it('parses id, family, row, label, source', () => {
    const m = load(MENUS);
    assert.equal(m.schemeActivityKinds.length, 5);
    const testing = m.schemeActivityKinds.find(k => k.id === 'testing')!;
    assert.equal(testing.family, 'determination');
    assert.equal(testing.row, 'II a)');
    assert.equal(testing.label, 'testing (of product items)');
    const review = m.schemeActivityKinds.find(k => k.id === 'review')!;
    assert.equal(review.family, 'common');
    assert.equal(review.source.doc, 'urn:iso-iec:std:iso-iec:17067:2013');
    assert.equal(review.source.clause, '5.2');
  });

  it('rejects a family outside the Table-1 menus (parse-enforced)', () => {
    assert.throws(
      () => load('scheme_activity_kind divination {\n  family reading\n}\n'),
      /Unknown family "reading" \(valid: common, determination, attestation, surveillance\)/,
    );
  });

  it('round-trips the menus losslessly (fixpoint)', () => {
    const m1 = load(MENUS);
    const dumped = dump(m1);
    assert.ok(dumped.includes('scheme_activity_kind testing {'));
    assert.ok(dumped.includes('row "II a)"'));
    const m2 = load(dumped);
    assert.deepEqual(m2.schemeActivityKinds, m1.schemeActivityKinds);
    assert.equal(dump(m2), dumped);
  });
});

describe('scheme_type construct (smart TODO.roadmap/40 batch 2)', () => {
  it('parses the full type facet set', () => {
    const m = load(TYPES);
    assert.equal(m.schemeTypes.length, 2);
    const t5 = m.schemeTypes.find(t => t.id === 'type_5')!;
    assert.equal(t5.label, 'scheme type 5');
    assert.equal(t5.clause, '5.3.7');
    assert.ok(t5.description.startsWith('The surveillance part'));
    assert.ok(t5.sampling.startsWith('Surveillance samples'));
    assert.equal(t5.attestationObject, 'ongoing_production');
    assert.deepEqual(t5.determination, ['testing', 'inspection']);
    assert.deepEqual(t5.attestation, ['issue_statement']);
    assert.deepEqual(t5.surveillance, {
      required: true,
      activities: ['market_sampling'],
    });
    assert.deepEqual(t5.notes, [
      'If the surveillance includes audit of the management system, an initial audit is needed.',
    ]);
    assert.equal(t5.source.clause, '5.3.7');
    const t1a = m.schemeTypes.find(t => t.id === 'type_1a')!;
    assert.equal(t1a.attestationObject, 'batch');
    assert.deepEqual(t1a.surveillance, { required: false, activities: [] });
  });

  it('rejects an attestation_object outside the enumeration (parse-enforced)', () => {
    assert.throws(
      () => load('scheme_type type_9 {\n  attestation_object everything\n}\n'),
      /Unknown attestation_object "everything" \(valid: product_type, batch, ongoing_production, service_or_process\)/,
    );
  });

  it('round-trips the types losslessly (fixpoint)', () => {
    const m1 = load(MENUS + TYPES);
    const dumped = dump(m1);
    assert.ok(dumped.includes('scheme_type type_5 {'));
    assert.ok(dumped.includes('attestation_object ongoing_production'));
    assert.ok(dumped.includes('required true'));
    assert.ok(dumped.includes('required false'));
    const m2 = load(dumped);
    assert.deepEqual(m2.schemeTypes, m1.schemeTypes);
    assert.equal(dump(m2), dumped);
  });
});

describe('C122 scheme-type-resolves', () => {
  function c122Issues(body: string, manifest?: string) {
    return checkPackage(makePackage(body, manifest)).filter(
      i => i.check === 'C122',
    );
  }

  it('accepts a manifest token resolving against the in-scope register', () => {
    assert.deepEqual(
      c122Issues(
        MENUS + TYPES,
        'package { id test kind certification_program scheme_type type_5 maps_to { test } }',
      ),
      [],
    );
  });

  it('flags a manifest token the in-scope register does not declare', () => {
    const issues = c122Issues(
      MENUS + TYPES,
      'package { id test kind certification_program scheme_type type_9 maps_to { test } }',
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'error');
    assert.ok(issues[0].message.includes('"type_9"'));
    assert.ok(issues[0].message.includes('scheme-type-resolves'));
  });

  it('stays silent on the manifest token when no register is in scope (the register-free fallback)', () => {
    assert.deepEqual(
      c122Issues(
        '',
        'package { id test kind certification_program scheme_type type_9 maps_to { test } }',
      ),
      [],
    );
  });

  it('flags a menu entry the menus do not declare', () => {
    const issues = c122Issues(
      (MENUS + TYPES).replace(
        'determination { testing inspection }\n  attestation { issue_statement }\n  surveillance {\n    required true',
        'determination { testing divination }\n  attestation { issue_statement }\n  surveillance {\n    required true',
      ),
    );
    assert.equal(issues.length, 1);
    assert.ok(issues[0].message.includes('type_5'));
    assert.ok(issues[0].message.includes('"divination"'));
  });

  it('stays silent on menu entries when the menus are out of scope', () => {
    assert.deepEqual(
      c122Issues(
        TYPES.replace(
          'determination { testing inspection }\n  attestation { issue_statement }\n  surveillance {\n    required true',
          'determination { testing divination }\n  attestation { issue_statement }\n  surveillance {\n    required true',
        ),
      ),
      [],
    );
  });
});

describe('C98 defers to the register (smart TODO.roadmap/40 batch 2)', () => {
  const PROGRAM_MANIFEST = (t: string) =>
    `package { id test kind certification_program scheme_type ${t} maps_to { test } }`;
  const MONITOR = `
subject Watched {
  is {
    metadata { name "Watched subject" }
  }
}
monitor watch {
  over { Watched }
  triggers { every 1h }
  evaluate { requirements { } promises all }
  emit { evidence -> workspace verdicts -> log }
  escalate { on fail { flag_certificate } }
}
`;

  it('register-free: type_1a + a monitor warns (the fallback set)', () => {
    const c98 = checkPackage(
      makePackage(MONITOR, PROGRAM_MANIFEST('type_1a')),
    ).filter(i => i.check === 'C98');
    assert.equal(c98.length, 1);
    assert.equal(c98[0].severity, 'warning');
  });

  it('register in scope: surveillance.required true overrides the fallback set', () => {
    // type_1a IS in the hard-coded no-surveillance set, but the register
    // declares it surveillance-requiring — the register wins.
    const register = TYPES.replace(
      'surveillance {\n    required false\n  }',
      'surveillance {\n    required true\n    activities { market_sampling }\n  }',
    );
    const c98 = checkPackage(
      makePackage(MENUS + register + MONITOR, PROGRAM_MANIFEST('type_1a')),
    ).filter(i => i.check === 'C98');
    assert.deepEqual(c98, []);
  });

  it('register in scope: surveillance.required false extends the no-surveillance judgment', () => {
    // type_5 is NOT in the hard-coded set, but the register declares it
    // surveillance-free — the register wins there too.
    const register = TYPES.replace(
      'surveillance {\n    required true\n    activities { market_sampling }\n  }',
      'surveillance {\n    required false\n  }',
    );
    const c98 = checkPackage(
      makePackage(MENUS + register + MONITOR, PROGRAM_MANIFEST('type_5')),
    ).filter(i => i.check === 'C98');
    assert.equal(c98.length, 1);
    assert.ok(c98[0].message.includes('type_5'));
  });
});
