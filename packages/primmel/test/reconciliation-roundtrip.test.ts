import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

// Reconciliation round-trips (task 15b follow-up): the small grammar
// additions the converter needs so nothing it emits is silently dropped —
// dimension-value labels, calculation source blocks, condition_set source,
// applicability mapping commas, named subform_ref fields, escaped table
// cells.

describe('dimension value label', () => {
  const SRC = `instrument LoadCell {
    extends MeasuringInstrumentModel
    dimension technology {
      label "Technology"
      scope family
      values {
        analogue-passive { label "Analogue passive" description "No built-in electronics" }
        digital { label "Digital" }
        ir
      }
    }
  }
  `;

  it('parses value labels', () => {
    const m = load(SRC);
    const dim = m.instruments[0].dimensions[0];
    assert.equal(dim.values[0].label, 'Analogue passive');
    assert.equal(dim.values[0].description, 'No built-in electronics');
    assert.equal(dim.values[1].label, 'Digital');
    assert.equal(dim.values[1].description, '');
    assert.equal(dim.values[2].label, '');
  });

  it('dump round-trips value labels (fixpoint)', () => {
    const d1 = dump(load(SRC));
    assert.match(
      d1,
      /analogue-passive \{ label "Analogue passive" description "No built-in electronics" \}/,
    );
    assert.equal(dump(load(d1)), d1);
  });
});

describe('calculation + condition_set source blocks', () => {
  const SRC = `calculation conversionFactor {
    name "conversionFactor"
    identifier "/calc/conversion-factor"
    category metrological
    description "Computes the conversion factor f per R 60-3 2.1.2.4"
    inputs {
      avgIndicationAt75pct : number { unit "counts" }
    }
    output : number { unit "counts/v" name "conversion_factor_f" }
    expression "ocl{(avgIndicationAt75pct - indicationAtDmin) / (0.75 * n)}"
    source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1.2.4" }
  }

  condition_set load-cell-reference {
    role reference
    entries {
      temperature { value 20 unit "degC" tolerance 1 }
    }
    source { doc "urn:oiml:pub:r:60-2:2021" clause "1.2" }
  }
  `;

  it('parses the structured source provenance', () => {
    const m = load(SRC);
    assert.deepEqual(m.calculations[0].sourceRef, {
      doc: 'urn:oiml:pub:r:60-3:2021',
      clause: '2.1.2.4',
    });
    assert.deepEqual(m.conditionSets[0].source, {
      doc: 'urn:oiml:pub:r:60-2:2021',
      clause: '1.2',
    });
  });

  it('dump round-trips the source blocks (fixpoint)', () => {
    const d1 = dump(load(SRC));
    assert.match(
      d1,
      /source \{ doc "urn:oiml:pub:r:60-3:2021" clause "2\.1\.2\.4" \}/,
    );
    assert.match(
      d1,
      /source \{ doc "urn:oiml:pub:r:60-2:2021" clause "1\.2" \}/,
    );
    assert.equal(dump(load(d1)), d1);
  });
});

describe('sentence-level provenance on calculation + conformance_test (TODO.roadmap/26, review I1)', () => {
  // The two inline parsers (calculation `source`, conformance_test
  // `reference`) historically read only doc/clause while their dumpers
  // already emitted the sentence sub-address `fragment` — a sentence
  // binding on either construct was silently dropped on parse. Pin the
  // restored parse/dump symmetry.
  const SRC = `calculation errorEnvelope {
    name "errorEnvelope"
    identifier "/calc/error-envelope"
    output : number { unit "g" }
    expression "ocl{abs(indication - reference)}"
    source { doc "urn:oiml:pub:r:60-1:2021" clause "2.2" fragment "s1" }
  }

  conformance_test /conf/metrological/mpe-envelope {
    name "MPE envelope"
    type Calculation
    reference { doc "urn:oiml:pub:r:60-1:2021" clause "5.3.2" fragment "s2" }
  }
  `;

  it('parses the sentence sub-address (fragment) on both constructs', () => {
    const m = load(SRC);
    assert.deepEqual(m.calculations[0].sourceRef, {
      doc: 'urn:oiml:pub:r:60-1:2021',
      clause: '2.2',
      fragment: 's1',
    });
    assert.deepEqual(m.conformanceTests[0].sourceRefs, [
      { doc: 'urn:oiml:pub:r:60-1:2021', clause: '5.3.2', fragment: 's2' },
    ]);
  });

  it('dump round-trips the fragment on both constructs (fixpoint)', () => {
    const d1 = dump(load(SRC));
    assert.match(
      d1,
      /source \{ doc "urn:oiml:pub:r:60-1:2021" clause "2\.2" fragment "s1" \}/,
    );
    assert.match(
      d1,
      /reference \{ doc "urn:oiml:pub:r:60-1:2021" clause "5\.3\.2" fragment "s2" \}/,
    );
    const m2 = load(d1);
    assert.deepEqual(m2.calculations[0], load(SRC).calculations[0]);
    assert.deepEqual(m2.conformanceTests[0], load(SRC).conformanceTests[0]);
    assert.equal(dump(m2), d1);
  });
});

describe('applicability mapping dump', () => {
  const SRC = `form F {
    name "F"
    applicability {
      accuracy_class: [B, C, D]
      runs_per_measurement: { B: 5, C: 3, D: 3 }
    }
  }
  `;

  it('mapping entries re-parse identically (comma-separated pairs)', () => {
    const m = load(SRC);
    assert.deepEqual(m.forms[0].applicability[1].mapping, {
      B: '5',
      C: '3',
      D: '3',
    });
    const d1 = dump(m);
    assert.match(d1, /runs_per_measurement: \{ B: 5, C: 3, D: 3 \}/);
    assert.equal(dump(load(d1)), d1);
  });
});

describe('named subform_ref field dump', () => {
  const SRC = `form F {
    name "F"
    field measurements : array {
      label "Measurements"
      required true
      min_items 2
      subform_ref cgm-point { }
    }
  }
  `;

  it('a named field keeps its properties alongside the subform ref', () => {
    const m = load(SRC);
    const f = m.forms[0].fields[0];
    assert.equal(f.name, 'measurements');
    assert.equal(f.subformRef!.subformId, 'cgm-point');
    assert.equal(f.minItems, 2);
    assert.equal(f.required, true);
    const d1 = dump(m);
    assert.match(d1, /field measurements : array \{/);
    assert.match(d1, /subform_ref cgm-point \{ \}/);
    assert.match(d1, /min_items 2/);
    assert.equal(dump(load(d1)), d1);
  });
});

describe('table data cell escaping', () => {
  const SRC = `table notes {
    columns "k, v"
    data {
      "a \\"quoted\\" cell" "back\\\\slash"
      plain 42
    }
  }
  `;

  it('escaped quotes and backslashes parse and re-dump stably', () => {
    const m = load(SRC);
    const t = m.tables[0];
    assert.equal(t.data[0][0], 'a "quoted" cell');
    assert.equal(t.data[0][1], 'back\\slash');
    assert.equal(t.data[1][0], 'plain');
    const d1 = dump(m);
    assert.match(d1, /"a \\"quoted\\" cell" "back\\\\slash"/);
    assert.equal(dump(load(d1)), d1);
  });
});

describe('table repeated source blocks', () => {
  // A table bound to several fragments emits one source {} block per
  // binding (TODO.roadmap/24); the ser-des collects all of them like the
  // calculation/conformanceTest/requirement constructs.
  const SRC = `table mpe_tiers {
    title "MPE tiers"
    columns "tier, factor"
    source { doc "urn:oiml:pub:r:60-1:2021" clause "5.4" }
    source { doc "urn:oiml:pub:r:60-1:2021" clause "table-2" }
    data {
      "wide" "1.0"
    }
  }
  `;

  it('parses every source block (sourceRef = first)', () => {
    const m = load(SRC);
    const t = m.tables[0];
    assert.deepEqual(t.sourceRef, {
      doc: 'urn:oiml:pub:r:60-1:2021',
      clause: '5.4',
    });
    assert.deepEqual(t.sourceRefs, [
      { doc: 'urn:oiml:pub:r:60-1:2021', clause: '5.4' },
      { doc: 'urn:oiml:pub:r:60-1:2021', clause: 'table-2' },
    ]);
  });

  it('dump round-trips all source blocks (fixpoint)', () => {
    const d1 = dump(load(SRC));
    assert.match(
      d1,
      /source \{ doc "urn:oiml:pub:r:60-1:2021" clause "5\.4" \}\n {2}source \{ doc "urn:oiml:pub:r:60-1:2021" clause "table-2" \}/,
    );
    const m2 = load(d1);
    assert.deepEqual(m2.tables[0], load(SRC).tables[0]);
    assert.equal(dump(m2), d1);
  });
});

describe('conformance_test binds_to (TODO.roadmap/47)', () => {
  const SRC = `conformance_test /conf/examinations/inscriptions {
    name "Inscriptions examination"
    type Inspection
    targets { /req/technical/mandatory-markings /req/technical/class-designation }
    binds_to { model.aspects.markings }
  }
  `;

  it('parses the HAS-inventory inspection targets', () => {
    const m = load(SRC);
    const t = m.conformanceTests[0];
    assert.deepEqual(t.targets, [
      '/req/technical/mandatory-markings',
      '/req/technical/class-designation',
    ]);
    assert.deepEqual(t.bindsTo, ['model.aspects.markings']);
  });

  it('dump round-trips binds_to (fixpoint)', () => {
    const d1 = dump(load(SRC));
    assert.match(d1, /binds_to \{\n {4}model\.aspects\.markings\n {2}\}/);
    const m2 = load(d1);
    assert.deepEqual(m2.conformanceTests[0], load(SRC).conformanceTests[0]);
    assert.equal(dump(m2), d1);
  });
});
