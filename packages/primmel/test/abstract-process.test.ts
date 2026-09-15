// ─────────────────────────────────────────────────────────────────────
// The abstract-process model (smart TODO.roadmap/40 batch 2; the
// packages-as-SSOT epic) — the process construct's framework-binding
// facets (summary, roles/organs/participant_kinds, evidence, decision,
// declaration, discharges_gate, realized_by/approved_by, the calendar
// windows), the untyped signature parameter (bare name = entity-store
// reference), the shared `process_model` construct (sequence +
// registers), and the C121 abstract-process-references-resolve linter
// rule (per-register gated, the C58 doctrine).
//
// Fixtures:
//   FRAMEWORK  — a small framework: an organ, a participant kind, a
//                declaration kind + gate, a decision rule, a role, an
//                approval, and the realizing process.
//   PIPELINE   — two abstract processes carrying every batch-2 facet,
//                plus the process_model binding them into a sequence.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const FRAMEWORK = `
governance_organ management_committee {
  label "Management Committee (MC)"
  clause "11"
  mandate "The MC manages the OIML-CS."
}
participant_kind issuing_authority {
  label "OIML Issuing Authority"
  clause "5.2"
  definition "Certification body approved by the Management Committee to issue OIML certificates."
}
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
  blocks { issue_certificate }
  scope_checked { category scheme }
}
decision_rule mc-participation-decision {
  organ management_committee
  kind participation
  clause "11.5"
  description "The MC decides on applications for participation."
}
role applicant {
  name "Applicant"
}
approval ia_accept_application {
  name "IA acceptance of the application"
  modality scheme
}
`;

const PIPELINE = `
process submit_application {
  name "Submit application (the realizing concrete process)"
}
process issue_certificate {
  name "Certificate issuance"
}
process ia_application {
  name "IA application"
  summary "The manufacturer or its authorized representative applies to an OIML Issuing Authority."
  executor actor
  roles { applicant }
  organs { management_committee }
  participant_kinds { issuing_authority }
  signature {
    in { }
    out { applications }
  }
  evidence {
    application_record { description "The application record as received." required true }
    correspondence_log { description "The correspondence log." }
  }
  invariants { "[application].issuing_authority_id is not null" }
  decision { rule mc-participation-decision clause "PD-03, 5.3.2" }
  declaration { kind issuing_authority_declaration action sign }
  discharges_gate declaration-signed-before-issuance
  realized_by { submit_application }
  approved_by { ia_accept_application }
  windows {
    window lodging_window {
      kind max_elapsed
      clause "PD-01, 8.2/8.3"
      anchor informed_at
      applies_to lodged_at
      window { months 1 }
      breach rule_inadmissible
      description "The written appeal reaches the Executive Secretary within one month."
    }
    window cooling_off {
      kind min_elapsed
      clause "PD-01, 9.1"
      anchor decided_at
      applies_to effective_at
      window { years 1 }
    }
  }
  activity_kind { selection }
  source { doc "urn:oiml:pub:cs:pd-05:2024" clause "4.1" }
}
process ia_assessment {
  name "IA assessment"
  signature {
    in { applications assessors }
    out { assessment_reports }
  }
  realized_by { submit_application }
}
process_model evaluation {
  sequence { ia_application ia_assessment }
  register lme_register {
    label "ILAC-IAF-OIML list of Legal Metrology Experts"
    clause "PD-02, 9"
    maintainer management_committee
    published "The OIML-CS pages of the OIML website."
    entries "Per Legal Metrology Expert: identity, contact, scope."
  }
  source { doc "urn:oiml:pub:cs:pd-05:2024" clause "4" }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-absp-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('abstract-process facets (smart TODO.roadmap/40 batch 2)', () => {
  it('parses every batch-2 facet', () => {
    const m = load(PIPELINE);
    const p = m.processes.find(x => x.id === 'ia_application')!;
    assert.equal(
      p.summary,
      'The manufacturer or its authorized representative applies to an OIML Issuing Authority.',
    );
    assert.deepEqual(p.roles, ['applicant']);
    assert.deepEqual(p.organs, ['management_committee']);
    assert.deepEqual(p.participantKinds, ['issuing_authority']);
    assert.deepEqual(p.evidence, [
      {
        id: 'application_record',
        description: 'The application record as received.',
        required: true,
      },
      {
        id: 'correspondence_log',
        description: 'The correspondence log.',
        required: false,
      },
    ]);
    assert.deepEqual(p.decision, {
      rule: 'mc-participation-decision',
      clause: 'PD-03, 5.3.2',
    });
    assert.deepEqual(p.declaration, {
      kind: 'issuing_authority_declaration',
      action: 'sign',
    });
    assert.equal(p.dischargesGate, 'declaration-signed-before-issuance');
    assert.deepEqual(p.realizedBy, ['submit_application']);
    assert.deepEqual(p.approvedBy, ['ia_accept_application']);
    assert.equal(p.windows.length, 2);
    const w = p.windows[0]!;
    assert.equal(w.id, 'lodging_window');
    assert.equal(w.kind, 'max_elapsed');
    assert.equal(w.clause, 'PD-01, 8.2/8.3');
    assert.equal(w.anchor, 'informed_at');
    assert.equal(w.applies_to, 'lodged_at');
    assert.equal(w.windowYears, 0);
    assert.equal(w.windowMonths, 1);
    assert.equal(w.breach, 'rule_inadmissible');
    assert.ok(w.description.startsWith('The written appeal'));
    assert.equal(p.windows[1]!.kind, 'min_elapsed');
    assert.equal(p.windows[1]!.windowYears, 1);
  });

  it('parses untyped signature parameters (bare name = entity-store reference)', () => {
    const m = load(PIPELINE);
    const p = m.processes.find(x => x.id === 'ia_assessment')!;
    assert.deepEqual(p.signature!.inputs, [
      { name: 'applications', type: '' },
      { name: 'assessors', type: '' },
    ]);
    assert.deepEqual(p.signature!.outputs, [
      { name: 'assessment_reports', type: '' },
    ]);
  });

  it('keeps typed and untyped signature parameters side by side', () => {
    const m = load(`
process mixed {
  name "Mixed signature"
  signature {
    in { applied_load : mass duration : time conditions_log }
    out { indication_series : mass_series }
  }
}
`);
    const p = m.processes[0]!;
    assert.deepEqual(p.signature!.inputs, [
      { name: 'applied_load', type: 'mass' },
      { name: 'duration', type: 'time' },
      { name: 'conditions_log', type: '' },
    ]);
    assert.deepEqual(p.signature!.outputs, [
      { name: 'indication_series', type: 'mass_series' },
    ]);
  });

  it('round-trips the full pipeline losslessly (fixpoint)', () => {
    const m1 = load(FRAMEWORK + PIPELINE);
    const dumped = dump(m1);
    assert.ok(dumped.includes('summary "The manufacturer'));
    assert.ok(dumped.includes('roles { applicant }'));
    assert.ok(dumped.includes('window lodging_window {'));
    assert.ok(dumped.includes('window { months 1 }'));
    assert.ok(dumped.includes('out { applications }'));
    assert.ok(
      dumped.includes(
        'decision { rule mc-participation-decision clause "PD-03, 5.3.2" }',
      ),
    );
    assert.ok(
      dumped.includes(
        'declaration { kind issuing_authority_declaration action sign }',
      ),
    );
    const m2 = load(dumped);
    assert.deepEqual(m2.processes, m1.processes);
    assert.deepEqual(m2.processModels, m1.processModels);
    assert.equal(dump(m2), dumped);
  });
});

describe('process_model construct (smart TODO.roadmap/40 batch 2)', () => {
  it('parses the sequence and the register block', () => {
    const m = load(PIPELINE);
    const pm = m.processModels.find(x => x.id === 'evaluation')!;
    assert.deepEqual(pm.sequence, ['ia_application', 'ia_assessment']);
    assert.equal(pm.registers.length, 1);
    const r = pm.registers[0]!;
    assert.equal(r.id, 'lme_register');
    assert.equal(r.label, 'ILAC-IAF-OIML list of Legal Metrology Experts');
    assert.equal(r.clause, 'PD-02, 9');
    assert.equal(r.maintainer, 'management_committee');
    assert.equal(r.published, 'The OIML-CS pages of the OIML website.');
    assert.equal(
      r.entries,
      'Per Legal Metrology Expert: identity, contact, scope.',
    );
    assert.equal(pm.source.doc, 'urn:oiml:pub:cs:pd-05:2024');
    assert.equal(pm.source.clause, '4');
  });

  it('round-trips the model losslessly (fixpoint)', () => {
    const m1 = load(PIPELINE);
    const dumped = dump(m1);
    assert.ok(dumped.includes('process_model evaluation {'));
    assert.ok(dumped.includes('sequence { ia_application ia_assessment }'));
    assert.ok(dumped.includes('register lme_register {'));
    const m2 = load(dumped);
    assert.deepEqual(m2.processModels, m1.processModels);
    assert.equal(dump(m2), dumped);
  });
});

describe('C121 abstract-process-references-resolve', () => {
  function c121Issues(body: string) {
    return checkPackage(makePackage(body)).filter(i => i.check === 'C121');
  }

  it('accepts a coherent pipeline (all registers in scope)', () => {
    assert.deepEqual(c121Issues(FRAMEWORK + PIPELINE), []);
  });

  it('flags a dangling organ and a dangling participant kind', () => {
    const issues = c121Issues(
      (FRAMEWORK + PIPELINE)
        .replace('organs { management_committee }', 'organs { ciml }')
        .replace(
          'participant_kinds { issuing_authority }',
          'participant_kinds { manufacturer }',
        ),
    );
    assert.equal(issues.length, 2);
    assert.ok(issues[0]!.message.includes('ia_application'));
    assert.ok(issues[0]!.message.includes('"ciml"'));
    assert.ok(issues[1]!.message.includes('"manufacturer"'));
  });

  it('flags a dangling decision rule and a dangling declaration kind', () => {
    const issues = c121Issues(
      (FRAMEWORK + PIPELINE)
        .replace(
          'rule mc-participation-decision clause "PD-03, 5.3.2"',
          'rule rc-vote clause "PD-03, 5.3.2"',
        )
        .replace(
          'declaration { kind issuing_authority_declaration action sign }',
          'declaration { kind tl_declaration action sign }',
        ),
    );
    assert.equal(issues.length, 2);
    assert.ok(issues.some(i => i.message.includes('"rc-vote"')));
    assert.ok(issues.some(i => i.message.includes('"tl_declaration"')));
  });

  it('flags a declaration action outside the sign|update vocabulary', () => {
    const issues = c121Issues(
      (FRAMEWORK + PIPELINE).replace('action sign', 'action revoke'),
    );
    assert.equal(issues.length, 1);
    assert.ok(issues[0]!.message.includes('"revoke"'));
    assert.ok(issues[0]!.message.includes('sign, update'));
  });

  it('flags a dangling discharged gate', () => {
    const issues = c121Issues(
      (FRAMEWORK + PIPELINE).replace(
        'discharges_gate declaration-signed-before-issuance',
        'discharges_gate missing-gate',
      ),
    );
    assert.equal(issues.length, 1);
    assert.ok(issues[0]!.message.includes('"missing-gate"'));
  });

  it('flags a window with a bad kind, and a window with both durations', () => {
    const issues = c121Issues(
      (FRAMEWORK + PIPELINE)
        .replace('kind max_elapsed', 'kind whenever')
        .replace('window { months 1 }', 'window { years 1 months 1 }'),
    );
    assert.equal(issues.length, 2);
    assert.ok(issues[0]!.message.includes('lodging_window'));
    assert.ok(issues[0]!.message.includes('"whenever"'));
    assert.ok(issues[1]!.message.includes('both years and months'));
  });

  it('flags a window with neither duration', () => {
    const issues = c121Issues(
      (FRAMEWORK + PIPELINE).replace('window { months 1 }\n', ''),
    );
    assert.equal(issues.length, 1);
    assert.ok(issues[0]!.message.includes('neither years nor months'));
  });

  it('flags a dangling realized_by and a dangling sequence member', () => {
    const issues = c121Issues(
      (FRAMEWORK + PIPELINE)
        .replace('realized_by { submit_application }', 'realized_by { ghost }')
        .replace(
          'sequence { ia_application ia_assessment }',
          'sequence { ia_application ghost }',
        ),
    );
    assert.equal(issues.length, 2);
    assert.ok(issues.every(i => i.message.includes('"ghost"')));
  });

  it('stays silent for edges whose target register is out of scope', () => {
    // The pipeline alone: no organs/kinds/declarations/roles/decision
    // rules/gates/approvals in scope — only the register-free shape legs
    // (the windows are well-formed) can speak.
    assert.deepEqual(c121Issues(PIPELINE), []);
  });
});
