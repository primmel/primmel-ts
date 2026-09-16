// ─────────────────────────────────────────────────────────────────────
// aspect construct (smart TODO.roadmap/40 batch 3) — the qualitative
// HAS inventory of the subject: the parse-enforced kind vocabulary, the
// codec fixpoint, and the C130 reference legs (term_ref / component /
// attribute / contains — each gated on its target register).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const REGISTERS = `
term marking {
  label "Marking"
  definition "An inscription on the load cell."
}
attribute_definition e_max {
  symbol "E_max"
  name "Maximum capacity"
  definition "The maximum load the cell measures."
  value_type quantity
}
attribute_definition software_identification {
  symbol "SW_id"
  name "Software identification"
  definition "The software version identifier."
  value_type string
}
instrument LoadCell {
  extends MeasuringInstrumentModel
  component detection_field {
    class DetectionField
    definition "The detection field."
  }
}
`;

const ASPECTS = `
aspect markings {
  label "Markings on the load cell"
  kind marking
  definition "The inscriptions marked clearly and indelibly on the load cell."
  metamodel_class identity-provenance.Marking
  term_ref marking
  contains { model.identity.manufacturer e_max }
  source { doc "urn:oiml:pub:r:60-1:2021" clause "6.2.1" }
}
aspect software {
  kind other
  attribute software_identification
}
aspect detection {
  kind interface
  component detection_field
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-aspect-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('aspect construct (smart TODO.roadmap/40 batch 3)', () => {
  it('parses the register entries', () => {
    const m = load(ASPECTS);
    assert.equal(m.aspects.length, 3);
    const a = m.aspects[0]!;
    assert.equal(a.id, 'markings');
    assert.equal(a.kind, 'marking');
    assert.equal(a.termRef, 'marking');
    assert.equal(a.metamodelClass, 'identity-provenance.Marking');
    assert.deepEqual(a.contains, ['model.identity.manufacturer', 'e_max']);
    assert.equal(a.source?.clause, '6.2.1');
    const sw = m.aspects[1]!;
    assert.equal(sw.kind, 'other');
    assert.equal(sw.attribute, 'software_identification');
    assert.equal(sw.source, null);
    assert.equal(m.aspects[2]!.component, 'detection_field');
  });

  it('round-trips byte-clean (the codec fixpoint)', () => {
    const out = dump(load(ASPECTS));
    assert.equal(dump(load(out)), out);
    assert.ok(
      out.includes('  contains { model.identity.manufacturer e_max }\n'),
    );
  });

  it('rejects an unknown kind at parse (the fail-closed precedent)', () => {
    assert.throws(
      () => load('aspect broken { kind vibes }'),
      /Unknown aspect kind "vibes"/,
    );
  });

  it('C130 stays silent when every reference resolves', () => {
    const issues = checkPackage(
      makePackage(
        REGISTERS +
          ASPECTS +
          `
identity_slot manufacturer {
  label "Manufacturer"
  type string
  presentation { marked-on-instrument }
}
`,
      ),
    ).filter(i => i.check === 'C130');
    assert.deepEqual(issues, []);
  });

  it('C130: a dangling term_ref / component / attribute is flagged', () => {
    const body = `
${REGISTERS}
aspect broken {
  kind other
  term_ref ghost_term
  component ghost_component
  attribute ghost_attribute
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C130',
    );
    assert.equal(issues.length, 3);
    assert.match(issues[0]!.message, /ghost_term/);
    assert.match(issues[1]!.message, /ghost_component/);
    assert.match(issues[2]!.message, /ghost_attribute/);
  });

  it('C130: contains tries the identity path AND the bare-id namespaces', () => {
    const body = `
${REGISTERS}
identity_slot manufacturer {
  label "Manufacturer"
  type string
  presentation { marked-on-instrument }
}
aspect markings {
  kind marking
  contains { model.identity.manufacturer model.identity.ghost e_max ghost_attr }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C130',
    );
    assert.equal(issues.length, 2);
    assert.match(issues[0]!.message, /model\.identity\.ghost/);
    assert.match(issues[1]!.message, /ghost_attr/);
  });

  it('C130 gates the reference legs on their target registers', () => {
    // No terms, no instruments, no attributes, no slots in scope: every
    // leg skips — the aspect stays documentary.
    const issues = checkPackage(makePackage(ASPECTS)).filter(
      i => i.check === 'C130',
    );
    assert.deepEqual(issues, []);
  });
});
