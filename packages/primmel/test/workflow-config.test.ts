// ─────────────────────────────────────────────────────────────────────
// workflow_config construct (smart TODO.roadmap/40 batch 3) — the
// certification workflow step register: the singleton shape, the
// parse-enforced phase vocabulary, the codec fixpoint, the OVERLAY
// composition (the B3.1 deep merge: two-package legs — steps union by
// id preserving first-seen order, gates append as a union), and C137
// (the actor resolution gated on the role register, the inputs/outputs
// clean-token resolution gated on the data-class register, composite
// strings documentary, gates never resolved).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { loadPackageWithIssues } from '../src/ser-des/package';
import { checkPackage } from '../src/check';

const CORE_WORKFLOW = `
workflow_config certification {
  step application {
    phase intake
    actor applicant
    label "Type Evaluation Application"
    description "Applicant submits the Application declaring the model family."
    inputs { applicant_info model_family_matrix documentation }
    outputs { Application }
    gates { "Application.status = SUBMITTED" }
  }
  step test-request-dispatch {
    phase dispatch
    actor issuing_authority
    label "Test request dispatch"
    description "The IA issues a TestRequest to each selected laboratory."
    inputs { Application MeasuringInstrumentSample TestLaboratory }
    outputs { TestRequest }
    gates { "Each TestRequest references >= 1 MeasuringInstrumentSample" }
  }
}
`;

const REC_OVERLAY = `
workflow_config certification {
  overlay true
  step test-request-dispatch {
    gates { "Each TestRequest.required_forms subset of R 60-3 form identifiers" "TestRequest.assigned_laboratory_id is accredited for the requested accuracy classes" }
  }
}
`;

const ROLES = `
role applicant {
  name "Applicant"
}
role issuing_authority {
  name "Issuing Authority"
}
`;

const CLASSES = `
class Application#data {
  store { applications }
  id: string { modality SHALL }
}
class TestRequest#data {
  store { testRequests }
  id: string { modality SHALL }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-workflow-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('workflow_config construct (smart TODO.roadmap/40 batch 3)', () => {
  it('parses the register entries', () => {
    const m = load(CORE_WORKFLOW);
    assert.equal(m.workflowConfigs.length, 1);
    const w = m.workflowConfigs[0]!;
    assert.equal(w.id, 'certification');
    assert.equal(w.overlay, false);
    assert.equal(w.steps.length, 2);
    const s = w.steps[1]!;
    assert.equal(s.id, 'test-request-dispatch');
    assert.equal(s.phase, 'dispatch');
    assert.equal(s.actor, 'issuing_authority');
    assert.equal(s.label, 'Test request dispatch');
    assert.match(s.description ?? '', /issues a TestRequest/);
    assert.deepEqual(s.inputs, [
      'Application',
      'MeasuringInstrumentSample',
      'TestLaboratory',
    ]);
    assert.deepEqual(s.outputs, ['TestRequest']);
    assert.deepEqual(s.gates, [
      'Each TestRequest references >= 1 MeasuringInstrumentSample',
    ]);
  });

  it('parses the overlay marker', () => {
    const m = load(REC_OVERLAY);
    assert.equal(m.workflowConfigs[0]!.overlay, true);
  });

  it('round-trips byte-clean (the codec fixpoint; overlay emits only when true)', () => {
    const out = dump(load(CORE_WORKFLOW));
    assert.ok(
      out.includes('workflow_config certification {\n  step application {\n'),
    );
    assert.ok(out.includes('    gates { "Application.status = SUBMITTED" }\n'));
    assert.equal(dump(load(out)), out);
    const overlayOut = dump(load(REC_OVERLAY));
    assert.ok(
      overlayOut.includes('  overlay true\n  step test-request-dispatch {\n'),
    );
    assert.equal(dump(load(overlayOut)), overlayOut);
  });

  it('rejects an unknown phase at parse (the fail-closed precedent)', () => {
    assert.throws(
      () => load('workflow_config certification { step x { phase review } }'),
      /Unknown phase "review"/,
    );
  });

  it('the overlay deep merge: two packages compose field-wise', () => {
    // The core skeleton + the rec delta — the smart layer-composer's
    // contract: steps union by id preserving first-seen order, gates
    // append as a union, untouched facets survive from the base.
    const dirs = new Map<string, string>();
    const mk = (id: string, manifest: string, body: string): string => {
      const dir = mkdtempSync(join(tmpdir(), `primmel-wf-${id}-`));
      writeFileSync(join(dir, 'package.primmel'), manifest);
      const p = join(dir, 'model', 'workflow.prl');
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, body);
      dirs.set(id, dir);
      return dir;
    };
    mk('wf-core', 'package { id wf-core kind core }', CORE_WORKFLOW);
    const recDir = mk(
      'wf-rec',
      'package { id wf-rec kind rec uses { wf-core } }',
      REC_OVERLAY,
    );
    const { standard } = loadPackageWithIssues(recDir, {
      resolvePackage: id => dirs.get(id),
    });
    const w = standard.workflowConfigs.find(c => c.id === 'certification')!;
    assert.equal(w.steps.length, 2);
    const s = w.steps[1]!;
    assert.equal(s.id, 'test-request-dispatch');
    // Facets the overlay does not name survive from the base.
    assert.equal(s.phase, 'dispatch');
    assert.equal(s.actor, 'issuing_authority');
    // The gates append after the shared gate, in the rec's order.
    assert.deepEqual(s.gates, [
      'Each TestRequest references >= 1 MeasuringInstrumentSample',
      'Each TestRequest.required_forms subset of R 60-3 form identifiers',
      'TestRequest.assigned_laboratory_id is accredited for the requested accuracy classes',
    ]);
  });

  it('an unmarked redefinition still fails (uses-no-redefine)', () => {
    const dirs = new Map<string, string>();
    const mk = (id: string, manifest: string, body: string): string => {
      const dir = mkdtempSync(join(tmpdir(), `primmel-wf2-${id}-`));
      writeFileSync(join(dir, 'package.primmel'), manifest);
      const p = join(dir, 'model', 'workflow.prl');
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, body);
      dirs.set(id, dir);
      return dir;
    };
    mk('wf-core', 'package { id wf-core kind core }', CORE_WORKFLOW);
    const recDir = mk(
      'wf-rec',
      'package { id wf-rec kind rec uses { wf-core } }',
      // NO overlay marker — the redefine must fail.
      'workflow_config certification { step x { phase intake } }',
    );
    assert.throws(
      () =>
        loadPackageWithIssues(recDir, { resolvePackage: id => dirs.get(id) }),
      /uses-no-redefine/,
    );
  });

  it('C137: a coherent register is clean', () => {
    const body = `
${ROLES}
${CLASSES}
workflow_config certification {
  step application {
    phase intake
    actor applicant
    label "Type Evaluation Application"
    inputs { Application }
    outputs { TestRequest }
    gates { "Application.status = SUBMITTED" }
  }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C137',
    );
    assert.deepEqual(issues, []);
  });

  it('C137: an actor naming no declared role is flagged (gated)', () => {
    const issues = checkPackage(makePackage(ROLES + CORE_WORKFLOW)).filter(
      i => i.check === 'C137',
    );
    // applicant resolves; issuing_authority resolves; add one that does not.
    assert.deepEqual(issues, []);
    const bad = checkPackage(
      makePackage(
        ROLES +
          'workflow_config certification { step s { phase intake actor metrology_institute } }',
      ),
    ).filter(i => i.check === 'C137');
    assert.equal(bad.length, 1);
    assert.match(
      bad[0]!.message,
      /actor "metrology_institute" is not a declared role/,
    );
  });

  it('C137 gates the actor leg — no role register, no leg', () => {
    const issues = checkPackage(makePackage(CORE_WORKFLOW)).filter(
      i => i.check === 'C137',
    );
    assert.deepEqual(issues, []);
  });

  it('C137: inputs/outputs clean tokens resolve against the data-class register (gated)', () => {
    const bad = checkPackage(
      makePackage(
        CLASSES +
          'workflow_config certification { step s { phase intake inputs { Application Bogus } outputs { TestRequest } } }',
      ),
    ).filter(i => i.check === 'C137');
    assert.equal(bad.length, 1);
    assert.match(
      bad[0]!.message,
      /inputs entry "Bogus" is not a declared data class/,
    );
  });

  it('C137: composite documentary strings are skipped, never errored', () => {
    const body =
      CLASSES +
      'workflow_config certification { step s { phase intake inputs { "TestReport containing FormInstance" } } }';
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C137',
    );
    assert.deepEqual(issues, []);
  });

  it('C137: gates are prose — never resolved', () => {
    const body =
      CLASSES +
      'workflow_config certification { step s { phase intake gates { "Anything at all, unresolved (Bogus.field = 1)" } } }';
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C137',
    );
    assert.deepEqual(issues, []);
  });
});
