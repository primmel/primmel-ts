// ─────────────────────────────────────────────────────────────────────
// W1b subject-chain constructs (Primmel v2, gap G1) — parse + round-trip.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';
import { attributeDefinitionDatumView } from '../src/ser-des/config/subject';

const PACKAGE = `
instrument LoadCell {
  extends MeasuringInstrumentModel
  definition { Measuring transducer that produces an output in response to an applied load. }
  dimension technology {
    label "Technology"
    scope group
    values {
      analogue-passive { description "Output provides measurable data; may use passive electronics." }
      digital { description "Analogue-active including A/D conversion." }
    }
  }
  dimension accuracy_class {
    label "Accuracy class"
    scope group
    description "Metrological class with associated n_LC ranges"
    ref derives-from "urn:oiml:pub:r:60-1:2021#clause-5.1.1"
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
    definition { Set of Models having identical metrological characteristics. }
    identical_characteristics { metrological_class n_lc y z temperature_rating }
    identical_attributes { accuracy_class n_lc y z t_min t_max }
  }
}

attribute_definition e_max {
  symbol "E_max"
  name "Maximum capacity"
  definition { Largest value of a quantity which may be applied to a load cell. }
  ref derives-from "urn:oiml:pub:r:60-1:2021#clause-3.5.5"
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
  definition { Symbol indicating the humidity conditions under which tested. }
  ref derives-from "urn:oiml:pub:r:60-1:2021#clause-3.4.1"
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
  definition { Ratio E_max/v_min. }
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
  response { Change in load cell output with time under constant load. }
  ref derives-from "urn:oiml:pub:r:60-1:2021#clause-3.7.1"
  verified_by { /conf/metrological-tests/creep }
}

`;

describe('W1b subject-chain constructs', () => {
  it('refuses the retired subject variant facet, naming the dimension doctrine', () => {
    assert.throws(
      () =>
        load('instrument X { variant digital { definition { Digital. } } }'),
      /the variant facet is retired \(TODO\.lang-gaps\/06\)/,
    );
  });

  it('parses instrument with dimensions, family criteria, model group', () => {
    const m = load(PACKAGE);
    const inst = m.instruments.find(x => x.id === 'LoadCell')!;
    assert.ok(inst);
    assert.equal(inst.extends, 'MeasuringInstrumentModel');
    const dim = inst.dimensions.find(x => x.id === 'accuracy_class')!;
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
      label: '',
      description: '',
      payload: {},
      implies: [],
      source: null,
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

  it('parses behaviors', () => {
    const m = load(PACKAGE);
    const creep = m.behaviors.find(b => b.id === 'creep')!;
    assert.equal(creep.kind, 'temporal');
    assert.equal(creep.stimulus, 'force');
    assert.deepEqual(creep.verifiedBy, ['/conf/metrological-tests/creep']);
    const m1 = load(dump(m));
    assert.deepEqual(dump(m1), dump(m));
  });

  it('dumps the attribute definition vocabulary facets (note, enum_values, cites)', () => {
    // The editor window-2 pin: note, enum_values, and the cites fold
    // (referenceIds) all parsed but never dumped — a load→dump cycle
    // silently dropped all three.
    const src = `attribute_definition state {
  name "Lifecycle state"
  ref cites "urn:oiml:pub:b:18:2025"
  value_type enum
  enum_values { DRAFT ISSUED "under review" }
  note "The vocabulary the attribute surface authors."
}
`;
    const m = load(src);
    const a = m.attributeDefinitions[0];
    assert.equal(a.note, 'The vocabulary the attribute surface authors.');
    assert.deepEqual(a.enumValues, ['DRAFT', 'ISSUED', 'under review']);
    assert.deepEqual(a.referenceIds, ['urn:oiml:pub:b:18:2025']);
    const first = dump(m);
    assert.match(first, /enum_values \{ DRAFT ISSUED "under review" \}/);
    assert.match(
      first,
      /note "The vocabulary the attribute surface authors\."/,
    );
    assert.match(first, /ref cites "urn:oiml:pub:b:18:2025"/);
    const reparsed = load(first);
    assert.deepEqual(reparsed.attributeDefinitions, m.attributeDefinitions);
    assert.equal(dump(reparsed), first);
  });
});

// ── The datum unification's fourth rung (TODO.lang-gaps/04, spec
// [[datum-unification]]): the attribute_definition is the MODEL plane of
// the datum substrate — the inline `datum { … }` block, the C192
// coherence leg, and the datum view accessor. ──
describe('attribute_definition datum rung (TODO.lang-gaps/04 PR 4)', () => {
  const DATUM_ATTR = `
attribute_definition e_max {
  symbol "E_max"
  name "Maximum capacity"
  quantity_kind mass
  unit t
  value_type QuantityValue
  origin design-fixed
  scope model
  datum { type QuantityValue unit t quantity_kind mass origin design-fixed scope model }
  category metrological
}
`;

  function makePackage(body: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'primmel-attrdef-'));
    writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
    mkdirSync(join(dir, 'model'));
    writeFileSync(join(dir, 'model', 'package.prl'), body);
    return dir;
  }

  it('parses the inline datum block; the flat facets stand beside it', () => {
    const m = load(DATUM_ATTR);
    const a = m.attributeDefinitions[0]!;
    assert.equal(a.valueType, 'QuantityValue');
    assert.equal(a.unit, 't');
    assert.equal(a.origin, 'design-fixed');
    assert.deepEqual(a.datum, {
      type: 'QuantityValue',
      unit: 't',
      quantityKind: 'mass',
      origin: 'design-fixed',
      scope: 'model',
    });
    // The plane extras are untouched — extras on the substrate.
    assert.equal(a.category, 'metrological');
  });

  it('the datum view accessor resolves the block over the flat facets', () => {
    const m = load(DATUM_ATTR);
    assert.deepEqual(attributeDefinitionDatumView(m.attributeDefinitions[0]!), {
      type: 'QuantityValue',
      unit: 't',
      quantityKind: 'mass',
      origin: 'design-fixed',
      scope: 'model',
    });
    // A block silent on a facet lets the flat facet stand.
    const partial = load(`
attribute_definition t_min {
  name "Minimum temperature"
  value_type QuantityValue
  unit "degC"
  origin design-fixed
  datum { unit k }
}
`).attributeDefinitions[0]!;
    assert.deepEqual(attributeDefinitionDatumView(partial), {
      type: 'QuantityValue',
      unit: 'k',
      quantityKind: '',
      origin: 'design-fixed',
      scope: '',
    });
    // No block: the flat facets alone are the datum view.
    const plain = load(
      'attribute_definition p { value_type string origin declared scope model }',
    ).attributeDefinitions[0]!;
    assert.deepEqual(attributeDefinitionDatumView(plain), {
      type: 'string',
      unit: '',
      quantityKind: '',
      origin: 'declared',
      scope: 'model',
    });
  });

  it('round-trips the authored spelling (the codec fixpoint)', () => {
    const out = dump(load(DATUM_ATTR));
    // The block spelling is preserved (never normalized away, never
    // hoisted to a top-level datum); the facet defaults normalize away —
    // `origin declared` is omitted, the same convention the datum
    // construct's dump holds.
    const once = dump(load(out));
    assert.equal(once, out);
    assert.ok(
      out.includes(
        '  datum { type QuantityValue unit t quantity_kind mass origin design-fixed scope model }\n',
      ),
    );
    // The multi-line authored block normalizes to the single-line form
    // and stabilizes there.
    const multi = `
attribute_definition n_lc {
  name "Number of load cells"
  value_type integer
  origin declared
  datum {
    type integer
    origin declared
    scope model
  }
}
`;
    const first = dump(load(multi));
    assert.ok(first.includes('  datum { type integer scope model }\n'));
    assert.equal(dump(load(first)), first);
    // A block-less attribute dumps exactly as before the rung — no
    // invented `datum {` line.
    assert.ok(!dump(load(PACKAGE)).includes('datum {'));
  });

  it('rejects an unknown origin inside the block (fail-closed)', () => {
    assert.throws(
      () =>
        load(
          'attribute_definition b { value_type string datum { origin asserted } }',
        ),
      /Unknown datum origin "asserted"/,
    );
  });

  it('rejects a datum spelling with a stray value (no id, no parg)', () => {
    assert.throws(
      () =>
        load(
          'attribute_definition b { value_type string datum QuantityValue }',
        ),
      /the inline datum block is "datum \{ … \}"/,
    );
  });

  it('C192: a contradiction between the block and a flat facet fires', () => {
    const typeIssues = checkPackage(
      makePackage(
        'attribute_definition b { value_type string datum { type number } }',
      ),
    ).filter(i => i.check === 'C192');
    assert.equal(typeIssues.length, 1);
    assert.match(
      typeIssues[0]!.message,
      /block's type "number" contradicts the flat value_type "string"/,
    );
    const originIssues = checkPackage(
      makePackage(
        'attribute_definition b { origin design-fixed datum { origin observed } }',
      ),
    ).filter(i => i.check === 'C192');
    assert.equal(originIssues.length, 1);
    assert.match(
      originIssues[0]!.message,
      /block's origin "observed" contradicts the flat origin "design-fixed"/,
    );
    const scopeIssues = checkPackage(
      makePackage('attribute_definition b { scope model datum { scope run } }'),
    ).filter(i => i.check === 'C192');
    assert.equal(scopeIssues.length, 1);
    assert.match(
      scopeIssues[0]!.message,
      /block's scope "run" contradicts the flat scope "model"/,
    );
  });

  it('C192: agreement, facet-silent blocks, and block-less attributes stay silent', () => {
    const body = `
${PACKAGE}
attribute_definition agreeing {
  value_type string
  datum { type string }
}
attribute_definition silent {
  origin design-fixed
  datum { unit kg origin design-fixed }
}
attribute_definition extends_flat {
  value_type number
  datum { unit v }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C192',
    );
    assert.deepEqual(issues, []);
  });
});
