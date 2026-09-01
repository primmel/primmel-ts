// ─────────────────────────────────────────────────────────────────────
// W1b extensions (Primmel v2, gaps G2–G7, G10) — parse + round-trip.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

const SRC = `
class MeasuringInstrumentModel#data {
  store { measuringInstrumentModels }
  indexes { family_id group_id manufacturer_id standard_id }
  id: string [1..1] { modality SHALL definition "Record id" }
  family_id: reference(MeasuringInstrumentModelFamily#data) [1..1] {
    modality SHALL
    definition "Owning family"
    on_delete restrict
  }
  model: string [0..1] { modality MAY deprecated true }
}

requirement_class /req/metrological {
  name "Metrological requirements"
  subject "LoadCell"
  guidance "Clause 5 requirements"
}

requirement /req/metrological/mpe {
  name "Maximum permissible error"
  statement "Under rated operating conditions the MPE shall not exceed the stated values."
  binds_to { model.parameters.mpe model.classification.accuracy_class }
  limit {
    expression "ocl{abs(error) <= lookupMPE(load, accuracy_class, p_lc)}"
    uses { mpe accuracy_class p_lc }
  }
  applicability { accuracy_class: [A, B, C, D] }
  verification { method testing }
  source { doc "urn:oiml:pub:r:60-1:2021" clause "5.3.2" }
}

conformance_test /conf/metrological-tests/measurement-error-repeatability-mdlo {
  name "Determination of measurement error, repeatability and MDLO temperature effect"
  type Testing
  kind performance
  reference "urn:oiml:pub:r:60-2:2021#clause-2.10.1"
  targets { /req/metrological/mpe /req/metrological/repeatability }
  test_subject { accuracy_class: "C" technology: "digital" }
  variables {
    variable d_min { type number unit "kg" source derived derivation "ocl{(e_max - e_min) / n}" }
    variable test_load { type number unit "kg" source measured }
  }
  observables {
    observable e_l { quantity_kind mass unit v as "load cell error" }
  }
  conditions_to_enforce { temperature barometric_pressure }
  procedure {
    1 "Check test conditions"
    2 "Apply loads in ascending order"
  }
  acceptance_criteria {
    criterion within_mpe { pass_if "ocl{abs(e_l) <= mpe}" requirement /req/metrological/mpe }
  }
  derived_values {
    value e_l { expression "ocl{(avgIndication - referenceIndication) / f}" }
  }
  result_forms { r60-3/table-6.5 r60-3/table-6.6 }
}

table mpe_tiers {
  title "MPE per accuracy class"
  columns "class, lower, upper, mpe"
  data {
    "A" "0" "50000" "0.1"
  }
  profiles {
    accuracy_class { A: { "50000-unlimited" } B: { "10000-100000" } }
  }
}

term measuring-instrument {
  label "measuring instrument"
  definition "device used for making measurements"
  vocab_ref { register viml-2022 clause "0.10" }
  vocab_term "measuring instrument"
}

role ia_officer {
  name "IA Officer"
  label "Issuing Authority officer"
  description "Reviews applications and issues certificates"
}

form F1 {
  name "F"
  field emax : number { label "E_max" unit "kg" bind model.parameters.e_max }
}

state_machine Application {
  initial DRAFT
  states { DRAFT SUBMITTED UNDER_REVIEW ACCEPTED }
  transition [SUBMITTED, UNDER_REVIEW] -> ACCEPTED action ia_accepts {
    cascade AuditEvent {
      create { action: "accepted" actor: "ia" }
    }
  }
}
`;

describe('W1b extensions (G2–G7, G10)', () => {
  it('G2: class storage semantics + attribute on_delete/deprecated', () => {
    const m = load(SRC);
    const dc = m.dataclasses.find(
      c => c.id === 'MeasuringInstrumentModel#data',
    )!;
    assert.equal(dc.store, 'measuringInstrumentModels');
    assert.deepEqual(dc.indexes, [
      'family_id',
      'group_id',
      'manufacturer_id',
      'standard_id',
    ]);
    const fk = dc.attributes.find(a => a.id === 'family_id')!;
    assert.equal(fk.onDelete, 'restrict');
    const legacy = dc.attributes.find(a => a.id === 'model')!;
    assert.equal(legacy.deprecated, true);
  });

  it('G3: requirement_class + requirement with binds_to/limit/applicability', () => {
    const m = load(SRC);
    const rc = m.requirementClasses.find(r => r.id === '/req/metrological')!;
    assert.equal(rc.subject, 'LoadCell');
    const r = m.requirements.find(r => r.id === '/req/metrological/mpe')!;
    assert.deepEqual(r.bindsTo, [
      'model.parameters.mpe',
      'model.classification.accuracy_class',
    ]);
    assert.equal(
      r.limit?.expression,
      'ocl{abs(error) <= lookupMPE(load, accuracy_class, p_lc)}',
    );
    assert.deepEqual(r.limit?.uses, ['mpe', 'accuracy_class', 'p_lc']);
    assert.deepEqual(r.applicability[0].values, ['A', 'B', 'C', 'D']);
    assert.equal(r.verificationMethod, 'testing');
    assert.deepEqual(r.source, {
      doc: 'urn:oiml:pub:r:60-1:2021',
      clause: '5.3.2',
    });
  });

  it('G4: conformance test v2 (variables, observables, criteria, subject, inherits)', () => {
    const m = load(SRC);
    const t = m.conformanceTests.find(
      t =>
        t.id ===
        '/conf/metrological-tests/measurement-error-repeatability-mdlo',
    )!;
    assert.equal(t.kind, 'performance');
    assert.deepEqual(t.testSubject, {
      accuracy_class: 'C',
      technology: 'digital',
    });
    assert.equal(t.variables.length, 2);
    assert.equal(t.variables[0].source, 'derived');
    assert.equal(t.variables[0].derivation, 'ocl{(e_max - e_min) / n}');
    assert.deepEqual(t.observables[0], {
      name: 'e_l',
      quantityKind: 'mass',
      unit: 'v',
      as: 'load cell error',
    });
    assert.deepEqual(t.conditionsToEnforce, [
      'temperature',
      'barometric_pressure',
    ]);
    assert.equal(t.acceptanceCriteria[0].passIf, 'ocl{abs(e_l) <= mpe}');
    assert.equal(
      t.acceptanceCriteria[0].requirementId,
      '/req/metrological/mpe',
    );
    assert.equal(
      t.derivedValues[0].expression,
      'ocl{(avgIndication - referenceIndication) / f}',
    );
    assert.deepEqual(t.resultForms, ['r60-3/table-6.5', 'r60-3/table-6.6']);
  });

  it('G6: table profiles per-dimension bindings', () => {
    const m = load(SRC);
    const t = m.tables.find(t => t.id === 'mpe_tiers')!;
    assert.deepEqual(Object.keys(t.profiles ?? {}), ['accuracy_class']);
    assert.equal(
      String((t.profiles as any).accuracy_class.A),
      '"50000-unlimited"',
    );
  });

  it('G7: term vocab_ref + vocab_term', () => {
    const m = load(SRC);
    const t = m.terms.find(t => t.id === 'measuring-instrument')!;
    assert.deepEqual(t.vocabRef, { register: 'viml-2022', clause: '0.10' });
    assert.equal(t.vocabTerm, 'measuring instrument');
  });

  it('G5: form field bind path', () => {
    const m = load(SRC);
    const f = m.forms.find(f => f.id === 'F1')!;
    assert.equal(f.fields[0].bind, 'model.parameters.e_max');
  });

  it('G5: the bind path dumps and round-trips (editor window-2 pin)', () => {
    // The field parser has read `bind` since G5, but dumpFormField never
    // emitted it — a load→dump cycle silently dropped the binding, which
    // is why the editor's FormInspector pinned bind read-only.
    const m = load(SRC);
    const first = dump(m);
    assert.match(first, /bind model\.parameters\.e_max/);
    const reparsed = load(first);
    assert.equal(
      reparsed.forms.find(f => f.id === 'F1')!.fields[0].bind,
      'model.parameters.e_max',
    );
    assert.equal(dump(reparsed), first);
  });

  it('G10: role label/description + multi-source transitions + create cascade', () => {
    const m = load(SRC);
    const r = m.roles.find(r => r.id === 'ia_officer')!;
    assert.equal(r.label, 'Issuing Authority officer');
    const sm = m.stateMachines.find(s => s.entityName === 'Application')!;
    assert.equal(sm.transitions.length, 2, 'multi-source fans out');
    assert.deepEqual(
      sm.transitions.map(t => t.from),
      ['SUBMITTED', 'UNDER_REVIEW'],
    );
    assert.deepEqual(sm.transitions[0].cascades[0].create, {
      action: 'accepted',
      actor: 'ia',
    });
  });

  it('round-trips the extension package losslessly (fixpoint)', () => {
    const m1 = load(SRC);
    const dumped = dump(m1);
    const m2 = load(dumped);
    const dc1 = m1.dataclasses.find(
      c => c.id === 'MeasuringInstrumentModel#data',
    )!;
    const dc2 = m2.dataclasses.find(
      c => c.id === 'MeasuringInstrumentModel#data',
    )!;
    assert.deepEqual(dc2, dc1);
    assert.deepEqual(
      m2.requirements.find(r => r.id === '/req/metrological/mpe'),
      m1.requirements.find(r => r.id === '/req/metrological/mpe'),
    );
    assert.deepEqual(
      m2.conformanceTests.find(
        t =>
          t.id ===
          '/conf/metrological-tests/measurement-error-repeatability-mdlo',
      ),
      m1.conformanceTests.find(
        t =>
          t.id ===
          '/conf/metrological-tests/measurement-error-repeatability-mdlo',
      ),
    );
    assert.deepEqual(m2.terms, m1.terms);
    assert.equal(dump(m2), dumped);
  });
});
