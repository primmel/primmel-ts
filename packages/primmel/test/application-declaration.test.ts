// ─────────────────────────────────────────────────────────────────────
// application_declaration construct (smart TODO.roadmap/40 batch 3) —
// the rec's applicant-facing documentation register: the singleton
// shape, the parse-enforced obligation vocabulary, the codec fixpoint,
// and C132 (declaration_form resolution, per-register gated; document
// id uniqueness).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const DECLARATION = `
application_declaration application {
  declaration_form r60-3/sec-4.5
  document measurement-principle {
    name "Description of the general principle of measurement"
    description "A description of the load cell's general principle of measurement (R 60-2, 2.5 a)."
    obligation shall
    source { doc "urn:oiml:pub:r:60-2:2021" clause "2.5" }
  }
  document mechanical-drawings {
    name "Mechanical drawings"
    obligation should
  }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-appdecl-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('application_declaration construct (smart TODO.roadmap/40 batch 3)', () => {
  it('parses the register entries', () => {
    const m = load(DECLARATION);
    assert.equal(m.applicationDeclarations.length, 1);
    const d = m.applicationDeclarations[0]!;
    assert.equal(d.id, 'application');
    assert.equal(d.declarationForm, 'r60-3/sec-4.5');
    assert.equal(d.documents.length, 2);
    const a = d.documents[0]!;
    assert.equal(a.id, 'measurement-principle');
    assert.equal(a.name, 'Description of the general principle of measurement');
    assert.match(a.description, /2\.5 a\)\.$/);
    assert.equal(a.obligation, 'shall');
    assert.equal(a.source?.doc, 'urn:oiml:pub:r:60-2:2021');
    const b = d.documents[1]!;
    assert.equal(b.obligation, 'should');
    assert.equal(b.description, '');
    assert.equal(b.source, null);
  });

  it('round-trips byte-clean (the codec fixpoint)', () => {
    const out = dump(load(DECLARATION));
    assert.ok(out.includes('  declaration_form r60-3/sec-4.5\n'));
    assert.ok(out.includes('  document measurement-principle {\n'));
    assert.equal(dump(load(out)), out);
  });

  it('rejects an unknown obligation at parse (the fail-closed precedent)', () => {
    assert.throws(
      () =>
        load(
          'application_declaration application { document x { obligation must } }',
        ),
      /Unknown obligation "must"/,
    );
  });

  it('C132: a declaration_form naming no declared form is flagged (gated)', () => {
    const body = `
form r60-3/sec-4.1 {
  name "Issuing Authority"
}
${DECLARATION}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C132',
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /r60-3\/sec-4\.5/);
  });

  it('C132 gates on the form register — no forms, no leg', () => {
    const issues = checkPackage(makePackage(DECLARATION)).filter(
      i => i.check === 'C132',
    );
    assert.deepEqual(issues, []);
  });

  it('C132: a duplicated document id is flagged', () => {
    const body = `
application_declaration application {
  document measurement-principle { name "One" }
  document measurement-principle { name "Two" }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C132',
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /declared twice/);
  });
});
