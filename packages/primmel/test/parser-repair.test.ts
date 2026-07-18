// ─────────────────────────────────────────────────────────────────────
// W1a parser-repair regression tests (Primmel v2 plan, gap G0).
// Each test pins one of the six verified v1.4.0 parser bugs.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

// load() resolves to a Standard whose collections are ARRAYS (types/Standard.ts).
const formById = (m: any, id: string) => {
  const f = m.forms.find((x: any) => x.id === id);
  assert.ok(f, `form ${id} exists`);
  return f;
};

describe('W1a parser repair', () => {
  it('1. typed form fields keep their bodies (`field x : number { … }`)', () => {
    const src = `form F1 {
  name "F"
  field y : number { label "Y" unit "kg" required true }
}`;
    const m = load(src);
    const f = formById(m, 'F1');
    assert.equal(f.fields.length, 1);
    assert.equal(f.fields[0].name, 'y');
    assert.equal(f.fields[0].type, 'number');
    assert.equal(f.fields[0].label, 'Y');
    assert.equal(f.fields[0].unit, 'kg');
    assert.equal(f.fields[0].required, true);
  });

  it('2. bare scalar values are not mangled (stripWrapping everywhere)', () => {
    const src = `form F1 {
  name "F"
  field a { required true measurement_method computed default 42 }
}`;
    const m = load(src);
    const f = formById(m, 'F1').fields[0];
    assert.equal(f.required, true);
    assert.equal(f.measurementMethod, 'computed');
    assert.equal(f.hasDefault, true);
    assert.equal(f.defaultValue, '42');
  });

  it('3. calculation_bindings / evaluation / items / min/max_items / nested fields populate', () => {
    const src = `form F1 {
  name "F"
  field loads : array {
    label "Loads"
    calculation loadCellError
    calculation_bindings { dMin: d_min dMax: d_max }
    evaluation { rule "r1" condition "c1" reference { REF1 } }
    items { number }
    min_items 2
    max_items 5
    fields {
      field inner : string { label "Inner" }
    }
  }
}`;
    const m = load(src);
    const f = formById(m, 'F1').fields[0];
    assert.equal(f.calculationId, 'loadCellError');
    assert.deepEqual(f.calculationBindings, [
      { inputName: 'dMin', pathExpr: 'd_min' },
      { inputName: 'dMax', pathExpr: 'd_max' },
    ]);
    assert.deepEqual(f.evaluation, {
      rule: 'r1',
      condition: 'c1',
      referenceId: 'REF1',
    });
    assert.equal(f.itemsType, 'number');
    assert.equal(f.minItems, 2);
    assert.equal(f.maxItems, 5);
    assert.equal(f.fields.length, 1);
    assert.equal(f.fields[0].name, 'inner');
    assert.equal(f.fields[0].label, 'Inner');
  });

  it('3b. nested subform_ref inside a field block is captured', () => {
    const src = `form F1 {
  name "F"
  field runs {
    subform_ref load-test-row { parameters { n_runs: 5 } applicability { accuracy_class: [A, C] } }
  }
}`;
    const m = load(src);
    const f = formById(m, 'F1').fields[0];
    assert.ok(f.subformRef);
    assert.equal(f.subformRef!.subformId, 'load-test-row');
    assert.deepEqual(f.subformRef!.parameters, { n_runs: '5' });
    assert.equal(f.subformRef!.applicability.length, 1);
    assert.deepEqual(f.subformRef!.applicability[0].values, ['A', 'C']);
  });

  it('4. colon handling: applicability mappings, multi-value lists, cascade set keys', () => {
    const src = `form F1 {
  name "F"
  applicability { accuracy_class: [A, C] }
}
state_machine Application {
  initial DRAFT
  states { DRAFT SUBMITTED }
  transition DRAFT -> SUBMITTED action submit {
    cascade TestRequest { set { status: ISSUED status2: X } }
  }
}`;
    const m = load(src);
    const app = formById(m, 'F1').applicability[0];
    assert.equal(app.dimension, 'accuracy_class');
    assert.deepEqual(app.values, ['A', 'C']);
    const sm = m.stateMachines.find(
      (s: any) => s.entityName === 'Application',
    )!;
    assert.ok(sm, 'state machine Application exists');
    const cascade = sm.transitions[0].cascades[0];
    assert.equal(cascade.set[0].field, 'status');
    assert.equal(cascade.set[0].value, 'ISSUED');
    assert.equal(cascade.set[1].field, 'status2');
    assert.equal(cascade.set[1].value, 'X');
  });

  it('4b. subform parameter mapping keys carry no trailing colon', () => {
    const src = `subform load-test-row {
  type array
  parameters {
    n_runs : integer { mapping { A: 5 B: 5 C: 3 } }
  }
  field load : number { label "Load" }
}`;
    const m = load(src);
    const p = m.subforms.find((s: any) => s.id === 'load-test-row')!
      .parameters[0];
    assert.deepEqual(p.mapping, { A: '5', B: '5', C: '3' });
  });

  it('5. `measurement` keyword is parsed (canonical), `variable` still works (alias)', () => {
    const src = `measurement M1 { type number definition "d" }
variable M2 { type number definition "d" }`;
    const m = load(src);
    assert.ok(
      m.variables.some((v: any) => v.id === 'M1'),
      'measurement keyword registers into variables',
    );
    assert.ok(
      m.variables.some((v: any) => v.id === 'M2'),
      'variable alias still registers',
    );
  });

  it('7. inline `ocl{…}` calculation values are captured whole and re-emitted safely', () => {
    const src = `form F1 {
  name "F"
  field vmin : number { label "Vmin" unit "g, kg, or t" calculation ocl{(emax - emin) / Y} }
  field sf : enum { label "Significant fault" values [no, yes] calculation ocl{abs(difference) > vmin ? ''yes'' : ''no''} }
}`;
    const m1 = load(src);
    const f = formById(m1, 'F1');
    assert.equal(f.fields[0].calculationId, 'ocl{(emax - emin) / Y}');
    assert.equal(
      f.fields[1].calculationId,
      "ocl{abs(difference) > vmin ? ''yes'' : ''no''}",
    );
    // dump → reload preserves the full inline expression (no brace corruption).
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.equal(
      formById(m2, 'F1').fields[0].calculationId,
      'ocl{(emax - emin) / Y}',
    );
    assert.equal(dump(m2), dumped);
  });

  it('6. forms round-trip losslessly (load → dump → load is stable)', () => {
    const src = `form F1 {
  name "The Form"
  description "d"
  data_class FormInstance
  applicability { accuracy_class: [A, C] humidity_symbol: { NH: 3 CH: 5 } }
  field loads : array {
    label "Loads"
    unit "kg"
    required true
    measurement_method direct
    calculation loadCellError
    calculation_bindings { dMin: d_min }
    derivation "ocl{a + b}"
    evaluation { rule "r" condition "c" reference { R1 } }
    min_items 2
    max_items 5
    fields {
      field inner : string { label "Inner" }
    }
    reference { REF9 }
  }
  subform_ref load-test-row { parameters { n_runs: 5 } applicability { accuracy_class: [A, C] } }
  pass_fail { criteria "c" pass_if "ocl{x < 1}" }
}`;
    const m1 = load(src);
    const dumped = dump(m1);
    const m2 = load(dumped);
    // Deep structural equality after one full round-trip.
    assert.deepEqual(formById(m2, 'F1').fields, formById(m1, 'F1').fields);
    assert.deepEqual(
      formById(m2, 'F1').applicability,
      formById(m1, 'F1').applicability,
    );
    assert.deepEqual(formById(m2, 'F1').passFail, formById(m1, 'F1').passFail);
    // And a second dump is byte-identical (fixpoint).
    assert.equal(dump(m2), dumped);
  });
});
