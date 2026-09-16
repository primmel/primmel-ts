// ─────────────────────────────────────────────────────────────────────
// The test-report constructs (smart TODO.roadmap/40 batch 3) —
// test_report_skeleton + test_report_checklist: the parse legs, the
// parse-enforced vocabularies, the codec fixpoints, the checklist
// OVERLAY composition (entry scalars land in place, the base order
// survives, the orphan-overlay error), and C140/C141.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { loadPackageWithIssues } from '../src/ser-des/package';
import { checkPackage } from '../src/check';

const SKELETON = `
test_report_skeleton r60-3/test-report {
  title "OIML R 60 Type Evaluation Report"
  description "The complete evaluation report for an OIML R 60 load cell type evaluation."
  section 4 {
    title "Evaluation Report"
    description "Administrative and descriptive information."
    form r60-3/sec-4.1 {
      file "04-01-authority-info"
      title "Issuing Authority"
      required always
    }
    form r60-3/sec-4.3.2-b {
      file "04-03-02-b-performance-digital"
      title "Summary of Performance Test Results (Digital)"
      required conditional
      applicability { technology: [digital, digital-with-processing] }
    }
    subsection "Base Metrological Tests" {
      description "The metrological core."
      form r60-3/table-6.5 {
        file "load-cell-errors"
        title "Load Cell Errors"
        conformance_test /conf/metrological-tests/measurement-error-repeatability-mdlo
        requirements { /req/metrological/mpe }
        required always
      }
    }
  }
}
`;

const BASE_CHECKLIST = `
test_report_checklist oiml-cs-trf {
  entry title {
    element "a"
    description "Title: 'OIML test report'"
    obligation shall
    source "test_report.title"
  }
  entry sample_identification {
    element "h"
    description "Specific samples tested, including their identification"
    obligation shall
  }
  entry results_with_uncertainty {
    element "q"
    description "Test results with the associated uncertainty"
    obligation may
    description_note "Where relevant for the evaluation"
  }
}
`;

const REC_OVERLAY = `
test_report_checklist oiml-cs-trf {
  overlay true
  entry sample_identification { validation "form_contains('04-07-sample-selection')" }
}
`;

const REGISTERS = `
form r60-3/sec-4.1 {
  name "Issuing Authority"
}
form r60-3/sec-4.3.2-b {
  name "Summary of Performance Test Results (Digital)"
}
form r60-3/table-6.5 {
  name "Load Cell Errors"
}
requirement /req/metrological/mpe {
  name "Maximum permissible errors"
  statement "The error shall not exceed the MPE."
}
conformance_test /conf/metrological-tests/measurement-error-repeatability-mdlo {
  name "Measurement error and repeatability"
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-testreport-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('test_report_skeleton (smart TODO.roadmap/40 batch 3)', () => {
  it('parses the sections, forms, and subsections', () => {
    const m = load(SKELETON);
    assert.equal(m.testReportSkeletons.length, 1);
    const s = m.testReportSkeletons[0]!;
    assert.equal(s.id, 'r60-3/test-report');
    assert.equal(s.title, 'OIML R 60 Type Evaluation Report');
    assert.equal(s.sections.length, 1);
    const sec = s.sections[0]!;
    assert.equal(sec.id, '4');
    assert.equal(sec.forms.length, 2);
    const f = sec.forms[1]!;
    assert.equal(f.id, 'r60-3/sec-4.3.2-b');
    assert.equal(f.file, '04-03-02-b-performance-digital');
    assert.equal(f.required, 'conditional');
    assert.deepEqual(
      f.applicability.map(a => [a.dimension, a.values]),
      [['technology', ['digital', 'digital-with-processing']]],
    );
    const sub = sec.subsections[0]!;
    assert.equal(sub.title, 'Base Metrological Tests');
    const sf = sub.forms[0]!;
    assert.equal(
      sf.conformanceTest,
      '/conf/metrological-tests/measurement-error-repeatability-mdlo',
    );
    assert.deepEqual(sf.requirements, ['/req/metrological/mpe']);
  });

  it('round-trips byte-clean (the codec fixpoint)', () => {
    const out = dump(load(SKELETON));
    assert.ok(out.includes('test_report_skeleton r60-3/test-report {\n'));
    assert.ok(out.includes('  section 4 {\n'));
    assert.ok(out.includes('    subsection "Base Metrological Tests" {\n'));
    assert.ok(
      out.includes(
        '      applicability { technology: [digital, digital-with-processing] }\n',
      ),
    );
    assert.equal(dump(load(out)), out);
  });

  it('rejects an unknown required at parse (the fail-closed precedent)', () => {
    assert.throws(
      () =>
        load(
          'test_report_skeleton x { section 4 { form f { required mandatory } } }',
        ),
      /Unknown required "mandatory"/,
    );
  });

  it('C140: a coherent skeleton is clean', () => {
    const issues = checkPackage(makePackage(REGISTERS + SKELETON)).filter(
      i => i.check === 'C140',
    );
    assert.deepEqual(issues, []);
  });

  it('C140: dangling form/conformance_test/requirements references are flagged (gated)', () => {
    const body = `
${REGISTERS}
test_report_skeleton x/test-report {
  section 4 {
    form r60-3/bogus {
      file "bogus"
      required always
      conformance_test /conf/bogus
      requirements { /req/bogus }
    }
  }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C140',
    );
    assert.equal(issues.length, 3);
    assert.match(issues[0]!.message, /the entry id is not a declared form/);
    assert.match(issues[1]!.message, /conformance_test "\/conf\/bogus"/);
    assert.match(issues[2]!.message, /requirements entry "\/req\/bogus"/);
  });

  it('C140 gates per register — no forms/tests/requirements, no resolution legs', () => {
    const issues = checkPackage(makePackage(SKELETON)).filter(
      i => i.check === 'C140',
    );
    assert.deepEqual(issues, []);
  });

  it('C140: required conditional without applicability or notes warns', () => {
    const issues = checkPackage(
      makePackage(
        'test_report_skeleton x { section 4 { form f { file "f" required conditional } } }',
      ),
    ).filter(i => i.check === 'C140');
    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.severity, 'warning');
    assert.match(issues[0]!.message, /the inclusion rule is undocumented/);
  });
});

describe('test_report_checklist (smart TODO.roadmap/40 batch 3)', () => {
  it('parses the entries (incl. the may entry’s description_note)', () => {
    const m = load(BASE_CHECKLIST);
    const c = m.testReportChecklists[0]!;
    assert.equal(c.id, 'oiml-cs-trf');
    assert.equal(c.overlay, false);
    assert.equal(c.entries.length, 3);
    const e = c.entries[2]!;
    assert.equal(e.element, 'q');
    assert.equal(e.obligation, 'may');
    assert.equal(e.descriptionNote, 'Where relevant for the evaluation');
    assert.equal(c.entries[0]!.source, 'test_report.title');
    assert.equal(c.entries[1]!.validation, null);
  });

  it('round-trips byte-clean (the codec fixpoint; overlay emits only when true)', () => {
    const out = dump(load(BASE_CHECKLIST));
    assert.ok(
      out.includes('test_report_checklist oiml-cs-trf {\n  entry title {\n'),
    );
    assert.equal(dump(load(out)), out);
    const overlayOut = dump(load(REC_OVERLAY));
    assert.ok(
      overlayOut.includes(
        '  overlay true\n  entry sample_identification {\n    validation "form_contains(\'04-07-sample-selection\')"\n  }\n',
      ),
    );
    assert.equal(dump(load(overlayOut)), overlayOut);
  });

  it('rejects an unknown obligation at parse (the fail-closed precedent)', () => {
    assert.throws(
      () => load('test_report_checklist x { entry e { obligation should } }'),
      /Unknown obligation "should"/,
    );
  });

  it('the overlay composition: entry scalars land in place, the base order survives', () => {
    const dirs = new Map<string, string>();
    const mk = (id: string, manifest: string, body: string): string => {
      const dir = mkdtempSync(join(tmpdir(), `primmel-tr-${id}-`));
      writeFileSync(join(dir, 'package.primmel'), manifest);
      const p = join(dir, 'model', 'checklist.prl');
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, body);
      dirs.set(id, dir);
      return dir;
    };
    mk('tr-core', 'package { id tr-core kind core }', BASE_CHECKLIST);
    const recDir = mk(
      'tr-rec',
      'package { id tr-rec kind rec uses { tr-core } }',
      REC_OVERLAY,
    );
    const issues = checkPackage(recDir, {
      resolvePackage: id => dirs.get(id),
    }).filter(i => i.check === 'C141');
    assert.deepEqual(issues, []);
    // The merged checklist: the overlay's validation lands on the
    // base's h entry IN PLACE (no reorder to the tail).
    const { standard } = loadPackageWithIssues(recDir, {
      resolvePackage: id => dirs.get(id),
    });
    const c = standard.testReportChecklists.find(x => x.id === 'oiml-cs-trf')!;
    assert.deepEqual(
      c.entries.map(e => e.id),
      ['title', 'sample_identification', 'results_with_uncertainty'],
    );
    const h = c.entries[1]!;
    assert.equal(h.element, 'h');
    assert.equal(h.obligation, 'shall');
    assert.equal(h.validation, "form_contains('04-07-sample-selection')");
  });

  it('the orphan-overlay error: an overlay entry must name an upstream entry id', () => {
    const dirs = new Map<string, string>();
    const mk = (id: string, manifest: string, body: string): string => {
      const dir = mkdtempSync(join(tmpdir(), `primmel-tr2-${id}-`));
      writeFileSync(join(dir, 'package.primmel'), manifest);
      const p = join(dir, 'model', 'checklist.prl');
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, body);
      dirs.set(id, dir);
      return dir;
    };
    mk('tr-core', 'package { id tr-core kind core }', BASE_CHECKLIST);
    const recDir = mk(
      'tr-rec',
      'package { id tr-rec kind rec uses { tr-core } }',
      `test_report_checklist oiml-cs-trf {
  overlay true
  entry bogus_entry { validation "x" }
}
`,
    );
    const issues = checkPackage(recDir, {
      resolvePackage: id => dirs.get(id),
    }).filter(i => i.check === 'C141');
    assert.equal(issues.length, 1);
    assert.match(
      issues[0]!.message,
      /entry "bogus_entry", which no upstream package's checklist carries/,
    );
  });

  it('C141: duplicated entry ids are flagged', () => {
    const issues = checkPackage(
      makePackage(
        'test_report_checklist x { entry a { element "a" } entry a { element "b" } }',
      ),
    ).filter(i => i.check === 'C141');
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /entry "a" is declared twice/);
  });

  it('C141: an element letter outside a–r warns (the vocabulary can grow)', () => {
    const issues = checkPackage(
      makePackage('test_report_checklist x { entry a { element "s" } }'),
    ).filter(i => i.check === 'C141');
    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.severity, 'warning');
    assert.match(issues[0]!.message, /outside the PD-05 §4\.4\.3 vocabulary/);
  });
});
