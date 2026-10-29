// ─────────────────────────────────────────────────────────────────────
// The framework-document constructs (smart TODO.roadmap/40; the
// packages-as-SSOT epic) — framework_document / document_precedence /
// auto_inclusion (B 18:2025 clause 6 + §4.2).
//
// Fixtures:
//   HIERARCHY  — two ranks of the clause-6 hierarchy (B 18 approved by
//                the CIML; CID-01 with its non-supersession note).
//   PRECEDENCE — the higher-position-prevails rule.
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
  ref derives-from "urn:oiml:pub:b:18:2025#clause-6"
}
framework_document cid-01 {
  rank 2
  doc "OIML-CS CID-01"
  title "Clarification and Interpretation Document"
  approved_by management_committee
  clause "6 b)"
  note "Clarifications and interpretations of OIML-CS documents intended as guidance and additional information; they do not supersede the text of the current editions (CID-01, clause 2)."
  ref derives-from "urn:oiml:pub:b:18:2025#clause-6"
}
`;

const PRECEDENCE = `
document_precedence higher_position_prevails {
  clause "6"
  statement { In the event of a conflict, contradiction or inconsistency between the provisions of one of the governing documents and the provisions of another, the provisions of the document listed in a higher position take precedence over the provisions of the document listed in a lower position (clause 6). }
  ref derives-from "urn:oiml:pub:b:18:2025#clause-6"
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
