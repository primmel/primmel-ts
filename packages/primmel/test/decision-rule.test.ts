// ─────────────────────────────────────────────────────────────────────
// The `decision_rule` construct (smart TODO.roadmap/40; the packages-
// as-SSOT epic) — B 18:2025 clauses 9–16.
//
// Fixtures:
//   PARTICIPATION — the MC's participation decisions with the full
//                   voting block (80 % rule, other-proposals fallback,
//                   proxies/abstentions/reason facets).
//   FAMILIES      — the advisory (TLF tasks), appeal (BoA scope),
//                   registration (BIML principle), legacy (legacy_kind
//                   blocks) and financing (income + exemptions) rules.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

const PARTICIPATION = `
decision_rule ia-tl-participation-decisions {
  organ management_committee
  kind participation
  clause "11.4.2"
  description "The Management Committee decides the participation of OIML Issuing Authorities and Test Laboratories — approval, re-approval and suspension (§11.5 f) — on a recommendation of the Review Committee (§11.6.2), by the qualified 80 % majority of §11.4.2/§11.4.3."
  on_recommendation_of review_committee
  decides { ia_approval ia_reapproval ia_suspension tl_approval tl_reapproval tl_suspension }
  voting {
    in_meeting {
      threshold 0.8
      base mc_members_from_member_states
      clause "11.4.2"
      description "Approval, re-approval or suspension of an OIML Issuing Authority or a Test Laboratory requires the support of at least 80 % of the Management Committee Members from OIML Member States (§11.4.2)."
    }
    by_correspondence {
      threshold 0.8
      base mc_members_from_member_states
      clause "11.4.3"
    }
    other_proposals {
      in_meeting 0.5
      by_correspondence two_thirds_of_votes_cast
      description "All other proposals require at least half of the MC Members from OIML Member States in a meeting (§11.4.2), or two-thirds of the votes cast by correspondence (§11.4.3)."
    }
    proxies_max 2
    abstentions not_voting
    reason_on_against_or_abstain true
  }
  source { doc "urn:oiml:pub:b:18:2025" clause "11.4" }
}
`;

const FAMILIES = `
decision_rule tlf-advisory-tasks {
  organ test_laboratories_forum
  kind advisory
  clause "12.2"
  description "The Test Laboratories Forum is the scheme's consensus platform of the Test Laboratories: it handles practical and technical questions on the test specifications (12.2 a) and works towards the development of inter-laboratory comparison programs (12.2 d)."
  tasks { practical_testing_questions reproducibility_of_results interlaboratory_comparisons }
  source { doc "urn:oiml:pub:b:18:2025" clause "12.2" }
}
decision_rule boa-appeal-rulings {
  organ board_of_appeal
  kind appeal_ruling
  clause "13.2"
  independent_of management_committee
  scope { participation_decisions expert_decisions }
  description "The Board of Appeal manages appeals against decisions of the Management Committee relating to participation in the OIML-CS (13.2 a); its rulings bind the contested MC decision (PD-01)."
  source { doc "urn:oiml:pub:b:18:2025" clause "13.2" }
}
decision_rule biml-certificate-registration {
  organ biml
  kind registration
  clause "15.8"
  principle registered_copy_validity
  description "The BIML registers and publishes OIML certificates (10.1); the validity of any OIML certificate can be verified with the copy registered and published on the OIML-CS pages of the OIML website by the BIML (§15.8)."
  source { doc "urn:oiml:pub:b:18:2025" clause "15.8" }
}
decision_rule legacy-certificate-validity {
  organ biml
  kind legacy_validity
  clause "15.10"
  description "Certificates issued under the legacy OIML certificate systems remain valid under the OIML-CS (§15.10/§15.11)."
  legacy_kind maa {
    clause "15.10"
    description "OIML MAA certificates are considered to remain valid; Utilizers and Associates may establish conditions for their acceptance, detailed in their Declarations (§15.10)."
  }
  legacy_kind basic {
    clause "15.11"
    description "OIML Basic certificates are considered to remain valid; their acceptance by Utilizers, Associates and users is voluntary (§15.11)."
  }
  source { doc "urn:oiml:pub:b:18:2025" clause "15.10" }
}
decision_rule scheme-financing {
  organ biml
  kind financing
  clause "16.3"
  income certificate_registration_fees
  no_entrance_fees_for { issuing_authority test_laboratory utilizer associate }
  description "The income of the OIML-CS consists of the fees from the registration of OIML certificates; no entrance fees are charged to OIML Issuing Authorities, Test Laboratories, Utilizers or Associates (§16.3)."
  source { doc "urn:oiml:pub:b:18:2025" clause "16.3" }
}
`;

describe('decision_rule construct (smart TODO.roadmap/40)', () => {
  it('parses the participation rule with the full voting block', () => {
    const m = load(PARTICIPATION);
    assert.equal(m.decisionRules.length, 1);
    const r = m.decisionRules[0]!;
    assert.equal(r.id, 'ia-tl-participation-decisions');
    assert.equal(r.organ, 'management_committee');
    assert.equal(r.kind, 'participation');
    assert.equal(r.on_recommendation_of, 'review_committee');
    assert.deepEqual(r.decides, [
      'ia_approval',
      'ia_reapproval',
      'ia_suspension',
      'tl_approval',
      'tl_reapproval',
      'tl_suspension',
    ]);
    assert.equal(r.voting?.in_meeting?.threshold, 0.8);
    assert.equal(r.voting?.in_meeting?.base, 'mc_members_from_member_states');
    assert.ok(r.voting?.in_meeting?.description.includes('80 %'));
    assert.equal(r.voting?.by_correspondence?.threshold, 0.8);
    assert.equal(r.voting?.by_correspondence?.description, '');
    assert.equal(r.voting?.other_proposals?.in_meeting, 0.5);
    assert.equal(
      r.voting?.other_proposals?.by_correspondence,
      'two_thirds_of_votes_cast',
    );
    assert.equal(r.voting?.proxies_max, 2);
    assert.equal(r.voting?.abstentions, 'not_voting');
    assert.equal(r.voting?.reason_on_against_or_abstain, true);
    assert.equal(r.source.clause, '11.4');
  });

  it('parses the advisory / appeal / registration / legacy / financing families', () => {
    const m = load(FAMILIES);
    assert.equal(m.decisionRules.length, 5);
    const tlf = m.decisionRules.find(r => r.id === 'tlf-advisory-tasks')!;
    assert.equal(tlf.kind, 'advisory');
    assert.deepEqual(tlf.tasks, [
      'practical_testing_questions',
      'reproducibility_of_results',
      'interlaboratory_comparisons',
    ]);
    assert.equal(tlf.voting, null);
    const boa = m.decisionRules.find(r => r.id === 'boa-appeal-rulings')!;
    assert.equal(boa.independent_of, 'management_committee');
    assert.deepEqual(boa.scope, [
      'participation_decisions',
      'expert_decisions',
    ]);
    const reg = m.decisionRules.find(
      r => r.id === 'biml-certificate-registration',
    )!;
    assert.equal(reg.principle, 'registered_copy_validity');
    const legacy = m.decisionRules.find(
      r => r.id === 'legacy-certificate-validity',
    )!;
    assert.equal(legacy.legacy_kinds.length, 2);
    const maa = legacy.legacy_kinds.find(k => k.id === 'maa')!;
    assert.equal(maa.clause, '15.10');
    assert.ok(maa.description.includes('remain valid'));
    const fin = m.decisionRules.find(r => r.id === 'scheme-financing')!;
    assert.equal(fin.income, 'certificate_registration_fees');
    assert.deepEqual(fin.no_entrance_fees_for, [
      'issuing_authority',
      'test_laboratory',
      'utilizer',
      'associate',
    ]);
  });

  it('round-trips both fixtures losslessly (fixpoint)', () => {
    const m1 = load(PARTICIPATION + FAMILIES);
    const dumped = dump(m1);
    assert.ok(dumped.includes('decision_rule ia-tl-participation-decisions {'));
    assert.ok(dumped.includes('threshold 0.8'));
    assert.ok(dumped.includes('legacy_kind basic {'));
    assert.ok(
      dumped.includes(
        'no_entrance_fees_for { issuing_authority test_laboratory utilizer associate }',
      ),
    );
    const m2 = load(dumped);
    assert.deepEqual(m2.decisionRules, m1.decisionRules);
    assert.equal(dump(m2), dumped);
  });
});
