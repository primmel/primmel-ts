// ─────────────────────────────────────────────────────────────────────
// The datum unification's fifth rung (TODO.lang-gaps/04, spec
// [[datum-unification]]): the form field is the RUN plane of the one
// datum substrate — the inline `datum { … }` block, the C193
// field-datum-coherence leg, and the `fieldDatumView` accessor. Before
// this rung the field body's unknown-cmd fallback silently skipped the
// block — the first spec pins the parse+store. The wave 01 binding
// edges and the C184 range legs keep their behavior beside the block.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';
import { fieldDatumView } from '../src/ser-des/config/field-parser';
import type Standard from '../src/types/Standard';

const FORM = (body: string) => `
form twin-1/fields {
  name "The fields"
  data_class ProbeRecord#data
  conformance_process /conf/twin-fidelity/probe-creep
  section "S"
  requirements { /req/twin-fidelity/creep-envelope }
${body}
}`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-fielddatum-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('form field datum rung (TODO.lang-gaps/04 PR 5)', () => {
  const DATUM_FIELD = `    field emax : number {
      label "The maximum error"
      unit "%"
      datum { type number unit % quantity_kind mass_fraction origin design-fixed scope run }
      required true
      measurement_method declared
      binding { from reference_reading to emax_ref }
    }`;

  it('parses the inline datum block (no longer silently skipped)', () => {
    const m: any = load(FORM(DATUM_FIELD));
    const f = m.forms[0].fields[0];
    assert.equal(f.name, 'emax');
    assert.equal(f.type, 'number');
    assert.equal(f.unit, '%');
    assert.deepEqual(f.datum, {
      type: 'number',
      unit: '%',
      quantityKind: 'mass_fraction',
      origin: 'design-fixed',
      scope: 'run',
    });
    // The plane extras are untouched — extras on the substrate.
    assert.equal(f.required, true);
    assert.equal(f.measurementMethod, 'declared');
    // The wave 01 binding edge still parses beside the datum block.
    assert.deepEqual(f.bindings, [
      { from: 'reference_reading', to: 'emax_ref' },
    ]);
  });

  it('the datum view accessor resolves the block over the flat facets', () => {
    const m: any = load(FORM(DATUM_FIELD));
    assert.deepEqual(fieldDatumView(m.forms[0].fields[0]), {
      type: 'number',
      unit: '%',
      quantityKind: 'mass_fraction',
      origin: 'design-fixed',
      scope: 'run',
    });
    // A block silent on a facet lets the flat facet stand in (the head
    // type and unit ARE the datum's type/unit — the wave 04 PR 3
    // finding); the field's flat `scope` facet is a DIFFERENT axis
    // (the form's presentation scope) and never stands in.
    const partial: any = load(
      FORM(
        `    field note : string {
          label "The note"
          scope administrative
          datum { origin observed }
        }`,
      ),
    );
    assert.deepEqual(fieldDatumView(partial.forms[0].fields[0]), {
      type: 'string',
      unit: '',
      quantityKind: '',
      origin: 'observed',
      scope: '',
    });
    // No block: the flat head type + unit alone is the datum view.
    const plain: any = load(
      FORM(`    field d : number { label "D" unit "kg" }`),
    );
    assert.deepEqual(fieldDatumView(plain.forms[0].fields[0]), {
      type: 'number',
      unit: 'kg',
      quantityKind: '',
      origin: 'declared',
      scope: '',
    });
  });

  it('round-trips the authored spelling (the codec fixpoint)', () => {
    const out = dump(load(FORM(DATUM_FIELD)) as Standard);
    // The block spelling is preserved (never normalized onto the flat
    // facets, never hoisted); the facet defaults normalize away —
    // `origin declared` is omitted, the same convention the datum
    // construct's dump and the slot/attribute rungs hold.
    assert.ok(
      out.includes(
        'datum { type number unit % quantity_kind mass_fraction origin design-fixed scope run }',
      ),
    );
    assert.equal(dump(load(out) as Standard), out);
    // The multi-line authored block normalizes to the single-line form
    // and stabilizes there.
    const multi = FORM(`    field t : number {
      label "The temperature"
      datum {
        unit "degC"
        origin observed
        scope sample
      }
    }`);
    const once = dump(load(multi) as Standard);
    assert.ok(
      once.includes('datum { unit degC origin observed scope sample }'),
    );
    assert.equal(dump(load(once) as Standard), once);
  });

  it('rejects an unknown origin inside the block (fail-closed)', () => {
    assert.throws(
      () => load(FORM(`    field x : number { datum { origin measured } }`)),
      /Unknown datum origin "measured"/,
    );
  });

  it('rejects a datum spelling with a stray value (no id, no parg)', () => {
    assert.throws(
      () => load(FORM(`    field x : number { datum number }`)),
      /the inline datum block is "datum \{ … \}"/,
    );
  });

  it('C193: a contradiction between the block and the declared head type fires', () => {
    const issues = checkPackage(
      makePackage(
        FORM(`    field emax : number {
          datum { type string }
        }`),
      ),
    ).filter(i => i.check === 'C193');
    assert.equal(issues.length, 1);
    assert.match(
      issues[0]!.message,
      /contradicts the field's flat type "number"/,
    );
    assert.match(issues[0]!.message, /field-datum-coherence/);
  });

  it('C193: agreement, a type-silent block, an override over an untyped head, and plain fields stay silent', () => {
    const issues = checkPackage(
      makePackage(
        FORM(`    field a : number {
          datum { type number unit kg }
        }
    field b : number {
      datum { origin observed }
    }
    field c {
      datum { type number }
    }
    field d : number { unit "kg" }`),
      ),
    ).filter(i => i.check === 'C193');
    assert.deepEqual(issues, []);
  });

  it('C193: a body type facet and the block naming different types fires', () => {
    const issues = checkPackage(
      makePackage(
        FORM(`    field x {
          type string
          datum { type number }
        }`),
      ),
    ).filter(i => i.check === 'C193');
    assert.equal(issues.length, 1);
    assert.match(
      issues[0]!.message,
      /contradicts the field's flat type "string"/,
    );
  });

  it('C193 judges nested fields with the same rule', () => {
    const issues = checkPackage(
      makePackage(
        FORM(`    field rig : object {
      label "The rig"
      fields {
        field humidity : number {
          datum { type string }
        }
      }
    }`),
      ),
    ).filter(i => i.check === 'C193');
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /field rig\.humidity/);
  });

  it('C193 judges subform fields with the same rule', () => {
    const issues = checkPackage(
      makePackage(`subform row {
  type object
  field cell : number {
    datum { type boolean }
  }
}`),
    ).filter(i => i.check === 'C193');
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /field cell/);
  });

  it('the C184 range legs are unchanged by the rung', () => {
    const issues = checkPackage(
      makePackage(
        FORM(`    field emax : number {
      datum { type number unit % }
      min 50000
      max 0
    }`),
      ),
    ).filter(i => i.check === 'C184');
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /min 50000 > max 0/);
    // And a datum-bearing well-formed range stays clean.
    const clean = checkPackage(
      makePackage(
        FORM(`    field emax : number {
      datum { type number unit % }
      min 0
      max 50000
    }`),
      ),
    ).filter(i => i.check === 'C184');
    assert.deepEqual(clean, []);
  });
});
