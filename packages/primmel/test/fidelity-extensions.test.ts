import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

// Fidelity extensions for the existing constructs (§5–§11): requirement,
// conformance_test, table, symbol, calculation, instrument, and form
// additions mapping the OIML SMART data schemas without loss.

// ── §5 requirement + limit ───────────────────────────────────────────

const REQ_SRC = `requirement /req/metrological/mdlo {
  name "Minimum dead load output"
  statement "The MDLO output shall be normalized."
  guidance "Applies to digital load cells only."
  binds_to { model.parameters.mdlo }
  subjects {
    subject 1 { entity_id "dimensions.p_LC" label "Apportioning factor" }
    subject 2 { entity_id "parameters.n_lc" label "Number of intervals" }
  }
  parameters {
    param n_runs: integer {
      description "Number of runs"
      unit "1"
      default 20
      range { min 0 max 100 }
      enum_values { a b }
    }
  }
  limit {
    expression "ocl{mdlo_normalized <= p_lc}"
    uses { mdlo_normalized p_lc }
    modality should
    relative_to reference_speed
    notes "Ratio limit against the reference speed"
    accepts {
      verdict mdlo_normalized
      op lte
      limit "ocl{p_lc}"
    }
  }
  channel measurand_components
  obligation should
  verification { method testing }
  dependencies { /req/metrological/mpe /req/general/terminology }
  source { doc "urn:oiml:pub:r:60-1:2021" clause "5.6.3.1" }
}
`;

describe('requirement fidelity extensions', () => {
  it('parses guidance, subjects, parameters, obligation, dependencies', () => {
    const m = load(REQ_SRC);
    const r = m.requirements[0];
    assert.equal(r.guidance, 'Applies to digital load cells only.');
    assert.deepEqual(r.subjects, [
      { slot: 1, entityId: 'dimensions.p_LC', label: 'Apportioning factor' },
      { slot: 2, entityId: 'parameters.n_lc', label: 'Number of intervals' },
    ]);
    assert.deepEqual(r.parameters, [
      {
        name: 'n_runs',
        type: 'integer',
        description: 'Number of runs',
        unit: '1',
        defaultValue: '20',
        hasDefault: true,
        rangeMin: '0',
        rangeMax: '100',
        hasRange: true,
        enumValues: ['a', 'b'],
      },
    ]);
    assert.equal(r.obligation, 'should');
    assert.deepEqual(r.dependencies, [
      '/req/metrological/mpe',
      '/req/general/terminology',
    ]);
  });

  it('parses limit modality, relative_to, notes, and accepts', () => {
    const m = load(REQ_SRC);
    const l = m.requirements[0].limit!;
    assert.equal(l.modality, 'should');
    assert.equal(l.relativeTo, 'reference_speed');
    assert.equal(l.notes, 'Ratio limit against the reference speed');
    assert.deepEqual(l.accepts, {
      verdict: 'mdlo_normalized',
      op: 'lte',
      limit: 'ocl{p_lc}',
      sourceDiscrepancy: null,
    });
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(REQ_SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('guidance "Applies to digital load cells only."'));
    assert.ok(dumped.includes('param n_runs: integer {'));
    assert.ok(dumped.includes('modality should'));
    assert.ok(dumped.includes('obligation should'));
    const m2 = load(dumped);
    assert.deepEqual(m2.requirements, m1.requirements);
    assert.equal(dump(m2), dumped);
  });
});

// ── §6 conformance_test ──────────────────────────────────────────────

const CT_SRC = `conformance_test ErrorTest {
  name "Error determination"
  type Testing
  guidance "Run at reference conditions."
  applicability { accuracy_class: [A, B] match all }
  procedure {
    1 "Apply test loads" outputs { e_l e_r mpe }
    2 "Record indications"
  }
  procedure_steps { check_test_conditions insert_load_cell }
  reference_materials { cgm }
  acceptance_criteria {
    type composite
    description "Composite of partial tests"
    pass_if "ocl{all_passed}"
    criterion partial_mpe {
      pass_if "ocl{abs(e_l) <= mpe}"
      target /req/metrological/mpe
      criterion I/MPE
      optional true
      description "Partial MPE check"
      reference "urn:oiml:pub:r:60-2:2021#clause-2.5"
    }
  }
  dependencies { /conf/metrological-tests/warm-up }
  instances { by accuracy_class values { A { n_runs: 5 } B { n_runs: 5 } C { n_runs: 3 } } }
}
`;

describe('conformance_test fidelity extensions', () => {
  it('parses guidance, applicability, procedure steps + outputs', () => {
    const m = load(CT_SRC);
    const ct = m.conformanceTests[0];
    assert.equal(ct.guidance, 'Run at reference conditions.');
    assert.deepEqual(ct.applicability, [
      { dimension: 'accuracy_class', values: ['A', 'B'], mapping: null, match: 'all' },
    ]);
    assert.deepEqual(ct.procedure[0], {
      order: 1,
      action: 'Apply test loads',
      outputs: ['e_l', 'e_r', 'mpe'],
    });
    assert.deepEqual(ct.procedure[1], {
      order: 2,
      action: 'Record indications',
      outputs: [],
    });
    assert.deepEqual(ct.procedureSteps, [
      'check_test_conditions',
      'insert_load_cell',
    ]);
    assert.deepEqual(ct.referenceMaterials, ['cgm']);
    assert.deepEqual(ct.dependencies, ['/conf/metrological-tests/warm-up']);
  });

  it('parses block-level and per-criterion acceptance extensions', () => {
    const m = load(CT_SRC);
    const ct = m.conformanceTests[0];
    assert.equal(ct.acceptanceCriteriaType, 'composite');
    assert.equal(ct.acceptanceCriteriaDescription, 'Composite of partial tests');
    assert.equal(ct.acceptancePassIf, 'ocl{all_passed}');
    assert.deepEqual(ct.acceptanceCriteria[0], {
      item: 'partial_mpe',
      passIf: 'ocl{abs(e_l) <= mpe}',
      requirementId: '/req/metrological/mpe',
      criterion: 'I/MPE',
      optional: true,
      description: 'Partial MPE check',
      reference: 'urn:oiml:pub:r:60-2:2021#clause-2.5',
    });
  });

  it('parses instances with numeric values', () => {
    const m = load(CT_SRC);
    const inst = m.conformanceTests[0].instances!;
    assert.equal(inst.by, 'accuracy_class');
    assert.deepEqual(inst.values, {
      A: { n_runs: 5 },
      B: { n_runs: 5 },
      C: { n_runs: 3 },
    });
    assert.equal(typeof inst.values.C.n_runs, 'number');
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(CT_SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('procedure_steps { check_test_conditions insert_load_cell }'));
    assert.ok(dumped.includes('outputs { e_l e_r mpe }'));
    assert.ok(dumped.includes('type composite'));
    assert.ok(dumped.includes('instances { by accuracy_class values {'));
    const m2 = load(dumped);
    assert.deepEqual(m2.conformanceTests, m1.conformanceTests);
    assert.equal(dump(m2), dumped);
  });
});

// ── §7 table ─────────────────────────────────────────────────────────

const TABLE_SRC = `table mpe_table {
  title "MPE tiers"
  description "MPE tier breakpoints per accuracy class"
  columns {
    accuracy_class: string
    load_min: number "v"
    load_max: number "v"
    limit_factor: number
  }
  source { doc "urn:oiml:pub:r:60-1:2021" clause "5.3" }
  overrides { field_automatic { condition statistical_analysis by evaluator } }
  profiles {
    profile mpe_tiers {
      description "MPE tier breakpoints"
      dimension accuracy_class
      unit "v"
      type range
      binding {
        A: [{ min: 0 max: 50000 factor: 0.5 } { min: 50000 max: 200000 factor: 1.0 } { min: 200000 factor: 1.5 }]
        B: [{ min: 0 max: 5000 factor: 0.5 }]
      }
    }
    profile test_runs {
      dimension accuracy_class
      type integer
      binding { A: 5 B: 5 C: 3 D: 3 }
    }
    profile n_LC_range {
      dimension accuracy_class
      type range
      binding { A: { min: 50000 } B: { min: 5000 max: 100000 } }
    }
  }
}
`;

describe('table fidelity extensions', () => {
  it('parses description, source, and overrides', () => {
    const m = load(TABLE_SRC);
    const t = m.tables[0];
    assert.equal(t.description, 'MPE tier breakpoints per accuracy class');
    assert.deepEqual(t.sourceRef, {
      doc: 'urn:oiml:pub:r:60-1:2021',
      clause: '5.3',
    });
    assert.deepEqual(t.overrides, {
      field_automatic: { condition: 'statistical_analysis', by: 'evaluator' },
    });
  });

  it('parses typed column declarations', () => {
    const m = load(TABLE_SRC);
    const t = m.tables[0];
    assert.deepEqual(t.columnDefs, [
      { name: 'accuracy_class', type: 'string', unit: '' },
      { name: 'load_min', type: 'number', unit: 'v' },
      { name: 'load_max', type: 'number', unit: 'v' },
      { name: 'limit_factor', type: 'number', unit: '' },
    ]);
    assert.equal(t.columns, '');
  });

  it('parses structured profiles with scalar, object, and array bindings', () => {
    const m = load(TABLE_SRC);
    const defs = m.tables[0].profileDefs!;
    assert.equal(defs.length, 3);

    const tiers = defs[0];
    assert.equal(tiers.name, 'mpe_tiers');
    assert.equal(tiers.description, 'MPE tier breakpoints');
    assert.equal(tiers.dimension, 'accuracy_class');
    assert.equal(tiers.unit, 'v');
    assert.equal(tiers.type, 'range');
    assert.deepEqual(tiers.binding.A, [
      { min: 0, max: 50000, factor: 0.5 },
      { min: 50000, max: 200000, factor: 1 },
      { min: 200000, factor: 1.5 },
    ]);
    assert.deepEqual(tiers.binding.B, [{ min: 0, max: 5000, factor: 0.5 }]);

    assert.deepEqual(defs[1].binding, { A: 5, B: 5, C: 3, D: 3 });
    assert.deepEqual(defs[2].binding, {
      A: { min: 50000 },
      B: { min: 5000, max: 100000 },
    });
  });

  it('keeps the legacy columns string and profiles forms working', () => {
    const m = load(`table legacy {
      title "Legacy"
      columns "a, b, c"
      profiles { accuracy_class { A { "50000-unlimited" } } }
    }`);
    const t = m.tables[0];
    assert.equal(t.columns, 'a, b, c');
    assert.equal(t.columnDefs, null);
    assert.equal(
      String((t.profiles as any).accuracy_class.A),
      '"50000-unlimited"',
    );
    const m2 = load(dump(m));
    assert.deepEqual(m2.tables, m.tables);
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(TABLE_SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('columns {\n    accuracy_class: string'));
    assert.ok(dumped.includes('profile mpe_tiers {'));
    assert.ok(dumped.includes('overrides { field_automatic {'));
    const m2 = load(dumped);
    assert.deepEqual(m2.tables, m1.tables);
    assert.equal(dump(m2), dumped);
  });
});

// ── §8 symbol ────────────────────────────────────────────────────────

const SYMBOL_SRC = `symbol e_l {
  name "Load cell error"
  definition "Error of indication"
  type number
  unit "v"
  kind observable
  quantity_kind mass
  origin measured
  legacy_id E_l
  attribute e_l
  calculation load_cell_error
  profile mpe_tiers
  source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1" }
  formula { display "E = I − L" expression "ocl{indication - load}" inputs { indication load } }
  note "First note"
  note "Second note"
}
`;

describe('symbol fidelity extensions', () => {
  it('parses the new scalar links and provenance', () => {
    const m = load(SYMBOL_SRC);
    const s = m.symbols[0];
    assert.equal(s.kind, 'observable');
    assert.equal(s.quantityKind, 'mass');
    assert.equal(s.origin, 'measured');
    assert.equal(s.legacyId, 'E_l');
    assert.equal(s.attribute, 'e_l');
    assert.equal(s.calculation, 'load_cell_error');
    assert.equal(s.profile, 'mpe_tiers');
    assert.deepEqual(s.sourceRef, {
      doc: 'urn:oiml:pub:r:60-3:2021',
      clause: '2.1',
    });
  });

  it('parses formula and repeated notes', () => {
    const m = load(SYMBOL_SRC);
    const s = m.symbols[0];
    assert.deepEqual(s.formula, {
      display: 'E = I − L',
      expression: 'ocl{indication - load}',
      inputs: ['indication', 'load'],
    });
    assert.deepEqual(s.notes, ['First note', 'Second note']);
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(SYMBOL_SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('kind observable'));
    assert.ok(dumped.includes('legacy_id E_l'));
    assert.ok(dumped.includes('formula {'));
    const m2 = load(dumped);
    assert.deepEqual(m2.symbols, m1.symbols);
    assert.equal(dump(m2), dumped);
  });
});

// ── §9 calculation ───────────────────────────────────────────────────

const CALC_SRC = `calculation mpe_absolute {
  name "Absolute MPE"
  identifier "/calc/mpe/absolute"
  description "Absolute MPE at the test point"
  inputs {
    p_lc : number { unit "1" }
  }
  output : number { unit "v" name "MPE" description "Maximum permissible error" }
  expression "ocl{p_lc * abs(load)}"
  params { accuracy_class p_lc }
  lookup { key accuracy_class variable load multiplier p_lc }
  profile profiles.mpe_tiers
}

calculation mpe_lookup {
  name "MPE lookup"
  type table_lookup
  lookup { key accuracy_class variable load multiplier p_lc }
}
`;

describe('calculation fidelity extensions', () => {
  it('parses identifier, params, lookup, profile, output name/description', () => {
    const m = load(CALC_SRC);
    const c = m.calculations[0];
    assert.equal(c.identifier, '/calc/mpe/absolute');
    assert.deepEqual(c.params, ['accuracy_class', 'p_lc']);
    assert.deepEqual(c.lookup, {
      key: 'accuracy_class',
      variable: 'load',
      multiplier: 'p_lc',
    });
    assert.equal(c.profile, 'profiles.mpe_tiers');
    assert.equal(c.output.name, 'MPE');
    assert.equal(c.output.description, 'Maximum permissible error');
  });

  it('omits an empty expression in dump', () => {
    const m1 = load(CALC_SRC);
    const dumped = dump(m1);
    const lookupBlock = dumped.slice(dumped.indexOf('calculation mpe_lookup'));
    assert.ok(!lookupBlock.includes('expression'));
    assert.equal(m1.calculations[1].expression, '');
    const m2 = load(dump(m1));
    assert.deepEqual(m2.calculations, m1.calculations);
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(CALC_SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('identifier "/calc/mpe/absolute"'));
    assert.ok(dumped.includes('lookup { key accuracy_class'));
    assert.ok(dumped.includes('profile profiles.mpe_tiers'));
    const m2 = load(dumped);
    assert.deepEqual(m2.calculations, m1.calculations);
    assert.equal(dump(m2), dumped);
  });
});

// ── §10 instrument / subject ─────────────────────────────────────────

const INST_SRC = `instrument LoadCell {
  extends MeasuringInstrumentModel
  measurand_kind force
  definition "Load cell as a measuring instrument"
  note "Editorial instrument note"
  source { doc "urn:oiml:pub:r:60-1:2021" clause "3.1" }
  variant digital {
    name "Digital load cell"
    definition "Load cell with digital output"
    note "Variant note"
    source { doc "urn:oiml:pub:r:60-1:2021" clause "3.1.3.3" }
  }
  dimension accuracy_class {
    label "Accuracy class"
    scope group
    values {
      A { payload { n_lc_limits { lower: 50000 upper: unlimited } } }
      B { payload { n_lc_limits: "5000-100000" } }
    }
  }
}
`;

describe('instrument fidelity extensions', () => {
  it('parses measurand_kind, note, and source', () => {
    const m = load(INST_SRC);
    const inst = m.instruments[0];
    assert.equal(inst.measurandKind, 'force');
    assert.equal(inst.note, 'Editorial instrument note');
    assert.deepEqual(inst.source, {
      doc: 'urn:oiml:pub:r:60-1:2021',
      clause: '3.1',
    });
  });

  it('parses variant name, note, and source', () => {
    const m = load(INST_SRC);
    const v = m.instruments[0].variants[0];
    assert.equal(v.id, 'digital');
    assert.equal(v.name, 'Digital load cell');
    assert.equal(v.definition, 'Load cell with digital output');
    assert.equal(v.note, 'Variant note');
    assert.deepEqual(v.source, {
      doc: 'urn:oiml:pub:r:60-1:2021',
      clause: '3.1.3.3',
    });
  });

  it('parses nested and scalar dimension payloads', () => {
    const m = load(INST_SRC);
    const values = m.instruments[0].dimensions[0].values;
    assert.deepEqual(values[0].payload, {
      n_lc_limits: { lower: '50000', upper: 'unlimited' },
    });
    assert.deepEqual(values[1].payload, { n_lc_limits: '5000-100000' });
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(INST_SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('measurand_kind force'));
    assert.ok(dumped.includes('variant digital {'));
    assert.ok(dumped.includes('n_lc_limits {'));
    const m2 = load(dumped);
    assert.deepEqual(m2.instruments, m1.instruments);
    assert.equal(dump(m2), dumped);
  });
});

// ── §11 form + field ─────────────────────────────────────────────────

const FORM_SRC = `form F1 {
  name "Test report form"
  section "Test results"
  requirements { /req/metrological/mpe /req/metrological/repeatability }
  note "First form note"
  note "Second form note"
  scope administrative
  references {
    requirement { "urn:oiml:pub:r:60-1:2021#clause-5.3" "urn:oiml:pub:r:60-1:2021#clause-5.4" }
    test-procedure { "urn:oiml:pub:r:60-2:2021#clause-2.7" }
  }
  calculation_context { header shared/header dimensions true tables { mpe_tiers } }
  instances { instance on-load-cell { name "On the load cell" } }
  constraints {
    constraint measurement-standards-uncertainty {
      rule "uncertainty <= mpe / 3"
      on_violation invalidate
      notes "Reference uncertainty budget"
      source { doc "urn:oiml:pub:r:60-2:2021" clause "2.4" }
    }
  }
  field e_l : number {
    label "Load cell error"
    symbol e_l
    verdict mdlo_normalized
    targets { /req/metrological/mpe }
    dimension accuracy_class
    enum humidity_class
    pattern "^[0-9]+$"
    true_label "Pass"
    false_label "Fail"
    enum_values { A B }
    references { requirement { "urn:oiml:pub:r:60-1:2021#clause-5.3" } }
    specification_reference "R 144-1, 4.5.2"
    applicability { accuracy_class: [A, B] }
    evaluation {
      verdict drift_error
      op lte
      limit "ocl{max(2, 0.05 * abs(cgm_certified_value))}"
      condition "when the drift test applies"
    }
  }
  pass_fail {
    criteria "All errors within MPE"
    pass_if "ocl{max_error <= mpe}"
    derivation {
      value max_error { calculation "ocl{max(abs(errors))}" for_each measurements unit "ppm" }
    }
  }
}
`;

describe('form fidelity extensions', () => {
  it('parses form-level section, requirements, notes, scope', () => {
    const m = load(FORM_SRC);
    const f = m.forms[0];
    assert.equal(f.section, 'Test results');
    assert.deepEqual(f.requirements, [
      '/req/metrological/mpe',
      '/req/metrological/repeatability',
    ]);
    assert.deepEqual(f.formNotes, ['First form note', 'Second form note']);
    assert.equal(f.scope, 'administrative');
  });

  it('parses role-grouped references, flattened', () => {
    const m = load(FORM_SRC);
    assert.deepEqual(m.forms[0].formReferences, [
      { urn: 'urn:oiml:pub:r:60-1:2021#clause-5.3', role: 'requirement' },
      { urn: 'urn:oiml:pub:r:60-1:2021#clause-5.4', role: 'requirement' },
      { urn: 'urn:oiml:pub:r:60-2:2021#clause-2.7', role: 'test-procedure' },
    ]);
  });

  it('parses calculation_context, instances, and constraints', () => {
    const m = load(FORM_SRC);
    const f = m.forms[0];
    assert.deepEqual(f.calculationContext, {
      header: 'shared/header',
      dimensions: true,
      tables: ['mpe_tiers'],
    });
    assert.deepEqual(f.formInstances, [
      { id: 'on-load-cell', name: 'On the load cell' },
    ]);
    assert.deepEqual(f.formConstraints, [
      {
        id: 'measurement-standards-uncertainty',
        rule: 'uncertainty <= mpe / 3',
        onViolation: 'invalidate',
        notes: 'Reference uncertainty budget',
        source: { doc: 'urn:oiml:pub:r:60-2:2021', clause: '2.4' },
      },
    ]);
  });

  it('parses field-level scalar extensions', () => {
    const m = load(FORM_SRC);
    const f = m.forms[0].fields[0];
    assert.equal(f.symbol, 'e_l');
    assert.equal(f.verdict, 'mdlo_normalized');
    assert.deepEqual(f.targets, ['/req/metrological/mpe']);
    assert.equal(f.dimension, 'accuracy_class');
    assert.equal(f.enumRef, 'humidity_class');
    assert.equal(f.pattern, '^[0-9]+$');
    assert.equal(f.trueLabel, 'Pass');
    assert.equal(f.falseLabel, 'Fail');
    assert.deepEqual(f.enumValues, ['A', 'B']);
    assert.deepEqual(f.fieldReferences, [
      { urn: 'urn:oiml:pub:r:60-1:2021#clause-5.3', role: 'requirement' },
    ]);
    assert.equal(f.specificationReference, 'R 144-1, 4.5.2');
    assert.deepEqual(f.applicability, [
      { dimension: 'accuracy_class', values: ['A', 'B'], mapping: null, match: null },
    ]);
  });

  it('parses the canonical evaluation verdict/op/limit form', () => {
    const m = load(FORM_SRC);
    const ev = m.forms[0].fields[0].evaluation!;
    assert.equal(ev.rule, '');
    assert.equal(ev.verdict, 'drift_error');
    assert.equal(ev.op, 'lte');
    assert.equal(ev.limit, 'ocl{max(2, 0.05 * abs(cgm_certified_value))}');
    assert.equal(ev.condition, 'when the drift test applies');
  });

  it('parses pass_fail derivation rules', () => {
    const m = load(FORM_SRC);
    const pf = m.forms[0].passFail!;
    assert.equal(pf.criteria, 'All errors within MPE');
    assert.equal(pf.passIf, 'ocl{max_error <= mpe}');
    assert.deepEqual(pf.derivations, [
      {
        name: 'max_error',
        calculation: 'ocl{max(abs(errors))}',
        forEach: 'measurements',
        unit: 'ppm',
      },
    ]);
  });

  it('keeps the single-line pass_fail dump when no derivations exist', () => {
    const m1 = load(`form F2 {
      name "Plain"
      pass_fail { criteria "c" pass_if "ocl{ok}" }
    }`);
    const dumped = dump(m1);
    assert.ok(dumped.includes('pass_fail { criteria "c" pass_if "ocl{ok}" }'));
    const m2 = load(dumped);
    assert.deepEqual(m2.forms, m1.forms);
  });

  it('round-trips through dump (parse → dump → parse, identical AST)', () => {
    const m1 = load(FORM_SRC);
    const dumped = dump(m1);
    assert.ok(dumped.includes('section "Test results"'));
    assert.ok(dumped.includes('references { requirement {'));
    assert.ok(dumped.includes('calculation_context {'));
    assert.ok(dumped.includes('derivation {'));
    assert.ok(dumped.includes('verdict drift_error op lte'));
    const m2 = load(dumped);
    assert.deepEqual(m2.forms, m1.forms);
    assert.equal(dump(m2), dumped);
  });
});
