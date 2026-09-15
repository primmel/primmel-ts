// ─────────────────────────────────────────────────────────────────────
// C120 framework-references-resolve (smart TODO.roadmap/40; the
// packages-as-SSOT epic) — the certification-framework registers'
// cross-reference resolution, per-register gated (the C58 doctrine).
//
// Fixtures:
//   FRAMEWORK — a small coherent framework: two organs, two participant
//               kinds, one declaration kind + the signing gate, the
//               scheme lifecycle, one hierarchy rank, one decision rule.
//   *_DANGLING — one seeded violation each.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPackage } from '../src/check';

const ORGANS = `
governance_organ management_committee {
  label "Management Committee (MC)"
  clause "11"
  mandate "The MC manages the OIML-CS."
}
governance_organ review_committee {
  label "Review Committee (RC)"
  clause "12"
  mandate "The RC recommends participation decisions."
  sub_committee_of management_committee
}
`;

const KINDS = `
participant_kind issuing_authority {
  label "OIML Issuing Authority"
  clause "5.2"
  definition "Certification body or inspection body approved by the Management Committee to issue OIML certificates."
  approval {
    decided_by management_committee
    on_recommendation_of review_committee
    procedure "PD-03"
    clause "11.5 f)"
  }
  declaration issuing_authority_declaration
}
participant_kind test_laboratory {
  label "Test Laboratory"
  clause "5.3"
  definition "Laboratory performing some or all of the tests of an OIML type evaluation."
  designated_by issuing_authority
}
`;

const DECLARATIONS = `
declaration_kind issuing_authority_declaration {
  label "OIML Issuing Authority Declaration"
  holder issuing_authority
  clause "5.5.1"
  procedure "PD-08"
  definition "Declaration indicating the IA's scope for issuing OIML certificates."
  scope_model categories_x_schemes
}
declaration_gate declaration-signed-before-issuance {
  clause "PD-08 cl. 5"
  statement "An IA shall not issue any OIML certificate before its Declaration is signed."
  holder issuing_authority
  declaration issuing_authority_declaration
  blocks { issue }
  scope_checked { category scheme }
}
process issue {
  name "Certificate issuance"
}
process evaluation {
  name "Type evaluation"
}
`;

const LIFECYCLE = `
auto_inclusion auto_inclusion {
  clause "4.2"
  statement "Categories are automatically included when the Recommendation specifies the following."
  condition requirements {
    clause "4.2 a)"
    description "The Recommendation specifies the requirements."
  }
}
scheme_lifecycle category_scheme {
  applies_to instrument_category
  initial SCHEME_B
  entry {
    action category_included
    automatic true
    clause "15.1"
    conditions_ref auto_inclusion
  }
  transition SCHEME_B -> SCHEME_A action transition_period_elapsed {
    clause "15.2"
  }
  transition SCHEME_B -> SCHEME_A action transition_advanced {
    clause "15.2"
    decided_by management_committee
    on_proposal_of review_committee
  }
  trigger two-year-transition {
    kind timer
    action transition_period_elapsed
    window { years 2 }
    clause "15.2"
  }
}
`;

const DOCUMENTS = `
framework_document b18 {
  rank 1
  doc "OIML B 18"
  title "Framework for the OIML Certification System (OIML-CS)"
  approved_by management_committee
  clause "6 a)"
}
`;

const RULES = `
decision_rule scheme-financing {
  organ management_committee
  kind financing
  clause "16.3"
  income certificate_registration_fees
  no_entrance_fees_for { issuing_authority test_laboratory }
  description "No entrance fees are charged (§16.3)."
}
`;

const FRAMEWORK = ORGANS + KINDS + DECLARATIONS + LIFECYCLE + DOCUMENTS + RULES;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-fw-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

function c119Issues(body: string) {
  return checkPackage(makePackage(body)).filter(i => i.check === 'C120');
}

describe('C120 framework-references-resolve (smart TODO.roadmap/40)', () => {
  it('accepts a coherent framework (all registers in scope)', () => {
    assert.deepEqual(c119Issues(FRAMEWORK), []);
  });

  it('flags a dangling approval organ', () => {
    const issues = c119Issues(
      FRAMEWORK.replace(
        'decided_by management_committee',
        'decided_by steering_committee',
      ),
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.severity, 'error');
    assert.ok(issues[0]!.message.includes('issuing_authority'));
    assert.ok(issues[0]!.message.includes('"steering_committee"'));
  });

  it('flags a dangling declaration edge on a participant kind', () => {
    const issues = c119Issues(
      FRAMEWORK.replace(
        'declaration issuing_authority_declaration',
        'declaration missing_declaration',
      ),
    );
    assert.equal(issues.length, 1);
    assert.ok(issues[0]!.message.includes('"missing_declaration"'));
  });

  it('flags a gate blocking an undeclared process', () => {
    const issues = c119Issues(
      FRAMEWORK.replace('blocks { issue }', 'blocks { issue publish }'),
    );
    assert.equal(issues.length, 1);
    assert.ok(
      issues[0]!.message.includes('declaration-signed-before-issuance'),
    );
    assert.ok(issues[0]!.message.includes('"publish"'));
  });

  it('flags a trigger firing an action no transition declares', () => {
    const issues = c119Issues(
      FRAMEWORK.replace(
        'action transition_period_elapsed\n    window { years 2 }',
        'action window_elapsed\n    window { years 2 }',
      ),
    );
    assert.equal(issues.length, 1);
    assert.ok(issues[0]!.message.includes('two-year-transition'));
    assert.ok(issues[0]!.message.includes('"window_elapsed"'));
  });

  it('flags a dangling organ edge on a scheme transition', () => {
    const issues = c119Issues(
      FRAMEWORK.replace(
        'decided_by management_committee\n    on_proposal_of review_committee',
        'decided_by ciml\n    on_proposal_of review_committee',
      ),
    );
    assert.equal(issues.length, 1);
    assert.ok(issues[0]!.message.includes('transition_advanced'));
    assert.ok(issues[0]!.message.includes('"ciml"'));
  });

  it('flags a dangling conditions_ref and a dangling exemption kind', () => {
    const issues = c119Issues(
      FRAMEWORK.replace(
        'conditions_ref auto_inclusion',
        'conditions_ref missing_block',
      ).replace(
        'no_entrance_fees_for { issuing_authority test_laboratory }',
        'no_entrance_fees_for { issuing_authority expert }',
      ),
    );
    assert.equal(issues.length, 2);
  });

  it('flags a dangling organ on a decision_rule and a dangling approved_by', () => {
    const issues = c119Issues(
      FRAMEWORK.replace(
        'organ management_committee\n  kind financing',
        'organ steering_committee\n  kind financing',
      ).replace(
        'approved_by management_committee',
        'approved_by steering_committee',
      ),
    );
    assert.equal(issues.length, 2);
    assert.ok(issues[0]!.message.includes('b18'));
    assert.ok(issues[0]!.message.includes('"steering_committee"'));
    assert.ok(issues[1]!.message.includes('scheme-financing'));
  });

  it('stays silent for edges whose target register is out of scope', () => {
    // Only participant kinds in scope — the organ and declaration
    // registers are absent, so their edges cannot be adjudicated (the
    // C58 gating doctrine).
    assert.deepEqual(c119Issues(KINDS), []);
  });

  it('stays silent when no framework content is present at all', () => {
    assert.deepEqual(
      c119Issues('process p {\n  name "Plain process"\n}\n'),
      [],
    );
  });
});
