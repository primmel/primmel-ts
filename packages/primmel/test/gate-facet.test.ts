// ─────────────────────────────────────────────────────────────────────
// The gate facet (TODO.lang-spec/07 — one gated primitive): the
// process's five per-kind gate spellings (`guard "…"`, `preconditions
// { precondition … }`, `windows { window … }`, `discharges_gate <id>`,
// `machine_steps { … }`) became ONE kind-discriminated `gates { … }`
// facet. Each kind keeps its migrated content grammar VERBATIM — the
// SPELLING unified, never the content:
//
//   entry_condition <id>? { check … description … on_violation … }
//   window <id> { kind … clause … anchor … applies_to … window { … }
//                 breach … description … }
//   discharge <gate-id>
//   machine_service { <service-id>+ }
//
// The anonymous entry_condition (no id) is the folded legacy `guard "…"`
// prose criterion — ordered, opaque, never resolved. The retired
// spellings are parse errors naming the gate facet. The declaration_gate
// CONSTRUCT (the framework register) stays: it is the declaration kind's
// gate-side home, the referent of the discharge entries.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const FRAMEWORK = `
process issue_certificate {
  name "Certificate issuance"
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
state_machine CGHMOperationalStates {
  kind operational
  initial off
  states { off warming ready }
}
`;

const GATED = `
process gated {
  name "The gated process"
  phase testing
  gates {
    entry_condition { check "Application.status = SUBMITTED" on_violation invalid }
    entry_condition warmed-up { check "ocl{self.state = #ready}" description "An unwarmed run is invalid, never a fail." on_violation invalid }
    window lodging_window {
      kind max_elapsed
      clause "PD-01, 8.2/8.3"
      anchor informed_at
      applies_to lodged_at
      window { months 1 }
      breach rule_inadmissible
      description "The written appeal reaches the Executive Secretary within one month."
    }
    discharge declaration-signed-before-issuance
    machine_service { verdict_computation evaluation_aggregation }
  }
  state CGHMOperationalStates
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-gate-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'gates.prl'), body);
  return dir;
}

describe('the gate facet — parse (TODO.lang-spec/07)', () => {
  it('parses every kind, entries in declaration order', () => {
    const m = load(GATED);
    const p = m.processes[0]!;
    assert.equal(p.gates.length, 5);
    const [g0, g1, g2, g3, g4] = p.gates;
    assert.deepEqual(g0, {
      kind: 'entry_condition',
      id: '',
      check: 'Application.status = SUBMITTED',
      description: '',
      onViolation: 'invalid',
    });
    assert.deepEqual(g1, {
      kind: 'entry_condition',
      id: 'warmed-up',
      check: 'ocl{self.state = #ready}',
      description: 'An unwarmed run is invalid, never a fail.',
      onViolation: 'invalid',
    });
    assert.deepEqual(g2, {
      kind: 'window',
      id: 'lodging_window',
      windowKind: 'max_elapsed',
      clause: 'PD-01, 8.2/8.3',
      anchor: 'informed_at',
      applies_to: 'lodged_at',
      windowYears: 0,
      windowMonths: 1,
      breach: 'rule_inadmissible',
      description:
        'The written appeal reaches the Executive Secretary within one month.',
    });
    assert.deepEqual(g3, {
      kind: 'discharge',
      gate: 'declaration-signed-before-issuance',
    });
    assert.deepEqual(g4, {
      kind: 'machine_service',
      steps: ['verdict_computation', 'evaluation_aggregation'],
    });
  });

  it('repeatable gates blocks accumulate in declaration order', () => {
    const m = load(`
process p {
  name "Split gates"
  gates { discharge gate-one }
  gates { discharge gate-two }
}
`);
    assert.deepEqual(m.processes[0]!.gates, [
      { kind: 'discharge', gate: 'gate-one' },
      { kind: 'discharge', gate: 'gate-two' },
    ]);
  });

  it('round-trips byte-clean (the codec fixpoint)', () => {
    const out = dump(load(GATED));
    assert.ok(out.includes('  gates {\n'));
    assert.ok(
      out.includes(
        '    entry_condition { check "Application.status = SUBMITTED" on_violation invalid }\n',
      ),
    );
    assert.ok(
      out.includes(
        '    entry_condition warmed-up { check "ocl{self.state = #ready}" description "An unwarmed run is invalid, never a fail." on_violation invalid }\n',
      ),
    );
    assert.ok(out.includes('      window { months 1 }\n'));
    assert.ok(
      out.includes('    discharge declaration-signed-before-issuance\n'),
    );
    assert.ok(
      out.includes(
        '    machine_service { verdict_computation evaluation_aggregation }\n',
      ),
    );
    assert.equal(dump(load(out)), out);
  });

  it('a process without gates carries none (the plain form)', () => {
    const m = load('process p { name "Plain" }');
    assert.deepEqual(m.processes[0]!.gates, []);
    const out = dump(m);
    assert.ok(!out.includes('gates'));
  });
});

describe('the gate facet — the retired spellings are parse errors', () => {
  const cases: Array<[string, string, string]> = [
    [
      'guard "…"',
      'process p {\n  name "P"\n  guard "Application.status = SUBMITTED"\n}',
      'the guard facet is retired',
    ],
    [
      'preconditions { … }',
      'process p {\n  name "P"\n  preconditions {\n    precondition warmed-up { check "ocl{true}" on_violation invalid }\n  }\n}',
      'the preconditions facet is retired',
    ],
    [
      'windows { … }',
      'process p {\n  name "P"\n  windows {\n    window w { kind max_elapsed anchor a applies_to b window { months 1 } }\n  }\n}',
      'the windows facet is retired',
    ],
    [
      'discharges_gate <id>',
      'process p {\n  name "P"\n  discharges_gate g\n}',
      'the discharges_gate facet is retired',
    ],
    [
      'machine_steps { … }',
      'process p {\n  name "P"\n  machine_steps { verdict_computation }\n}',
      'the machine_steps facet is retired',
    ],
  ];
  for (const [name, fixture, message] of cases) {
    it(`retires ${name}, naming the gates facet`, () => {
      assert.throws(
        () => load(fixture),
        (e: Error) => e.message.includes(message),
      );
    });
  }

  it('the conformance_test precondition family is NOT retired', () => {
    const m = load(`conformance_test T {
  name "T"
  preconditions {
    precondition warmed-up { check "ocl{self.state = #ready}" on_violation invalid }
  }
}`);
    assert.equal(m.conformanceTests[0]!.preconditions.length, 1);
  });

  it('a state machine transition guard is NOT a process gate', () => {
    const m = load(`state_machine M {
  kind lifecycle
  initial DRAFT
  states { DRAFT SUBMITTED }
  transition submit {
    from { DRAFT }
    to SUBMITTED
    guard "ocl{self.is_complete}"
  }
}`);
    assert.equal(
      m.stateMachines[0]!.transitions[0]!.guard,
      'ocl{self.is_complete}',
    );
  });
});

describe('the gate facet — the checker legs keep their rule ids', () => {
  it('C121 flags a discharge naming no declared declaration gate', () => {
    const issues = checkPackage(makePackage(FRAMEWORK + GATED))
      .filter(i => i.check === 'C121')
      .filter(i => i.message.includes('discharge'));
    assert.equal(issues.length, 0);
    const issues2 = checkPackage(
      makePackage(
        FRAMEWORK +
          GATED.replace(
            'discharge declaration-signed-before-issuance',
            'discharge missing-gate',
          ),
      ),
    )
      .filter(i => i.check === 'C121')
      .filter(i => i.message.includes('discharge'));
    assert.equal(issues2.length, 1);
    assert.ok(issues2[0]!.message.includes('"missing-gate"'));
    assert.ok(
      issues2[0]!.message.includes('abstract-process-references-resolve'),
    );
  });

  it('C121 flags a window outside the kind vocabulary, and a both-durations window', () => {
    const bad = checkPackage(
      makePackage(
        FRAMEWORK +
          GATED.replace('kind max_elapsed', 'kind whenever').replace(
            'window { months 1 }',
            'window { years 1 months 1 }',
          ),
      ),
    ).filter(i => i.check === 'C121');
    assert.equal(bad.length, 2);
    assert.ok(bad[0]!.message.includes('lodging_window'));
    assert.ok(bad[0]!.message.includes('"whenever"'));
    assert.ok(bad[1]!.message.includes('both years and months'));
  });

  it('C39 flags an entry condition gating on an undeclared state', () => {
    const issues = checkPackage(
      makePackage(
        FRAMEWORK +
          GATED.replace(
            'check "ocl{self.state = #ready}"',
            'check "ocl{self.state = #lukewarm}"',
          ),
      ),
    ).filter(i => i.check === 'C39');
    assert.equal(issues.length, 1);
    assert.ok(issues[0]!.message.includes('#lukewarm'));
    assert.ok(issues[0]!.message.includes('entry_condition "warmed-up"'));
  });

  it('C41 warns on an unknown on_violation outcome, naming the entry', () => {
    const issues = checkPackage(
      makePackage(
        FRAMEWORK +
          GATED.replace(
            'description "An unwarmed run is invalid, never a fail." on_violation invalid',
            'description "An unwarmed run is invalid, never a fail." on_violation explode',
          ),
      ),
    ).filter(i => i.check === 'C41');
    assert.equal(issues.length, 1);
    assert.ok(issues[0]!.message.includes('entry_condition "warmed-up"'));
    assert.ok(issues[0]!.message.includes('"explode"'));
  });

  it('the anonymous entry conditions stay silent on every leg (the folded guards)', () => {
    const issues = checkPackage(makePackage(FRAMEWORK + GATED)).filter(i =>
      i.message.includes('Application.status = SUBMITTED'),
    );
    assert.deepEqual(issues, []);
  });
});
