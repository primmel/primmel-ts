// ─────────────────────────────────────────────────────────────────────
// identity_slot construct (smart TODO.roadmap/40 batch 3) — the
// subject's documentary identity register: the parse-enforced
// vocabularies (type, presentation), the codec fixpoint, and the C130
// legs (the ≥1-presentation shape leg + the R28 bind-path consumer leg).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const SLOTS = `
identity_slot manufacturer {
  label "Manufacturer's name or trade mark"
  type string
  presentation { marked-on-instrument accompanying-document }
  definition "Name or trade mark of the manufacturer (R 60-1, 6.2.1 item 1)."
  metamodel_class identity-provenance.Manufacturer
  source { doc "urn:oiml:pub:r:60-1:2021" clause "6.2.1" }
}
identity_slot type_approval_mark {
  label "Type approval mark"
  type mark
  presentation { accompanying-document }
  optional true
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-idslot-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('identity_slot construct (smart TODO.roadmap/40 batch 3)', () => {
  it('parses both entry shapes', () => {
    const m = load(SLOTS);
    assert.equal(m.identitySlots.length, 2);
    const a = m.identitySlots[0]!;
    assert.equal(a.id, 'manufacturer');
    assert.equal(a.label, "Manufacturer's name or trade mark");
    assert.equal(a.type, 'string');
    assert.deepEqual(a.presentation, [
      'marked-on-instrument',
      'accompanying-document',
    ]);
    assert.equal(a.optional, false);
    assert.match(a.definition, /^Name or trade mark/);
    assert.equal(a.metamodelClass, 'identity-provenance.Manufacturer');
    assert.equal(a.source?.doc, 'urn:oiml:pub:r:60-1:2021');
    assert.equal(a.source?.clause, '6.2.1');
    const b = m.identitySlots[1]!;
    assert.equal(b.type, 'mark');
    assert.equal(b.optional, true);
    assert.equal(b.source, null);
  });

  it('round-trips byte-clean (the codec fixpoint)', () => {
    const out = dump(load(SLOTS));
    assert.equal(dump(load(out)), out);
    assert.ok(
      out.includes(
        '  presentation { marked-on-instrument accompanying-document }\n',
      ),
    );
    assert.ok(out.includes('  optional true\n'));
    // An absent optional never canonicalizes to `optional false`.
    assert.equal((out.match(/optional/g) ?? []).length, 1);
  });

  it('rejects an unknown type at parse (the fail-closed precedent)', () => {
    assert.throws(
      () => load('identity_slot broken { type blob }'),
      /Unknown identity slot type "blob"/,
    );
  });

  it('rejects an unknown presentation channel at parse', () => {
    assert.throws(
      () =>
        load(
          'identity_slot broken { presentation { marked-on-instrument shouted } }',
        ),
      /Unknown presentation channel "shouted"/,
    );
  });

  it('C130: a slot with no presentation channel is flagged', () => {
    const issues = checkPackage(
      makePackage('identity_slot bare { type string }'),
    ).filter(i => i.check === 'C130');
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /presentation channel/);
  });

  it('C130: a requirement bind to an undeclared slot is flagged', () => {
    const body = `
${SLOTS}
requirement /req/technical/inscriptions {
  statement "The markings shall be indelible."
  binds_to { model.identity.manufacturer model.identity.ghost_slot }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C130',
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /ghost_slot/);
  });

  it('C130 gates on the slot register — no slots, no bind leg', () => {
    const body = `
requirement /req/technical/inscriptions {
  statement "The markings shall be indelible."
  binds_to { model.identity.manufacturer }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C130',
    );
    assert.equal(issues.length, 0);
  });
});
