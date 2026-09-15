// ─────────────────────────────────────────────────────────────────────
// Certification-framework model (smart TODO.roadmap/40; the packages-as-
// SSOT epic) — the `participant_kind` and `governance_organ` register
// constructs (B 18:2025 clause 5 + clauses 8–13).
//
// Fixtures:
//   PARTICIPANTS — the two conformity-assessment kinds (the IA with its
//                  competence delegation + approval facet; the TL with its
//                  three subkinds incl. the MTL data-flag/acceptance
//                  facets) + one acceptance participant (the Utilizer).
//   ORGANS       — the MC, its RC sub-committee, and the independent BoA.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

const PARTICIPANTS = `
participant_kind issuing_authority {
  label "OIML Issuing Authority"
  term "3.28"
  clause "5.2"
  definition "Certification body or inspection body from an OIML Member State approved by the Management Committee to issue OIML certificates and associated OIML type evaluation reports in accordance with Scheme A or Scheme B."
  member member_state
  competence {
    delegates_to iso-iec-17065
    clause "5.2"
    note "Compliance with ISO/IEC 17065 (B 18:2025, §5.2) — the competence model itself lives in the iso-iec-17065 package."
  }
  approval {
    decided_by management_committee
    on_recommendation_of review_committee
    procedure "PD-03"
    clause "11.5 f)"
  }
  declaration issuing_authority_declaration
  source { doc "urn:oiml:pub:b:18:2025" clause "5.2" }
}
participant_kind test_laboratory {
  label "Test Laboratory"
  term "3.40"
  clause "5.3"
  definition "Laboratory that performs some or all of the tests of an OIML type evaluation, designated by an OIML Issuing Authority and approved by the Management Committee."
  competence {
    delegates_to iso-iec-17025
    clause "5.3"
  }
  approval {
    decided_by management_committee
    on_recommendation_of review_committee
    procedure "PD-04"
    clause "11.5 f)"
  }
  designated_by issuing_authority
  subkind internal {
    label "Internal Test Laboratory"
    term "3.15"
    definition "Test Laboratory that is part of the same organization as the OIML Issuing Authority."
  }
  subkind manufacturer {
    label "Manufacturer's Test Laboratory (MTL)"
    term "3.21"
    definition "Test Laboratory that is part of the manufacturer's organization, testing for its parent company under controlled supervision (PD-04, 7.1)."
    data_flag "Test data originating from a Manufacturer's Test Laboratory shall be flagged as such on the OIML type evaluation report (PD-05)."
    acceptance voluntary
    acceptance_note "Acceptance of certificates/reports issued on the basis of MTL test reports is voluntary (B 18:2025, §5.6.3; PD-06)."
  }
  source { doc "urn:oiml:pub:b:18:2025" clause "5.3" }
}
participant_kind utilizer {
  label "Utilizer"
  term "3.45"
  clause "5.6.1"
  definition "National issuing authority or national responsible body from an OIML Member State that signs a Declaration indicating its scope of acceptance of OIML certificates and/or OIML type evaluation reports."
  member member_state
  declaration utilizer_declaration
  admission "PD-09"
  source { doc "urn:oiml:pub:b:18:2025" clause "5.6.1" }
}
`;

const ORGANS = `
governance_organ management_committee {
  label "Management Committee (MC)"
  term "3.22"
  clause "11"
  mandate "The MC manages the OIML-CS: it decides on the participation of Issuing Authorities, Test Laboratories, Utilizers and Associates, and on the transition of categories between Schemes."
  source { doc "urn:oiml:pub:b:18:2025" clause "11" }
}
governance_organ review_committee {
  label "Review Committee (RC)"
  term "3.35"
  clause "12"
  mandate "The RC reviews applications and recommends participation decisions to the MC."
  sub_committee_of management_committee
  source { doc "urn:oiml:pub:b:18:2025" clause "12" }
}
governance_organ board_of_appeal {
  label "Board of Appeal (BoA)"
  clause "14"
  mandate "The BoA rules on appeals against MC decisions."
  independent_of management_committee
  source { doc "urn:oiml:pub:b:18:2025" clause "14" }
}
`;

describe('participant_kind construct (smart TODO.roadmap/40)', () => {
  it('parses the flat facets, the competence/approval blocks, and the subkinds', () => {
    const m = load(PARTICIPANTS);
    assert.equal(m.participantKinds.length, 3);
    const ia = m.participantKinds.find(k => k.id === 'issuing_authority')!;
    assert.equal(ia.label, 'OIML Issuing Authority');
    assert.equal(ia.term, '3.28');
    assert.equal(ia.clause, '5.2');
    assert.ok(
      ia.definition.startsWith('Certification body or inspection body'),
    );
    assert.equal(ia.member, 'member_state');
    assert.equal(ia.competence?.delegates_to, 'iso-iec-17065');
    assert.equal(ia.competence?.clause, '5.2');
    assert.ok(ia.competence?.note.includes('iso-iec-17065 package'));
    assert.equal(ia.approval?.decided_by, 'management_committee');
    assert.equal(ia.approval?.on_recommendation_of, 'review_committee');
    assert.equal(ia.approval?.procedure, 'PD-03');
    assert.equal(ia.approval?.clause, '11.5 f)');
    assert.equal(ia.declaration, 'issuing_authority_declaration');
    assert.equal(ia.source.doc, 'urn:oiml:pub:b:18:2025');
    assert.equal(ia.source.clause, '5.2');

    const tl = m.participantKinds.find(k => k.id === 'test_laboratory')!;
    assert.equal(tl.designated_by, 'issuing_authority');
    assert.equal(tl.competence?.delegates_to, 'iso-iec-17025');
    assert.equal(tl.competence?.note, '');
    assert.equal(tl.subkinds.length, 2);
    const mtl = tl.subkinds.find(s => s.id === 'manufacturer')!;
    assert.equal(mtl.label, "Manufacturer's Test Laboratory (MTL)");
    assert.equal(mtl.term, '3.21');
    assert.ok(mtl.data_flag.includes('flagged as such'));
    assert.equal(mtl.acceptance, 'voluntary');
    assert.ok(mtl.acceptance_note.includes('voluntary'));
    const internal = tl.subkinds.find(s => s.id === 'internal')!;
    assert.equal(internal.acceptance, '');

    const ut = m.participantKinds.find(k => k.id === 'utilizer')!;
    assert.equal(ut.admission, 'PD-09');
    assert.equal(ut.competence, null);
    assert.equal(ut.approval, null);
    assert.deepEqual(ut.subkinds, []);
  });

  it('round-trips the register losslessly (fixpoint)', () => {
    const m1 = load(PARTICIPANTS);
    const dumped = dump(m1);
    assert.ok(dumped.includes('participant_kind test_laboratory {'));
    assert.ok(dumped.includes('subkind manufacturer {'));
    assert.ok(dumped.includes('delegates_to iso-iec-17025'));
    const m2 = load(dumped);
    assert.deepEqual(m2.participantKinds, m1.participantKinds);
    assert.equal(dump(m2), dumped);
  });

  it('skips unknown facets for forward compatibility', () => {
    const m = load(`
participant_kind future_kind {
  label "Future"
  future_facet { anything at all }
  clause "9.9"
}
`);
    const k = m.participantKinds.find(x => x.id === 'future_kind')!;
    assert.equal(k.label, 'Future');
    assert.equal(k.clause, '9.9');
  });
});

describe('governance_organ construct (smart TODO.roadmap/40)', () => {
  it('parses the mandate and the sub-committee/independence edges', () => {
    const m = load(ORGANS);
    assert.equal(m.governanceOrgans.length, 3);
    const mc = m.governanceOrgans.find(o => o.id === 'management_committee')!;
    assert.equal(mc.label, 'Management Committee (MC)');
    assert.equal(mc.term, '3.22');
    assert.ok(mc.mandate.includes('manages the OIML-CS'));
    assert.equal(mc.sub_committee_of, '');
    assert.equal(mc.independent_of, '');
    const rc = m.governanceOrgans.find(o => o.id === 'review_committee')!;
    assert.equal(rc.sub_committee_of, 'management_committee');
    const boa = m.governanceOrgans.find(o => o.id === 'board_of_appeal')!;
    assert.equal(boa.independent_of, 'management_committee');
    assert.equal(boa.source.clause, '14');
  });

  it('round-trips the organs losslessly (fixpoint)', () => {
    const m1 = load(ORGANS);
    const dumped = dump(m1);
    assert.ok(dumped.includes('governance_organ board_of_appeal {'));
    assert.ok(dumped.includes('independent_of management_committee'));
    const m2 = load(dumped);
    assert.deepEqual(m2.governanceOrgans, m1.governanceOrgans);
    assert.equal(dump(m2), dumped);
  });
});
