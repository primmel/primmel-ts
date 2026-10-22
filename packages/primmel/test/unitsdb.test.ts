// ─────────────────────────────────────────────────────────────────────
// The UnitsDB binding (kernel#87): the register unit's unitsdb pin
// parses and dumps, the adapter resolves the supplied data's structure
// (degC → the kelvin base; the prefixed spelling splits longest-
// prefix-first), and C185 judges the bindings against a supplied DB —
// inert without one, erroring on a pin the data cannot resolve.
// The fixture is the unitsml/unitsdb release's shape (the SI-base
// closure the tests exercise), vendored as test material only.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { loadUnitsDb } from '../src/unitsdb';
import { checkUnitsDbBindings } from '../src/check';
import { exportStandardRetrieval } from '../src/export/retrieval';
import type Standard from '../src/types/Standard';

const DB = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'unitsdb.json'), 'utf8'),
);

const REGISTER = `
quantity_register IEC {
  kind temperature { dimensions { Θ 1 } }
  unit degC {
    symbol "degC"
    label "degree Celsius"
    kind temperature
    factor 1
    offset 273.15
    unitsdb { nist "NISTu23" unitsml "u:degree_Celsius" }
  }
  unit kV {
    symbol "kV"
    label "kilovolt"
    kind voltage
    factor 1000
    unitsdb { nist "NISTu16" unitsml "u:kV" }
  }
}
`;

describe('the UnitsDB binding (kernel#87)', () => {
  it('the pin parses, dumps, and round-trips', () => {
    const m: any = load(REGISTER);
    const units = m.quantityRegisters[0].units;
    assert.equal(units[0].unitsdb.nist, 'NISTu23');
    assert.equal(units[0].unitsdb.unitsml, 'u:degree_Celsius');
    assert.equal(units[1].unitsdb.unitsml, 'u:kV');
    const d1 = dump(m);
    assert.match(d1, /unitsdb \{ nist "NISTu23" unitsml "u:degree_Celsius" \}/);
    const m2: any = load(d1);
    assert.equal(m2.quantityRegisters[0].units[0].unitsdb.nist, 'NISTu23');
  });

  it('an empty pin is a parse error', () => {
    assert.throws(
      () =>
        load(
          REGISTER.replace(
            'unitsdb { nist "NISTu23" unitsml "u:degree_Celsius" }',
            'unitsdb { }',
          ),
        ),
      /unitsdb carries no identifier/,
    );
  });

  it('degC resolves to the kelvin base; the interval scale is named', () => {
    const db = loadUnitsDb(DB);
    const r = db.resolveUnit('u:degree_Celsius');
    assert.deepEqual(r.siBases, [{ id: 'NISTu5', power: 1 }]);
    assert.equal(r.siBases[0].id, 'NISTu5');
    assert.equal(r.scale, 'continuous_interval');
    assert.equal(
      r.unit.identifiers?.find(i => i.type === 'nist')?.id,
      'NISTu23',
    );
  });

  it('the prefixed spelling splits longest-prefix-first (u:kV → volt ×10³)', () => {
    const db = loadUnitsDb(DB);
    const r = db.resolveUnit('u:kV');
    assert.equal(r.prefix?.base, 10);
    assert.equal(r.prefix?.power, 3);
    // volt = kg·m²·s⁻³·A⁻¹ — the decomposition terminates at the bases.
    const ids = r.siBases.map(b => b.id).sort();
    assert.ok(ids.includes('NISTu2') || ids.includes('NISTu1'));
    assert.equal(r.siBases.length >= 3, true);
  });

  it('an unknown id throws naming the miss (the caller pinned the data)', () => {
    const db = loadUnitsDb(DB);
    assert.throws(
      () => db.resolveUnit('u:furlong'),
      /not in the supplied data/,
    );
  });

  it('C185 is inert without a supplied DB', () => {
    const m = load(REGISTER) as unknown as Standard;
    assert.deepEqual(checkUnitsDbBindings(m), []);
  });

  it('C185 passes bindings the supplied data resolves', () => {
    const m = load(REGISTER) as unknown as Standard;
    assert.deepEqual(checkUnitsDbBindings(m, DB), []);
  });

  it('C185 errors on a pin the data cannot resolve', () => {
    const bad = load(
      REGISTER.replace(
        'unitsdb { nist "NISTu16" unitsml "u:kV" }',
        'unitsdb { nist "NISTu999" }',
      ),
    ) as unknown as Standard;
    const issues = checkUnitsDbBindings(bad, DB);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].check, 'C185');
    assert.match(issues[0].message, /NISTu999.*does not resolve/);
  });

  it('the retrieval export enriches a pinned unit only with the DB supplied', () => {
    const std = load(
      REGISTER +
        `
verdict v_temp {
  quantity { kind temperature unit degC }
}
`,
    ) as unknown as Standard;
    const plain = exportStandardRetrieval(std);
    const enriched = exportStandardRetrieval(std, { unitsDb: DB });
    // byte-identical WITHOUT the DB (the /2 shape untouched)
    assert.deepEqual(
      JSON.stringify(plain),
      JSON.stringify(exportStandardRetrieval(std)),
    );
    const enrichedText = JSON.stringify(enriched);
    assert.match(enrichedText, /unitsdb/);
    assert.match(enrichedText, /si_structure/);
  });
});
