// ─────────────────────────────────────────────────────────────────────
// The framework-document constructs (smart TODO.roadmap/40; the
// packages-as-SSOT epic) — framework_document / document_precedence /
// auto_inclusion (B 18:2025 clause 6 + §4.2).
//
// Fixtures:
//   HIERARCHY  — two ranks of the clause-6 hierarchy (B 18 approved by
//                the CIML; CID-01 with its non-supersession note).
//   PRECEDENCE — the higher-position-prevails rule.
//   INCLUSION  — the §4.2 auto-inclusion block with its conditions.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

const HIERARCHY = `
framework_document b18 {
  rank 1
  doc "OIML B 18"
  title "Framework for the OIML Certification System (OIML-CS)"
  approved_by ciml
  clause "6 a)"
  source { doc "urn:oiml:pub:b:18:2025" clause "6" }
}
framework_document cid-01 {
  rank 2
  doc "OIML-CS CID-01"
  title "Clarification and Interpretation Document"
  approved_by management_committee
  clause "6 b)"
  note "Clarifications and interpretations of OIML-CS documents intended as guidance and additional information; they do not supersede the text of the current editions (CID-01, clause 2)."
  source { doc "urn:oiml:pub:b:18:2025" clause "6" }
}
`;

const PRECEDENCE = `
document_precedence higher_position_prevails {
  clause "6"
  statement "In the event of a conflict, contradiction or inconsistency between the provisions of one of the governing documents and the provisions of another, the provisions of the document listed in a higher position take precedence over the provisions of the document listed in a lower position (clause 6)."
  source { doc "urn:oiml:pub:b:18:2025" clause "6" }
}
`;

const INCLUSION = `
auto_inclusion auto_inclusion {
  clause "4.2"
  statement "Categories of measuring instruments (including families of instruments, modules, or families of modules) are automatically included in the OIML-CS when the relevant OIML Recommendation specifies all of the following (§4.2); the initial placement is Scheme B (§4.3, §15.1)."
  condition metrological-technical-requirements {
    clause "4.2 a)"
    description "The Recommendation specifies the metrological and technical requirements for the category."
  }
  condition test-procedures {
    clause "4.2 b)"
    description "The Recommendation specifies the test procedures, including (where applicable) the selection of the instrument(s) or module(s) to be tested from the family (§4.4)."
  }
  condition test-report-format {
    clause "4.2 c)"
    description "The Recommendation specifies the OIML test report format."
  }
  condition evaluation-report-format {
    clause "4.2 d)"
    description "The Recommendation specifies the OIML type evaluation report format."
  }
  note "The two report formats (conditions c and d) may be specified in separate Parts of a Recommendation or combined in one Part (§4.2 Note). The BIML maintains the list of the categories in the OIML-CS on the OIML website (§4.5)."
  source { doc "urn:oiml:pub:b:18:2025" clause "4.2" }
}
`;

describe('framework_document construct (smart TODO.roadmap/40)', () => {
  it('parses the hierarchy ranks with their approving organs', () => {
    const m = load(HIERARCHY);
    assert.equal(m.frameworkDocuments.length, 2);
    const b18 = m.frameworkDocuments.find(d => d.id === 'b18')!;
    assert.equal(b18.rank, 1);
    assert.equal(b18.doc, 'OIML B 18');
    assert.equal(
      b18.title,
      'Framework for the OIML Certification System (OIML-CS)',
    );
    assert.equal(b18.approved_by, 'ciml');
    assert.equal(b18.clause, '6 a)');
    assert.equal(b18.note, '');
    const cid = m.frameworkDocuments.find(d => d.id === 'cid-01')!;
    assert.equal(cid.rank, 2);
    assert.ok(cid.note.includes('do not supersede'));
    assert.equal(cid.source.doc, 'urn:oiml:pub:b:18:2025');
  });

  it('round-trips losslessly (fixpoint)', () => {
    const m1 = load(HIERARCHY);
    const dumped = dump(m1);
    assert.ok(dumped.includes('framework_document cid-01 {'));
    assert.ok(dumped.includes('rank 2'));
    const m2 = load(dumped);
    assert.deepEqual(m2.frameworkDocuments, m1.frameworkDocuments);
    assert.equal(dump(m2), dumped);
  });
});

describe('document_precedence construct (smart TODO.roadmap/40)', () => {
  it('parses and round-trips the precedence rule (fixpoint)', () => {
    const m1 = load(PRECEDENCE);
    assert.equal(m1.documentPrecedences.length, 1);
    const rule = m1.documentPrecedences[0]!;
    assert.equal(rule.id, 'higher_position_prevails');
    assert.ok(rule.statement.includes('higher position take precedence'));
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.documentPrecedences, m1.documentPrecedences);
    assert.equal(dump(m2), dumped);
  });
});

describe('auto_inclusion construct (smart TODO.roadmap/40)', () => {
  it('parses the statement and the four conditions', () => {
    const m = load(INCLUSION);
    assert.equal(m.autoInclusions.length, 1);
    const inc = m.autoInclusions[0]!;
    assert.equal(inc.id, 'auto_inclusion');
    assert.equal(inc.clause, '4.2');
    assert.equal(inc.conditions.length, 4);
    const c = inc.conditions.find(x => x.id === 'test-procedures')!;
    assert.equal(c.clause, '4.2 b)');
    assert.ok(c.description.includes('§4.4'));
    assert.ok(inc.note.includes('§4.5'));
  });

  it('round-trips losslessly (fixpoint)', () => {
    const m1 = load(INCLUSION);
    const dumped = dump(m1);
    assert.ok(dumped.includes('auto_inclusion auto_inclusion {'));
    assert.ok(dumped.includes('condition evaluation-report-format {'));
    const m2 = load(dumped);
    assert.deepEqual(m2.autoInclusions, m1.autoInclusions);
    assert.equal(dump(m2), dumped);
  });
});
