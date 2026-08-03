// ─────────────────────────────────────────────────────────────────────
// The composition facet construct (TODO.integration/14 — types/
// Composition.ts): `composed_of` in the subject anatomy — parse, the
// lint rules (C100 components-resolve, C101 decomposition-covers,
// C102 state-rule-closed), the dump fixpoint, and the REAL
// acme-cgm-system package migrated to the construct end to end.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump, loadPackageWithIssues } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const SMART_REPO = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'oimlsmart',
  'smart',
);

/** Write one fixture package to a temp dir and lint it (the kernel
 *  tests' own discipline — checkPackage wants a directory). */
function checkString(text: string) {
  const dir = mkdtempSync(join(tmpdir(), 'composed-of-'));
  writeFileSync(
    join(dir, 'package.primmel'),
    'package {\n  id test-composite\n  kind rec\n  title "test"\n  version "2026"\n  editions { 2026 }\n  baseUrn "urn:test"\n  uses { }\n  requires { }\n  status preview\n  default_spelling eng-Latn\n  description "x"\n}\n',
  );
  writeFileSync(join(dir, 'model.prl'), text);
  return checkPackage(dir).filter(i => i.severity === 'error');
}

const PACKAGE = `
quantity_register si {
  kind volume-fraction { si_unit "1" }
  kind dimensionless { si_unit "1" }
  unit ppm { symbol "ppm" kind volume-fraction factor 0.000001 }
  unit dimensionless { label "dimensionless" kind dimensionless }
}

subject SampleLine {
  is {
    endpoint sample_line_api {
      operation get_sample_flow { kind query serves { flow } payload { quantity_kind volume-fraction unit ppm timestamp true } }
      access { public { get_sample_flow } }
      profile rest_json
    }
  }
  has {
    serve sample.test_context.flow via get_sample_flow { fresh_within 5s }
  }
}

subject CGMSystem {
  is {
    endpoint cgm_system_api {
      operation get_indication_co { kind query serves { indication_co } payload { quantity_kind volume-fraction unit ppm timestamp true } }
      operation watch_op_state { kind subscribe serves { state environmental_context } payload { quantity_kind dimensionless unit dimensionless timestamp true } }
      access { public { get_indication_co } registered { watch_op_state } }
      profile rest_json
    }
    composed_of {
      component analyzer {
        product acme-cgm-200@2026
        endpoint cgm_api
        serial "CGM200-DEMO-0001"
        certificate null
      }
      component sample_line {
        product acme-cgm-system/sample-line@2026
        endpoint sample_line_api
        serial "CGM200-SL-0001"
        certificate "TC-2026-0001"
      }
      decomposition {
        sample.indication_co -> analyzer.indication_co
        sample.environmental_context -> analyzer.environmental_context
        sample.test_context.flow -> sample_line.flow
        sample.state -> rule any_fault_else_analyzer
      }
      revision 1
    }
  }
  has {
    serve sample.indication_co via get_indication_co { fresh_within 5s }
    serve sample.state via watch_op_state { fresh_within 1s }
    serve sample.environmental_context via watch_op_state { fresh_within 1s }
  }
}
`;

describe('the composed_of construct (parse + dump fixpoint)', () => {
  it('parses the composition facet: components + decomposition + revision', () => {
    const m = load(PACKAGE);
    const subject = m.subjects.find(s => s.id === 'CGMSystem')!;
    const composed = subject.is.composedOf!;
    assert.ok(composed, 'the composition facet parses');
    assert.deepEqual(
      composed.components.map(c => [
        c.id,
        c.product,
        c.endpoint,
        c.serial,
        c.certificate,
      ]),
      [
        ['analyzer', 'acme-cgm-200@2026', 'cgm_api', 'CGM200-DEMO-0001', null],
        [
          'sample_line',
          'acme-cgm-system/sample-line@2026',
          'sample_line_api',
          'CGM200-SL-0001',
          'TC-2026-0001',
        ],
      ],
    );
    assert.deepEqual(composed.decomposition, [
      {
        register: 'sample.indication_co',
        component: 'analyzer',
        componentRegister: 'indication_co',
      },
      {
        register: 'sample.environmental_context',
        component: 'analyzer',
        componentRegister: 'environmental_context',
      },
      {
        register: 'sample.test_context.flow',
        component: 'sample_line',
        componentRegister: 'flow',
      },
      {
        register: 'sample.state',
        component: 'composite',
        rule: 'any_fault_else_analyzer',
      },
    ]);
    assert.equal(composed.revision, 1);
  });

  it('the dump fixpoint: load(dump(load)) ≡ load', () => {
    const first = load(PACKAGE);
    const second = load(dump(first));
    assert.deepEqual(
      second.subjects.find(s => s.id === 'CGMSystem')!.is.composedOf,
      first.subjects.find(s => s.id === 'CGMSystem')!.is.composedOf,
    );
  });
});

describe('the composition lint rules (C100–C102)', () => {
  it('C100: an inline product reference naming no subject of the package is an error', () => {
    const bad = PACKAGE.replace(
      'product acme-cgm-system/sample-line@2026',
      'product acme-cgm-system/no-such-subject@2026',
    );
    const issues = checkString(bad);
    assert.ok(
      issues.some(
        i => i.check === 'C100' && i.message.includes('no-such-subject'),
      ),
      JSON.stringify(issues.filter(i => i.check === 'C100')),
    );
  });

  it('C100: a decomposition entry naming an undeclared component is an error', () => {
    const bad = PACKAGE.replace(
      'sample.test_context.flow -> sample_line.flow',
      'sample.test_context.flow -> phantom.flow',
    );
    const issues = checkString(bad);
    assert.ok(
      issues.some(i => i.check === 'C100' && i.message.includes('phantom')),
    );
  });

  it('C101: a serve left uncovered by the decomposition is an error', () => {
    const bad = PACKAGE.replace(
      '        sample.environmental_context -> analyzer.environmental_context\n',
      '',
    );
    const issues = checkString(bad);
    assert.ok(
      issues.some(
        i =>
          i.check === 'C101' &&
          i.message.includes('sample.environmental_context'),
      ),
      JSON.stringify(issues.filter(i => i.check === 'C101')),
    );
  });

  it('C102: an unknown composite state rule is an error (the vocabulary is closed)', () => {
    const bad = PACKAGE.replace(
      'rule any_fault_else_analyzer',
      'rule majority_vote',
    );
    const issues = checkString(bad);
    assert.ok(
      issues.some(
        i => i.check === 'C102' && i.message.includes('majority_vote'),
      ),
    );
  });

  it('the well-formed composition lints clean (C100–C102 silent)', () => {
    const issues = checkString(PACKAGE);
    assert.deepEqual(
      issues.filter(i => ['C100', 'C101', 'C102'].includes(i.check)),
      [],
    );
  });
});

describe('the REAL acme-cgm-system package (the migration)', () => {
  const PKG = join(SMART_REPO, 'primmel-packages', 'acme-cgm-system');
  // The sibling smart checkout is a dev-machine layout, not a CI
  // guarantee — absent ⇒ the legs skip honestly (never a silent pass
  // claim, the suite log names the skip).
  const HAS_PKG = existsSync(PKG);

  it(
    'parses the composed_of facet with zero parse issues',
    { skip: !HAS_PKG },
    () => {
      const { standard, issues } = loadPackageWithIssues(PKG);
      assert.deepEqual(
        issues.filter(i => i.severity === 'error'),
        [],
      );
      const composed = standard.subjects.find(s => s.id === 'CGMSystem')!.is
        .composedOf!;
      assert.ok(composed);
      assert.equal(composed.components.length, 2);
      assert.equal(composed.decomposition.length, 5);
      assert.equal(composed.revision, 1);
    },
  );

  it(
    'lints clean under primmel check (C100–C102 silent on the real package)',
    { skip: !HAS_PKG },
    () => {
      const issues = checkPackage(PKG).filter(i => i.severity === 'error');
      assert.deepEqual(
        issues.filter(i => ['C100', 'C101', 'C102'].includes(i.check)),
        [],
        JSON.stringify(issues, null, 1),
      );
    },
  );

  it(
    'the dump fixpoint holds with the construct in the tree',
    { skip: !HAS_PKG },
    () => {
      const first = loadPackageWithIssues(PKG).standard;
      const second = load(dump(first));
      assert.deepEqual(
        second.subjects.find(s => s.id === 'CGMSystem')!.is.composedOf,
        first.subjects.find(s => s.id === 'CGMSystem')!.is.composedOf,
      );
    },
  );
});
