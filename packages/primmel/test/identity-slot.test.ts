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
import { dirname, join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { loadPackage } from '../src/ser-des/package';
import { checkPackage } from '../src/check';
import { identitySlotDatumView } from '../src/ser-des/config/identitySlot';

const SLOTS = `
identity_slot manufacturer {
  label "Manufacturer's name or trade mark"
  type string
  presentation { marked-on-instrument accompanying-document }
  definition { Name or trade mark of the manufacturer (R 60-1, 6.2.1 item 1). }
  metamodel_class identity-provenance.Manufacturer
  ref derives-from "urn:oiml:pub:r:60-1:2021#clause-6.2.1"
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
  statement { The markings shall be indelible. }
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
  statement { The markings shall be indelible. }
  binds_to { model.identity.manufacturer }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C130',
    );
    assert.equal(issues.length, 0);
  });
});

// ── The datum unification's second rung (TODO.lang-gaps/04, spec
// [[datum-unification]]): the identity_slot's inscription value rides
// the datum substrate — the inline `datum { … }` block, the C191
// coherence leg, and the datum view accessor. ──
describe('identity_slot datum rung (TODO.lang-gaps/04 PR 2)', () => {
  const DATUM_SLOT = `
identity_slot net_weight {
  label "Net weight"
  type string
  datum { type string unit v origin declared }
  presentation { marked-on-instrument }
}
`;

  it('parses the inline datum block; the flat type stands', () => {
    const m = load(DATUM_SLOT);
    const s = m.identitySlots[0]!;
    assert.equal(s.type, 'string');
    assert.deepEqual(s.datum, {
      type: 'string',
      unit: 'v',
      quantityKind: '',
      origin: 'declared',
      scope: '',
    });
    // The plane extras are untouched — extras on the substrate.
    assert.deepEqual(s.presentation, ['marked-on-instrument']);
  });

  it('the datum view accessor resolves the block over the flat facets', () => {
    const m = load(DATUM_SLOT);
    assert.deepEqual(identitySlotDatumView(m.identitySlots[0]!), {
      type: 'string',
      unit: 'v',
      quantityKind: '',
      origin: 'declared',
      scope: '',
    });
    // A block silent on the type lets the flat facet stand.
    const partial = load(`
identity_slot w {
  type mark
  datum { unit kg origin observed }
  presentation { accompanying-document }
}
`).identitySlots[0]!;
    assert.deepEqual(identitySlotDatumView(partial), {
      type: 'mark',
      unit: 'kg',
      quantityKind: '',
      origin: 'observed',
      scope: '',
    });
    // No block: the flat type alone is the datum view.
    const plain = load(
      'identity_slot p { type serial presentation { marked-on-instrument } }',
    ).identitySlots[0]!;
    assert.deepEqual(identitySlotDatumView(plain), {
      type: 'serial',
      unit: '',
      quantityKind: '',
      origin: 'declared',
      scope: '',
    });
  });

  it('round-trips the authored spelling (the codec fixpoint)', () => {
    const out = dump(load(DATUM_SLOT));
    // The block spelling is preserved (never normalized to the flat
    // type, never hoisted to a top-level datum); the facet defaults
    // normalize away — `origin declared` is omitted, the same
    // convention the datum construct's dump and the slot's own
    // `optional false` omission hold.
    assert.ok(out.includes('  datum { type string unit v }\n'));
    assert.equal(dump(load(out)), out);
    // The multi-line authored block normalizes to the single-line form
    // and stabilizes there.
    const multi = `
identity_slot w {
  type mark
  datum {
    unit kg
    origin observed
    scope sample
  }
  presentation { accompanying-document }
}
`;
    const once = dump(load(multi));
    assert.ok(
      once.includes('  datum { unit kg origin observed scope sample }\n'),
    );
    assert.equal(dump(load(once)), once);
  });

  it('rejects an unknown type inside the block (fail-closed)', () => {
    assert.throws(
      () => load('identity_slot b { type string datum { type blob } }'),
      /Unknown identity slot type "blob"/,
    );
  });

  it('rejects an unknown origin inside the block (fail-closed)', () => {
    assert.throws(
      () => load('identity_slot b { type string datum { origin asserted } }'),
      /Unknown datum origin "asserted"/,
    );
  });

  it('rejects a datum spelling with a stray value (no id, no parg)', () => {
    assert.throws(
      () => load('identity_slot b { type string datum string }'),
      /the inline datum block is "datum \{ … \}"/,
    );
  });

  it('C191: a contradiction between the block and the flat type fires', () => {
    const issues = checkPackage(
      makePackage(
        'identity_slot b { type string datum { type mark } presentation { marked-on-instrument } }',
      ),
    ).filter(i => i.check === 'C191');
    assert.equal(issues.length, 1);
    assert.match(
      issues[0]!.message,
      /contradicts the slot's flat type "string"/,
    );
  });

  it('C191: agreement, a type-silent block, and plain slots stay silent', () => {
    const body = `
${SLOTS}
identity_slot agreeing {
  type string
  datum { type string unit v }
  presentation { marked-on-instrument }
}
identity_slot silent {
  type mark
  datum { origin observed }
  presentation { accompanying-document }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C191',
    );
    assert.deepEqual(issues, []);
  });

  it('C130 (the check.ts identity-slot leg) is unchanged by the rung', () => {
    // The datum-bearing slot checks clean under C130; the shape leg and
    // the bind-path consumer leg keep their behavior.
    const issues = checkPackage(makePackage(DATUM_SLOT)).filter(
      i => i.check === 'C130',
    );
    assert.deepEqual(issues, []);
    const bare = checkPackage(
      makePackage('identity_slot b { datum { type string } }'),
    ).filter(i => i.check === 'C130');
    assert.equal(bare.length, 1);
    assert.match(bare[0]!.message, /presentation channel/);
  });

  it('composes: a base-package slot with a datum block resolves downstream', () => {
    const dirs = new Map<string, string>();
    const make = (
      id: string,
      manifest: string,
      files: Record<string, string>,
    ): string => {
      const dir = mkdtempSync(join(tmpdir(), `primmel-c191-${id}-`));
      writeFileSync(join(dir, 'package.primmel'), manifest);
      for (const [rel, content] of Object.entries(files)) {
        const path = join(dir, rel);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content);
      }
      dirs.set(id, dir);
      return dir;
    };
    make('slot-base', 'package { id slot-base kind core }', {
      'model/identity.prl': DATUM_SLOT,
    });
    const downDir = make(
      'slot-down',
      'package { id slot-down uses { slot-base } }',
      {
        'model/reqs.prl': `
requirement /req/identity/weight {
  statement { The net weight shall be marked. }
  binds_to { model.identity.net_weight }
}
`,
      },
    );
    const resolvePackage = (id: string): string | undefined => dirs.get(id);
    const std = loadPackage(downDir, { resolvePackage });
    const slot = std.identitySlots.find(s => s.id === 'net_weight')!;
    assert.deepEqual(slot.datum, {
      type: 'string',
      unit: 'v',
      quantityKind: '',
      origin: 'declared',
      scope: '',
    });
    const issues = checkPackage(downDir, { resolvePackage }).filter(
      i => i.check === 'C130' || i.check === 'C191',
    );
    assert.deepEqual(issues, []);
  });
});
