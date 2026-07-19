import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

// Shared source_discrepancy block (rc.yaml $defs/source_discrepancy,
// TODO.refactor/11): one annotation shape attachable to requirements,
// requirement limits, limit accepts blocks, conformance tests, form
// fields, field evaluation rules, tables, table profiles, and notes.

const SD = `source_discrepancy {
    summary "R 60-3 form criterion contradicts the R 60-1 requirement text"
    sources { "urn:oiml:pub:r:60-1:2021#clause-5.6.3.1" "urn:oiml:pub:r:60-3:2021#clause-2.1.7" }
    resolution follows_clause_x
    rationale "The model follows R 60-1, 5.6.3.1 because the form criterion was copied from the 2000 edition."
  }`;

function assertSd(sd: any) {
  assert.ok(sd);
  assert.equal(
    sd.summary,
    'R 60-3 form criterion contradicts the R 60-1 requirement text',
  );
  assert.deepEqual(sd.sources, [
    'urn:oiml:pub:r:60-1:2021#clause-5.6.3.1',
    'urn:oiml:pub:r:60-3:2021#clause-2.1.7',
  ]);
  assert.equal(sd.resolution, 'follows_clause_x');
  assert.match(sd.rationale, /R 60-1, 5\.6\.3\.1/);
}

const SRC = `requirement /req/metrological/mpe {
  name "Maximum permissible error"
  statement "The error shall not exceed the MPE."
  limit {
    expression "ocl{abs(e_l) <= mpe}"
    uses { e_l mpe }
    accepts {
      verdict mdlo_normalized
      op lte
      limit "ocl{p_lc}"
      ${SD}
    }
    ${SD}
  }
  ${SD}
}

conformance_test CreepTest {
  name "Creep test"
  type Testing
  ${SD}
}

form F1 {
  name "Test form"
  field e_l : number {
    label "Load cell error"
    evaluation {
      verdict drift_error
      op lte
      limit "ocl{max(2, 0.05 * abs(cgm_certified_value))}"
      ${SD}
    }
    ${SD}
  }
}

table mpe_tiers {
  title "MPE tiers"
  columns "a, b"
  ${SD}
  profiles {
    profile mpe_tiers {
      dimension accuracy_class
      type range
      ${SD}
      binding { A: 5 }
    }
  }
}

note N1 {
  type NOTE
  message "Clause conflict recorded."
  ${SD}
}
`;

describe('source_discrepancy block', () => {
  it('parses on a requirement body, limit, and accepts block', () => {
    const m = load(SRC);
    const r = m.requirements[0];
    assertSd(r.sourceDiscrepancy);
    assertSd(r.limit?.sourceDiscrepancy);
    assertSd(r.limit?.accepts?.sourceDiscrepancy);
    assert.equal(r.limit?.accepts?.verdict, 'mdlo_normalized');
    assert.equal(r.limit?.accepts?.op, 'lte');
    assert.equal(r.limit?.accepts?.limit, 'ocl{p_lc}');
  });

  it('parses on a conformance test body', () => {
    const m = load(SRC);
    assertSd(m.conformanceTests[0].sourceDiscrepancy);
  });

  it('parses on a form field and its evaluation rule', () => {
    const m = load(SRC);
    const f = m.forms[0].fields[0];
    assertSd(f.sourceDiscrepancy);
    assertSd(f.evaluation?.sourceDiscrepancy);
    assert.equal(f.evaluation?.verdict, 'drift_error');
    assert.equal(f.evaluation?.op, 'lte');
  });

  it('parses on a table body and a structured profile', () => {
    const m = load(SRC);
    const t = m.tables[0];
    assertSd(t.sourceDiscrepancy);
    assertSd(t.profileDefs?.[0]?.sourceDiscrepancy);
  });

  it('parses on a note', () => {
    const m = load(SRC);
    assertSd(m.notes[0].sourceDiscrepancy);
  });

  it('rejects an unknown resolution', () => {
    assert.throws(
      () =>
        load(`note N1 {
          type NOTE
          message "x"
          source_discrepancy {
            summary "s"
            sources { "urn:oiml:pub:r:60-1:2021#clause-1" }
            resolution arbitrary_choice
            rationale "r"
          }
        }`),
      /Unknown resolution arbitrary_choice/,
    );
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('source_discrepancy {'));
    assert.ok(dumped.includes('resolution follows_clause_x'));

    const m2 = load(dumped);
    assert.deepEqual(m2.requirements, m1.requirements);
    assert.deepEqual(m2.conformanceTests, m1.conformanceTests);
    assert.deepEqual(m2.forms, m1.forms);
    assert.deepEqual(m2.tables, m1.tables);
    assert.deepEqual(m2.notes, m1.notes);
    assert.equal(dump(m2), dumped);
  });
});
