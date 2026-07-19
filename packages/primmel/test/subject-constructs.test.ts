// ─────────────────────────────────────────────────────────────────────
// W1b subject-chain constructs (Primmel v2, gap G1) — parse + round-trip.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

const PACKAGE = `
instrument LoadCell {
  extends MeasuringInstrumentModel
  definition "Measuring transducer that produces an output in response to an applied load."
  variant AnaloguePassiveLoadCell { definition "Output provides measurable data; may use passive electronics." }
  variant DigitalLoadCell { definition "Analogue-active including A/D conversion." }
  dimension accuracy_class {
    label "Accuracy class"
    scope group
    description "Metrological class with associated n_LC ranges"
    reference { doc "urn:oiml:pub:r:60-1:2021" clause "5.1.1" }
    values {
      A { description "Class A" payload { n_lc_limits: "50000-unlimited" } }
      B
      C
      D
    }
  }
  family_criteria {
    "same material or combination of materials"
    "same design of the measurement technique"
  }
  family_defaults {
    dimensions { construction technology }
    parameters { rated_output input_impedance }
  }
  model_group {
    definition "Set of Models having identical metrological characteristics."
    identical_characteristics { metrological_class n_lc y z temperature_rating }
    identical_attributes { accuracy_class n_lc y z t_min t_max }
  }
}

attribute_definition e_max {
  symbol "E_max"
  name "Maximum capacity"
  definition "Largest value of a quantity which may be applied to a load cell."
  source { doc "urn:oiml:pub:r:60-1:2021" clause "3.5.5" }
  quantity_kind mass
  unit kg
  value_type QuantityValue
  origin design-fixed
  scope model
  category metrological
  is_dimension false
}

attribute_definition humidity_symbol {
  symbol "humidity_symbol"
  name "Humidity symbol"
  definition "Symbol indicating the humidity conditions under which tested."
  source { doc "urn:oiml:pub:r:60-1:2021" clause "3.4.1" }
  value_type string
  origin declared
  scope model
  category administrative
  is_dimension true
  enum humidity_class
}

attribute_definition y {
  symbol "Y"
  name "Relative v_min"
  definition "Ratio E_max/v_min."
  quantity_kind dimensionless
  origin design-fixed
  scope group
  category metrological
  derived "ocl{(e_max - e_min) / v_min}"
}

capability digital {
  label "Digital"
  description "Digital signal processing capability"
  extends analogue-active
  requires strain-gauge
  has_parameters { output_signal software_identification }
  satisfies_requirements { /req/electronic/software }
  verified_by_tests { /conf/electronic-tests/software }
}

capability electronic {
  label "Electronic"
  abstract true
  requires strain-gauge
}

behavior creep {
  kind temporal
  stimulus force
  response "Change in load cell output with time under constant load."
  source { doc "urn:oiml:pub:r:60-1:2021" clause "3.7.1" }
  verified_by { /conf/metrological-tests/creep }
}

condition_set load-cell-reference {
  role reference
  entries {
    temperature { value 20 unit degC tolerance 1 }
    barometric_pressure { value 86 unit kPa tolerance 20 }
  }
}
`;

describe('W1b subject-chain constructs', () => {
  it('parses instrument with variants, dimensions, family criteria, model group', () => {
    const m = load(PACKAGE);
    const inst = m.instruments.find(x => x.id === 'LoadCell')!;
    assert.ok(inst);
    assert.equal(inst.extends, 'MeasuringInstrumentModel');
    assert.equal(inst.variants.length, 2);
    assert.equal(inst.variants[1].id, 'DigitalLoadCell');
    const dim = inst.dimensions[0];
    assert.equal(dim.id, 'accuracy_class');
    assert.equal(dim.scope, 'group');
    assert.deepEqual(dim.source, {
      doc: 'urn:oiml:pub:r:60-1:2021',
      clause: '5.1.1',
    });
    assert.equal(dim.values.length, 4);
    assert.equal(dim.values[0].description, 'Class A');
    assert.deepEqual(dim.values[0].payload, { n_lc_limits: '50000-unlimited' });
    assert.deepEqual(dim.values[1], {
      id: 'B',
      description: '',
      payload: {},
      implies: [],
    });
    assert.deepEqual(inst.familyCriteria, [
      'same material or combination of materials',
      'same design of the measurement technique',
    ]);
    assert.deepEqual(inst.familyDefaultDimensions, [
      'construction',
      'technology',
    ]);
    assert.deepEqual(inst.familyDefaultParameters, [
      'rated_output',
      'input_impedance',
    ]);
    assert.deepEqual(inst.modelGroup?.identicalCharacteristics, [
      'metrological_class',
      'n_lc',
      'y',
      'z',
      'temperature_rating',
    ]);
    assert.deepEqual(inst.modelGroup?.identicalAttributes, [
      'accuracy_class',
      'n_lc',
      'y',
      'z',
      't_min',
      't_max',
    ]);
  });

  it('parses attribute definitions with full fidelity', () => {
    const m = load(PACKAGE);
    const emax = m.attributeDefinitions.find(a => a.id === 'e_max')!;
    assert.equal(emax.symbol, 'E_max');
    assert.equal(emax.origin, 'design-fixed');
    assert.equal(emax.scope, 'model');
    assert.equal(emax.category, 'metrological');
    assert.equal(emax.isDimension, false);
    assert.deepEqual(emax.source, {
      doc: 'urn:oiml:pub:r:60-1:2021',
      clause: '3.5.5',
    });
    const hs = m.attributeDefinitions.find(a => a.id === 'humidity_symbol')!;
    assert.equal(hs.isDimension, true);
    assert.equal(hs.enumRef, 'humidity_class');
    const y = m.attributeDefinitions.find(a => a.id === 'y')!;
    assert.equal(y.derived, 'ocl{(e_max - e_min) / v_min}');
    assert.equal(y.scope, 'group');
  });

  it('parses capabilities incl. abstract + mixin lists', () => {
    const m = load(PACKAGE);
    const dig = m.capabilities.find(c => c.id === 'digital')!;
    assert.deepEqual(dig.extends, ['analogue-active']);
    assert.deepEqual(dig.requires, ['strain-gauge']);
    assert.deepEqual(dig.hasParameters, [
      'output_signal',
      'software_identification',
    ]);
    assert.deepEqual(dig.satisfiesRequirements, ['/req/electronic/software']);
    assert.deepEqual(dig.verifiedByTests, ['/conf/electronic-tests/software']);
    const abs = m.capabilities.find(c => c.id === 'electronic')!;
    assert.equal(abs.abstract, true);
  });

  it('parses behaviors and condition sets', () => {
    const m = load(PACKAGE);
    const creep = m.behaviors.find(b => b.id === 'creep')!;
    assert.equal(creep.kind, 'temporal');
    assert.equal(creep.stimulus, 'force');
    assert.deepEqual(creep.verifiedBy, ['/conf/metrological-tests/creep']);
    const cs = m.conditionSets.find(c => c.id === 'load-cell-reference')!;
    assert.equal(cs.role, 'reference');
    assert.deepEqual(cs.entries, [
      {
        quantityKind: 'temperature',
        value: '20',
        unit: 'degC',
        tolerance: '1',
      },
      {
        quantityKind: 'barometric_pressure',
        value: '86',
        unit: 'kPa',
        tolerance: '20',
      },
    ]);
  });

  it('round-trips the whole subject package losslessly (fixpoint)', () => {
    const m1 = load(PACKAGE);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.instruments, m1.instruments);
    assert.deepEqual(m2.attributeDefinitions, m1.attributeDefinitions);
    assert.deepEqual(m2.capabilities, m1.capabilities);
    assert.deepEqual(m2.behaviors, m1.behaviors);
    assert.deepEqual(m2.conditionSets, m1.conditionSets);
    assert.equal(dump(m2), dumped);
  });
});
