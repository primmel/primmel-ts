// ─────────────────────────────────────────────────────────────────────
// C152 — payload-typed-by-class (the typed kernel R2, clause 10): a
// dimension that declares payload_class types every value's definition.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dump, load } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const SOURCE = `
class accuracy-class-data {
  n_lc_min : integer { modality SHALL }
  n_lc_max : integer { modality MAY }
  p_lc_min : number { modality SHALL }
  p_lc_max : number { modality SHALL }
  mpe_tier1_load_max : integer { modality SHALL }
  mpe_tier1_factor : number { modality SHALL }
  mpe_tier2_load_max : integer { modality SHALL }
  mpe_tier2_factor : number { modality SHALL }
  mpe_tier3_factor : number { modality SHALL }
}

instrument LoadCell {
  definition "Load cell."
  dimension accuracy_class {
    label "Accuracy Class"
    scope group
    payload_class accuracy-class-data
    values {
      C {
        label "Class C"
        payload { n_lc_min 500 n_lc_max 10000 p_lc_min 0.3 p_lc_max 0.8 mpe_tier1_load_max 500 mpe_tier1_factor 0.5 mpe_tier2_load_max 2000 mpe_tier2_factor 1 mpe_tier3_factor 1.5 }
      }
    }
  }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-typed-payload-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

const c152 = (dir: string) => checkPackage(dir).filter(i => i.check === 'C152');

describe('C152 payload-typed-by-class (the typed kernel R2)', () => {
  it('parses and round-trips payload_class and the class bridge', () => {
    const m = load(SOURCE);
    const dim = m.instruments[0]!.dimensions.find(
      d => d.id === 'accuracy_class',
    )!;
    assert.equal(dim.payloadClass, 'accuracy-class-data');
    const value = dim.values.find(v => v.id === 'C')!;
    assert.equal(value.payload['n_lc_min'], '500');
    const once = dump(load(SOURCE));
    assert.equal(once, dump(load(once)));
    assert.match(once, /payload_class accuracy-class-data/);
    assert.match(once, /payload \{ n_lc_min: "500"/);
  });

  it('a conforming typed payload is clean', () => {
    assert.deepEqual(c152(makePackage(SOURCE)), []);
  });

  it('an unresolvable class, an unknown field, and a missing payload are each named', () => {
    const issues = c152(
      makePackage(`
class d { a : integer { modality SHALL } }
instrument X {
  definition "X."
  dimension good {
    values { v1 { payload { a 1 } } }
    payload_class d
  }
  dimension wrong_class {
    values { v1 { payload { a 1 } } }
    payload_class nope
  }
  dimension wrong_field {
    values { v1 { payload { a 1 mystery 2 } } }
    payload_class d
  }
  dimension no_payload {
    values { v1 { label "L" } }
    payload_class d
  }
}
`),
    );
    const messages = issues.map(i => i.message).join('\n');
    assert.match(messages, /payload_class "nope" is not a declared class/);
    assert.match(
      messages,
      /payload field "mystery" is not a field of class "d"/,
    );
    assert.match(messages, /value v1 carries no payload/);
  });

  it('the attribute-side bridge resolves its class', () => {
    const issues = c152(
      makePackage(
        'class accuracy-class-data { n_lc_min : integer { modality SHALL } }' +
          '\nattribute_definition tiers { value_type QuantityValue class accuracy-class-data }',
      ),
    );
    assert.deepEqual(issues, []);
    const bad = c152(
      makePackage(
        'attribute_definition tiers { value_type QuantityValue class nowhere }',
      ),
    );
    assert.match(bad[0]!.message, /class "nowhere" is not a declared class/);
  });
});
