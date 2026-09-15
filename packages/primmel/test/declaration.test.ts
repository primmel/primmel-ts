// ─────────────────────────────────────────────────────────────────────
// The Declaration constructs (smart TODO.roadmap/40; the packages-as-
// SSOT epic) — declaration_kind / declaration_status / declaration_gate
// (B 18:2025 §5.5–5.6; PD-08).
//
// Fixtures:
//   KINDS    — the IA Declaration (obligation, no content slots) and the
//              Utilizer Declaration (four acceptance content slots).
//   STATUSES — the four Declaration lifecycle states.
//   GATE     — the PD-08 cl. 5 signing-gate invariant.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

const KINDS = `
declaration_kind issuing_authority_declaration {
  label "OIML Issuing Authority Declaration"
  holder issuing_authority
  clause "5.5.1"
  procedure "PD-08"
  definition "Declaration signed by an OIML Issuing Authority accepted for participation in the OIML-CS, indicating its scope for issuing OIML certificates and OIML type evaluation reports under Scheme A and/or Scheme B (§5.5.1)."
  scope_model categories_x_schemes
  scheme_a_obligation "When an OIML Issuing Authority is accepted under Scheme A, the OIML Member State shall designate at least one Utilizer for each instrument category concerned, unless the category is not regulated in that Member State (§5.5.1; PD-08 cl. 4 Note 2)."
  source { doc "urn:oiml:pub:b:18:2025" clause "5.5.1" }
}
declaration_kind utilizer_declaration {
  label "Utilizer Declaration"
  holder utilizer
  clause "5.6.1"
  procedure "PD-08"
  definition "Declaration signed by a Utilizer indicating its scope of acceptance of OIML certificates and/or OIML type evaluation reports issued under Scheme A and/or Scheme B (§5.6.1)."
  scope_model categories_x_schemes
  content additional_national_requirements {
    clause "5.6.1"
    description "Additional national requirements (3.2) deviating from the Recommendation — the Utilizer may specify them (PD-09, 4.1)."
  }
  content mtl_acceptance_policy {
    clause "5.6.3"
    description "Whether the Utilizer accepts OIML certificates and/or type evaluation reports issued on the basis of test reports from a Manufacturer's Test Laboratory (§5.6.3) — acceptance is voluntary and requires no justification (PD-08 cl. 6)."
  }
  source { doc "urn:oiml:pub:b:18:2025" clause "5.6.1" }
}
`;

const STATUSES = `
declaration_status draft {
  description "Initiated, not yet signed by the participant."
}
declaration_status signed {
  description "Signed by the participant and recorded by the Executive Secretary — the only status that discharges the signing gate."
}
declaration_status suspended {
  description "The participant is suspended by the Management Committee (§11.4) — no new applications (PD-03 cl. 8)."
}
declaration_status withdrawn {
  description "Participation withdrawn; the Declaration no longer grounds issuance or acceptance."
}
`;

const GATE = `
declaration_gate declaration-signed-before-issuance {
  clause "PD-08 cl. 5"
  statement "An OIML Issuing Authority shall not issue any OIML certificate or OIML type evaluation report before its Declaration covering the instrument category and Scheme is signed (PD-08 clause 5; B 18:2025 §5.5.1)."
  holder issuing_authority
  declaration issuing_authority_declaration
  blocks { issue evaluation }
  blocks_note "The gated abstract processes of the scheme process model: issue (certificate issuance) and evaluation (the OIML type evaluation report)."
  scope_checked { category scheme }
  source { doc "urn:oiml:pub:b:18:2025" clause "5.5.1" }
}
`;

describe('declaration_kind construct (smart TODO.roadmap/40)', () => {
  it('parses the facets, the obligation, and the content slots', () => {
    const m = load(KINDS);
    assert.equal(m.declarationKinds.length, 2);
    const ia = m.declarationKinds.find(
      k => k.id === 'issuing_authority_declaration',
    )!;
    assert.equal(ia.holder, 'issuing_authority');
    assert.equal(ia.procedure, 'PD-08');
    assert.equal(ia.scope_model, 'categories_x_schemes');
    assert.ok(
      ia.scheme_a_obligation.includes('designate at least one Utilizer'),
    );
    assert.deepEqual(ia.content, []);
    assert.equal(ia.source.doc, 'urn:oiml:pub:b:18:2025');

    const ut = m.declarationKinds.find(k => k.id === 'utilizer_declaration')!;
    assert.equal(ut.scheme_a_obligation, '');
    assert.equal(ut.content.length, 2);
    const mtl = ut.content.find(s => s.id === 'mtl_acceptance_policy')!;
    assert.equal(mtl.clause, '5.6.3');
    assert.ok(mtl.description.includes("Manufacturer's Test Laboratory"));
  });

  it('round-trips losslessly (fixpoint)', () => {
    const m1 = load(KINDS);
    const dumped = dump(m1);
    assert.ok(dumped.includes('declaration_kind utilizer_declaration {'));
    assert.ok(dumped.includes('content mtl_acceptance_policy {'));
    const m2 = load(dumped);
    assert.deepEqual(m2.declarationKinds, m1.declarationKinds);
    assert.equal(dump(m2), dumped);
  });
});

describe('declaration_status construct (smart TODO.roadmap/40)', () => {
  it('parses the four lifecycle states and round-trips (fixpoint)', () => {
    const m1 = load(STATUSES);
    assert.equal(m1.declarationStatuses.length, 4);
    const signed = m1.declarationStatuses.find(s => s.id === 'signed')!;
    assert.ok(signed.description.includes('discharges the signing gate'));
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.declarationStatuses, m1.declarationStatuses);
    assert.equal(dump(m2), dumped);
  });
});

describe('declaration_gate construct (smart TODO.roadmap/40)', () => {
  it('parses the signing-gate invariant with its blocks and scope facets', () => {
    const m = load(GATE);
    assert.equal(m.declarationGates.length, 1);
    const gate = m.declarationGates[0]!;
    assert.equal(gate.id, 'declaration-signed-before-issuance');
    assert.equal(gate.clause, 'PD-08 cl. 5');
    assert.ok(gate.statement.includes('shall not issue'));
    assert.equal(gate.holder, 'issuing_authority');
    assert.equal(gate.declaration, 'issuing_authority_declaration');
    assert.deepEqual(gate.blocks, ['issue', 'evaluation']);
    assert.ok(gate.blocks_note.includes('gated abstract processes'));
    assert.deepEqual(gate.scope_checked, ['category', 'scheme']);
    assert.equal(gate.source.clause, '5.5.1');
  });

  it('round-trips losslessly (fixpoint)', () => {
    const m1 = load(GATE);
    const dumped = dump(m1);
    assert.ok(
      dumped.includes('declaration_gate declaration-signed-before-issuance {'),
    );
    assert.ok(dumped.includes('blocks { issue evaluation }'));
    const m2 = load(dumped);
    assert.deepEqual(m2.declarationGates, m1.declarationGates);
    assert.equal(dump(m2), dumped);
  });
});
