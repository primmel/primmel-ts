// ─────────────────────────────────────────────────────────────────────
// The document module + the informative annex (smart TODO.roadmap/40
// batch 2; the packages-as-SSOT epic) — the `document_module` and
// `informative_annex` constructs, and the C123
// document-module-references-resolve linter rule (per-register gated,
// the C58 doctrine). The C119 declared-namespace preference legs live in
// test/uses-composition.test.ts beside the C119 suite.
//
// Fixtures:
//   MODULE — the pd_03 module: document identity, the owned namespace
//            pin, the pipeline sequence, and the LME register.
//   ANNEX  — the D 32 annex: the cited document block, the applies_to
//            edge, and one highlight.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const MODULE = `
process ia_application {
  name "IA application"
}
process ia_assessment {
  name "IA assessment"
}
governance_organ executive_secretary {
  label "Executive Secretary"
  clause "10"
  mandate "The ES runs the secretariat of the scheme."
}
document_module pd_03 {
  document "OIML-CS PD-03"
  title "Application and approval of OIML Issuing Authorities"
  edition "5"
  year 2025
  namespace /req/cs/pd-03
  sequence { ia_application ia_assessment }
  register lme_register {
    label "ILAC-IAF-OIML list of Legal Metrology Experts"
    clause "PD-02, 9"
    maintainer executive_secretary
    published "The OIML-CS pages of the OIML website."
    entries "Per Legal Metrology Expert: identity, contact, scope."
  }
  source { doc "urn:oiml:pub:cs:pd-03:2025" clause "" }
}
`;

const ANNEX = `
informative_annex d032 {
  document {
    id "D 32"
    title "General requirements for software controlled measuring instruments"
    edition 2018
    year 2018
    role informative
    source "data/oiml-d032/document.presentation.xml"
  }
  applies_to iso-iec-17065
  applied_by "PD-03, 4.3"
  scope "Software requirements applied to the evaluation of measuring instruments."
  numbering_caution "The D 32 clause numbering differs across editions."
  highlight design_evaluation_checklist {
    clause "G.7.1.1-3"
    title "Type evaluation includes design evaluation"
    statement "The design evaluation shall cover the software documentation."
    discharged_by "The IA review checklist covers the software documentation review."
  }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-docm-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('document_module construct (smart TODO.roadmap/40 batch 2)', () => {
  it('parses the document identity, the namespace pin, the sequence and the register', () => {
    const m = load(MODULE);
    const d = m.documentModules.find(x => x.id === 'pd_03')!;
    assert.equal(d.document, 'OIML-CS PD-03');
    assert.equal(
      d.title,
      'Application and approval of OIML Issuing Authorities',
    );
    assert.equal(d.edition, '5');
    assert.equal(d.year, 2025);
    assert.equal(d.namespace, '/req/cs/pd-03');
    assert.deepEqual(d.sequence, ['ia_application', 'ia_assessment']);
    assert.equal(d.registers.length, 1);
    assert.equal(d.registers[0]!.maintainer, 'executive_secretary');
    assert.equal(d.source.doc, 'urn:oiml:pub:cs:pd-03:2025');
  });

  it('round-trips the module losslessly (fixpoint)', () => {
    const m1 = load(MODULE);
    const dumped = dump(m1);
    assert.ok(dumped.includes('document_module pd_03 {'));
    assert.ok(dumped.includes('namespace /req/cs/pd-03'));
    assert.ok(dumped.includes('sequence { ia_application ia_assessment }'));
    assert.ok(dumped.includes('register lme_register {'));
    const m2 = load(dumped);
    assert.deepEqual(m2.documentModules, m1.documentModules);
    assert.equal(dump(m2), dumped);
  });
});

describe('informative_annex construct (smart TODO.roadmap/40 batch 2)', () => {
  it('parses the document block, the edges, and the highlight', () => {
    const m = load(ANNEX);
    const a = m.informativeAnnexes.find(x => x.id === 'd032')!;
    assert.deepEqual(a.document, {
      id: 'D 32',
      title:
        'General requirements for software controlled measuring instruments',
      edition: 2018,
      year: 2018,
      role: 'informative',
      source: 'data/oiml-d032/document.presentation.xml',
    });
    assert.equal(a.appliesTo, 'iso-iec-17065');
    assert.equal(a.appliedBy, 'PD-03, 4.3');
    assert.ok(a.scope.startsWith('Software requirements'));
    assert.equal(
      a.numberingCaution,
      'The D 32 clause numbering differs across editions.',
    );
    assert.equal(a.highlights.length, 1);
    const h = a.highlights[0]!;
    assert.equal(h.id, 'design_evaluation_checklist');
    assert.equal(h.clause, 'G.7.1.1-3');
    assert.equal(h.title, 'Type evaluation includes design evaluation');
    assert.ok(h.statement.startsWith('The design evaluation'));
    assert.ok(h.dischargedBy.startsWith('The IA review checklist'));
  });

  it('rejects a document role outside the vocabulary (parse-enforced)', () => {
    assert.throws(
      () =>
        load(
          'informative_annex x {\n  document {\n    id "X"\n    role normative\n  }\n}\n',
        ),
      /Unknown document role "normative" \(valid: informative\)/,
    );
  });

  it('round-trips the annex losslessly (fixpoint)', () => {
    const m1 = load(ANNEX);
    const dumped = dump(m1);
    assert.ok(dumped.includes('informative_annex d032 {'));
    assert.ok(dumped.includes('role informative'));
    assert.ok(dumped.includes('highlight design_evaluation_checklist {'));
    const m2 = load(dumped);
    assert.deepEqual(m2.informativeAnnexes, m1.informativeAnnexes);
    assert.equal(dump(m2), dumped);
  });
});

describe('C123 document-module-references-resolve', () => {
  function c123Issues(body: string, withLocator = false) {
    const dir = makePackage(body);
    return checkPackage(
      dir,
      withLocator ? { resolvePackage: () => undefined } : {},
    ).filter(i => i.check === 'C123');
  }

  it('accepts a coherent module (registers in scope)', () => {
    assert.deepEqual(c123Issues(MODULE), []);
  });

  it('flags a namespace that is no absolute requirement-namespace path', () => {
    const issues = c123Issues(
      MODULE.replace('namespace /req/cs/pd-03', 'namespace req/cs/pd-03'),
    );
    assert.equal(issues.length, 1);
    assert.ok(issues[0].message.includes('pd_03'));
    assert.ok(issues[0].message.includes('"req/cs/pd-03"'));
  });

  it('flags a dangling sequence member and a dangling register maintainer', () => {
    const issues = c123Issues(
      MODULE.replace(
        'sequence { ia_application ia_assessment }',
        'sequence { ia_application ghost }',
      ).replace('maintainer executive_secretary', 'maintainer ciml'),
    );
    assert.equal(issues.length, 2);
    assert.ok(issues.some(i => i.message.includes('"ghost"')));
    assert.ok(issues.some(i => i.message.includes('"ciml"')));
  });

  it('stays silent for edges whose target register is out of scope', () => {
    // No organs declared → the maintainer edge cannot be adjudicated.
    const noOrgans = MODULE.replace(
      /governance_organ executive_secretary \{[\s\S]*?\n\}\n/,
      '',
    );
    assert.deepEqual(c123Issues(noOrgans), []);
  });

  it('flags an annex applies_to no locator can resolve (locator-gated)', () => {
    const withLocator = c123Issues(ANNEX, true);
    assert.equal(withLocator.length, 1);
    assert.ok(withLocator[0].message.includes('d032'));
    assert.ok(withLocator[0].message.includes('"iso-iec-17065"'));
    // Without a locator the leg stays silent (the sibling scan cannot
    // adjudicate non-sibling ids).
    assert.deepEqual(c123Issues(ANNEX), []);
  });
});
