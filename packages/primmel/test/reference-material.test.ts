import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

// reference_material construct (data/schemas/reference-materials.yaml,
// TODO.refactor/10 L7): certified reference materials with machine-checked
// constraints bound to run evidence.

const SRC = `reference_material cgm {
  kind certified_gas_mixture
  name "Certified gas mixture (CGM)"
  definition "Gas mixture with certified composition used as the measurement reference."
  source { doc "urn:oiml:pub:r:144-1:2013" clause "annex-a" }
  identity_fields {
    field composition { description "Component(s) and nominal concentrations" }
    field certified_value { description "Certified concentration" unit "ppm" required true }
    field expiry { description "Expiry date of the certificate" type date }
  }
  constraints {
    constraint uncertainty_ratio_to_mpe {
      description "The CGM uncertainty shall not exceed one third of the MPE."
      rule "uncertainty <= mpe_at_point / 3"
      evidence { uncertainty: cgm_uncertainty mpe_at_point: mpe }
      override { rule "uncertainty <= mpe_at_point / 2" by issuing_authority evidence cgm_uncertainty_override_approved }
      on_violation invalidate
      source { doc "urn:oiml:pub:r:144-1:2013" clause "7.2.2.2" }
    }
    constraint traceability {
      description "The certificate shall be traceable."
      rule "traceability_recorded = true"
      on_violation invalidate
    }
  }
}
`;

describe('reference_material construct', () => {
  it('parses identity and provenance', () => {
    const m = load(SRC);
    const rm = m.referenceMaterials.find(r => r.id === 'cgm')!;
    assert.equal(rm.kind, 'certified_gas_mixture');
    assert.equal(rm.name, 'Certified gas mixture (CGM)');
    assert.match(rm.definition, /certified composition/);
    assert.deepEqual(rm.source, {
      doc: 'urn:oiml:pub:r:144-1:2013',
      clause: 'annex-a',
    });
  });

  it('parses identity fields', () => {
    const m = load(SRC);
    const fields = m.referenceMaterials[0].identityFields;
    assert.equal(fields.length, 3);
    assert.deepEqual(fields[0], {
      name: 'composition',
      description: 'Component(s) and nominal concentrations',
      unit: '',
      type: '',
      required: false,
    });
    assert.deepEqual(fields[1], {
      name: 'certified_value',
      description: 'Certified concentration',
      unit: 'ppm',
      type: '',
      required: true,
    });
    assert.equal(fields[2].type, 'date');
  });

  it('parses constraints with evidence, override, and source', () => {
    const m = load(SRC);
    const cs = m.referenceMaterials[0].constraints;
    assert.equal(cs.length, 2);
    const c0 = cs[0];
    assert.equal(c0.id, 'uncertainty_ratio_to_mpe');
    assert.equal(c0.rule, 'uncertainty <= mpe_at_point / 3');
    assert.deepEqual(c0.evidence, {
      uncertainty: 'cgm_uncertainty',
      mpe_at_point: 'mpe',
    });
    assert.deepEqual(c0.override, {
      rule: 'uncertainty <= mpe_at_point / 2',
      by: 'issuing_authority',
      evidence: 'cgm_uncertainty_override_approved',
    });
    assert.equal(c0.onViolation, 'invalidate');
    assert.deepEqual(c0.source, {
      doc: 'urn:oiml:pub:r:144-1:2013',
      clause: '7.2.2.2',
    });
    const c1 = cs[1];
    assert.equal(c1.override, null);
    assert.equal(c1.source, null);
    assert.deepEqual(c1.evidence, {});
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('reference_material cgm {'));
    assert.ok(dumped.includes('field certified_value {'));
    assert.ok(dumped.includes('constraint uncertainty_ratio_to_mpe {'));
    assert.ok(dumped.includes('on_violation invalidate'));

    const m2 = load(dumped);
    assert.deepEqual(m2.referenceMaterials, m1.referenceMaterials);
    assert.equal(dump(m2), dumped);
  });

  it('handles a material without optional blocks', () => {
    const m1 = load(`reference_material ref_speed {
      kind reference_speed_meter
      name "Reference speed meter"
    }`);
    const rm = m1.referenceMaterials[0];
    assert.equal(rm.definition, '');
    assert.equal(rm.source, null);
    assert.deepEqual(rm.identityFields, []);
    assert.deepEqual(rm.constraints, []);
    const m2 = load(dump(m1));
    assert.deepEqual(m2.referenceMaterials, m1.referenceMaterials);
  });
});
