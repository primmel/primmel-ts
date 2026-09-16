// ─────────────────────────────────────────────────────────────────────
// The workflow fidelity facets (smart TODO.roadmap/40 batch 5; the
// packages-as-SSOT epic; closes the kernel half of smart's
// TODO.refactor/16) — the process facet additions (guard / phase /
// machine_steps), the gateway edges (5b), the approval provenance +
// resolution (5c), and the workflow_stage register (5d). The fixtures
// carry the real r60 evaluation shapes (inline, the conformance-corpus
// precedent — no cross-repo dependency).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';
import type { ExclusiveGateway } from '../src/types/Gateway';

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-wf5-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

// The r60 conduct_tests shape: the facets the old emitter dropped
// (label vs name is the emitter's; the kernel reads `name`).
const PROCESS = `
data_registry testRequests {
  name "Test requests"
}
process conduct_tests {
  name "Conduct tests"
  modality shall
  phase testing
  guard "Each TestRequest references >= 1 MeasuringInstrumentSample"
  guard "TestRequest.assigned_laboratory_id is accredited for the requested accuracy classes"
  machine_steps { verdict_computation evaluation_aggregation certificate_characteristics_derivation }
  reference_data_registry {
    testRequests
  }
  validate_measurement {
    "every([within_mpe]) = true"
  }
  source { doc "PD-05 §4.1" clause "" }
}
`;

describe('process workflow facets (smart TODO.roadmap/40 batch 5, step 5a)', () => {
  it('parses phase, the ordered guards, and the machine_steps list', () => {
    const m = load(PROCESS);
    assert.equal(m.processes.length, 1);
    const p = m.processes[0]!;
    assert.equal(p.modality, 'shall');
    assert.equal(p.phase, 'testing');
    assert.deepEqual(p.guards, [
      'Each TestRequest references >= 1 MeasuringInstrumentSample',
      'TestRequest.assigned_laboratory_id is accredited for the requested accuracy classes',
    ]);
    assert.deepEqual(p.machineSteps, [
      'verdict_computation',
      'evaluation_aggregation',
      'certificate_characteristics_derivation',
    ]);
    assert.deepEqual(
      p.input.map(r => r.id),
      ['testRequests'],
    );
    assert.deepEqual(p.measure, ['every([within_mpe]) = true']);
    assert.equal(p.source?.doc, 'PD-05 §4.1');
  });

  it('round-trips byte-clean (the codec fixpoint)', () => {
    const out = dump(load(PROCESS));
    assert.ok(out.includes('  phase testing\n'));
    assert.ok(
      out.includes(
        '  guard "Each TestRequest references >= 1 MeasuringInstrumentSample"\n' +
          '  guard "TestRequest.assigned_laboratory_id is accredited for the requested accuracy classes"\n',
      ),
    );
    assert.ok(
      out.includes(
        '  machine_steps { verdict_computation evaluation_aggregation certificate_characteristics_derivation }\n',
      ),
    );
    assert.ok(
      out.includes('  reference_data_registry {\n    testRequests\n  }\n'),
    );
    assert.equal(dump(load(out)), out);
  });

  it('provenance is spelled ONLY source { doc clause } — free citation strings land in doc', () => {
    const m = load(PROCESS);
    const src = m.processes[0]!.source!;
    assert.equal(src.doc, 'PD-05 §4.1');
    assert.equal(src.clause, '');
    const out = dump(m);
    assert.ok(out.includes('doc "PD-05 §4.1"'));
    // The accidental `reference { … }` emission has no keyword — it never
    // comes back.
    assert.ok(!out.includes('reference {'));
  });

  it('a process without the new facets keeps the batch-2 shape exactly', () => {
    const out = dump(load('process p { name "Plain" }'));
    assert.ok(out.includes('process p {\n  name "Plain"\n}\n'));
    assert.equal(dump(load(out)), out);
  });
});

// The r60 gateways.yaml shape: 5 gateways / 10 edges, conditions opaque,
// one default edge per gateway (last).
const GATEWAY = `
exclusive_gateway test_runs_gateway {
  label "Determine Required Test Runs"
  edge conduct_mdlo_tests { condition "[accuracy_class] in ['C', 'D']" label "3 load applications" }
  edge conduct_mdlo_tests_5runs { condition "[accuracy_class] in ['A', 'B']" label "5 load applications" }
  edge skip_tests { condition default label "Not applicable" }
}
`;

describe('exclusive_gateway edges (smart TODO.roadmap/40 batch 5, step 5b)', () => {
  it('parses the ordered edge cascade (incl. the bare default token)', () => {
    const m = load(GATEWAY);
    const g = m.gateways[0]!;
    assert.equal(g.gatewayType, 'exclusive_gateway');
    assert.equal(g.label, 'Determine Required Test Runs');
    const edges = (g as ExclusiveGateway).edges;
    assert.equal(edges.length, 3);
    assert.equal(edges[0]!.target, 'conduct_mdlo_tests');
    assert.equal(edges[0]!.condition, "[accuracy_class] in ['C', 'D']");
    assert.equal(edges[0]!.label, '3 load applications');
    assert.equal(edges[2]!.target, 'skip_tests');
    assert.equal(edges[2]!.condition, 'default');
    assert.equal(edges[2]!.label, 'Not applicable');
  });

  it('round-trips byte-clean (the codec fixpoint; default stays bare)', () => {
    const out = dump(load(GATEWAY));
    assert.ok(
      out.includes(
        '  edge conduct_mdlo_tests { condition "[accuracy_class] in [\'C\', \'D\']" label "3 load applications" }\n',
      ),
    );
    assert.ok(
      out.includes(
        '  edge skip_tests { condition default label "Not applicable" }\n',
      ),
    );
    assert.equal(dump(load(out)), out);
  });

  it('C142: a coherent cascade (targets resolve, one default, last) is clean', () => {
    const body = `
process conduct_mdlo_tests { name "MDLO tests" }
process conduct_mdlo_tests_5runs { name "MDLO tests, 5 runs" }
process skip_tests { name "Skip" }
${GATEWAY}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C142',
    );
    assert.deepEqual(issues, []);
  });

  it('C142: a dangling edge target is flagged (gated on the process register)', () => {
    const body = `
process skip_tests { name "Skip" }
${GATEWAY}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C142',
    );
    assert.equal(issues.length, 2);
    assert.match(issues[0]!.message, /"conduct_mdlo_tests"/);
    assert.match(issues[1]!.message, /"conduct_mdlo_tests_5runs"/);
    // No processes at all → the resolution leg gates off.
    const ungated = checkPackage(makePackage(GATEWAY)).filter(
      i => i.check === 'C142' && i.severity === 'error',
    );
    assert.deepEqual(ungated, []);
  });

  it('C142: the default discipline — missing default errors, mid-list default warns', () => {
    const noDefault = checkPackage(
      makePackage(
        'exclusive_gateway g { edge a { condition "x" } edge b { condition "y" } }',
      ),
    ).filter(i => i.check === 'C142');
    assert.equal(noDefault.length, 1);
    assert.equal(noDefault[0]!.severity, 'error');
    assert.match(noDefault[0]!.message, /no default edge/);
    const twoDefaults = checkPackage(
      makePackage(
        'exclusive_gateway g { edge a { condition default } edge b { condition default } }',
      ),
    ).filter(i => i.check === 'C142');
    assert.equal(twoDefaults.length, 1);
    assert.match(twoDefaults[0]!.message, /exactly one catch-all/);
    const midList = checkPackage(
      makePackage(
        'exclusive_gateway g { edge a { condition "x" } edge b { condition default } edge c { condition "y" } }',
      ),
    ).filter(i => i.check === 'C142');
    assert.equal(midList.length, 1);
    assert.equal(midList[0]!.severity, 'warning');
    assert.match(midList[0]!.message, /not last/);
  });

  it('C142: an edge-less (label-only) gateway carries no routing — skipped', () => {
    const issues = checkPackage(
      makePackage('exclusive_gateway g { label "Just a label" }'),
    ).filter(i => i.check === 'C142');
    assert.deepEqual(issues, []);
  });
});

// The r60 approvals.yaml shape: id, label→name, actor, approve_by,
// approval_record { <entity-store>+ }, and the citation string folded
// into source { doc } (the kernel `reference {…}` facet stays the
// Reference-construct id list it always was).
const APPROVAL_ROLES_CLASSES = `
role applicant {
  name "Applicant"
}
role ia_checker {
  name "IA checker"
}
class Application#data {
  store { applications }
  id: string { modality SHALL }
}
`;

const APPROVAL = `
approval ia_approve_application {
  name "IA approves the application"
  actor applicant
  modality shall
  approve_by ia_checker
  approval_record {
    applications
  }
  source { doc "PD-05 §4.2" clause "" }
}
`;

describe('approval provenance + resolution (smart TODO.roadmap/40 batch 5, step 5c)', () => {
  it('parses the facets; the raw reference ids survive resolution', () => {
    const m = load(APPROVAL_ROLES_CLASSES + APPROVAL);
    assert.equal(m.approvals.length, 1);
    const a = m.approvals[0]!;
    assert.equal(a.name, 'IA approves the application');
    assert.equal(a.modality, 'shall');
    assert.equal(a.actorRef, 'applicant');
    assert.equal(a.approverRef, 'ia_checker');
    assert.deepEqual(a.recordRefs, ['applications']);
    // The resolved halves: actor/approver bind to the declared roles …
    assert.equal(a.actor?.id, 'applicant');
    assert.equal(a.approver?.id, 'ia_checker');
    // … while approval_record names an entity-class STORE, not a
    // data_registry — the legacy regs-resolution finds nothing, the raw
    // list is the carrier (C143 checks it against the class stores).
    assert.deepEqual(a.records, []);
    assert.equal(a.source?.doc, 'PD-05 §4.2');
    assert.equal(a.source?.clause, '');
  });

  it('round-trips byte-clean (the codec fixpoint)', () => {
    const out = dump(load(APPROVAL_ROLES_CLASSES + APPROVAL));
    assert.ok(
      out.includes(
        'approval ia_approve_application {\n' +
          '  name "IA approves the application"\n' +
          '  actor applicant\n' +
          '  modality shall\n' +
          '  approve_by ia_checker\n' +
          '  approval_record {\n' +
          '    applications\n' +
          '  }\n' +
          '  source {\n' +
          '    doc "PD-05 §4.2"\n' +
          '  }\n' +
          '}\n',
      ),
    );
    assert.equal(dump(load(out)), out);
  });

  it('an empty modality emits NO dangling `modality ` line (the dormant-codec bugfix)', () => {
    const out = dump(
      load('approval a { name "Plain" actor applicant approve_by ia_checker }'),
    );
    assert.ok(
      out.includes('approval a {\n  name "Plain"\n  actor applicant\n'),
    );
    assert.ok(!out.includes('modality'));
    assert.equal(dump(load(out)), out);
  });

  it('an UNRESOLVABLE reference still round-trips byte-clean (the raw-refs carrier)', () => {
    const out = dump(
      load(
        'approval a { name "Ghost" actor ghost_role approve_by nobody approval_record { ghost_store } }',
      ),
    );
    assert.ok(
      out.includes(
        '  actor ghost_role\n  approve_by nobody\n  approval_record {\n    ghost_store\n  }\n',
      ),
    );
    assert.equal(dump(load(out)), out);
  });

  it('C143: a coherent approval (roles + store resolve) is clean', () => {
    const issues = checkPackage(
      makePackage(APPROVAL_ROLES_CLASSES + APPROVAL),
    ).filter(i => i.check === 'C143');
    assert.deepEqual(issues, []);
  });

  it('C143: dangling actor/approver/store are flagged (gated per register)', () => {
    const body = `
role applicant {
  name "Applicant"
}
class Application#data {
  store { applications }
  id: string { modality SHALL }
}
approval ia_approve_application {
  name "IA approves the application"
  actor ghost_applicant
  approve_by ghost_checker
  approval_record {
    ghost_store
  }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C143',
    );
    assert.equal(issues.length, 3);
    assert.match(issues[0]!.message, /actor "ghost_applicant"/);
    assert.match(issues[1]!.message, /approver "ghost_checker"/);
    assert.match(issues[2]!.message, /approval_record "ghost_store"/);
    assert.ok(issues.every(i => i.severity === 'error'));
  });

  it('C143: an empty register gates the leg off (the C58 doctrine)', () => {
    // No roles, no classes → nothing is "dangling", the registers are
    // simply not in scope.
    const issues = checkPackage(makePackage(APPROVAL)).filter(
      i => i.check === 'C143',
    );
    assert.deepEqual(issues, []);
  });
});
