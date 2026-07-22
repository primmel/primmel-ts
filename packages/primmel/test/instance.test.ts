// ─────────────────────────────────────────────────────────────────────
// Instantiation and delegation (Primmel v3, TODO.roadmap/03) —
// the `instance` construct (parse + round-trip), the INV-10 delegation
// resolver, and the linter rules C17–C20.
//
// The central fixture is the R 60 subject chain (family → group → model)
// with ONE sample instance, mirroring data/r60/sample-data.yaml flow
// DE1/PTB — Hottinger Brüel & Kjaer HLCi (task deliverable 4).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';
import {
  InstanceResolutionError,
  instanceChain,
  parseInstancePath,
  resolveInstanceAttributes,
  resolveInstanceClassification,
  resolveInstanceValue,
} from '../src/instance-resolution';

const R60_CHAIN = `
subject LoadCellModelFamily {
  is { metadata { name "Load cell model family" } }
}
subject LoadCellModelGroup {
  is { metadata { name "Load cell group" } }
}
subject LoadCellModel {
  is { metadata { name "Load cell model" } }
}
subject LoadCellSample {
  is { metadata { name "Load cell sample" } }
}

instrument LoadCell {
  definition "Measuring transducer."
  dimension technology { scope family values { analogue-passive analogue-active digital } }
  dimension accuracy_class { scope group values { A B C D } }
}

attribute_definition e_min { symbol "E_min" origin design-fixed scope family }
attribute_definition p_lc { symbol "p_LC" origin design-fixed scope family }
attribute_definition t_min { symbol "T_min" origin declared scope family }
attribute_definition n_lc { symbol "n_LC" origin design-fixed scope group }
attribute_definition v_min { symbol "v_min" origin design-fixed scope group }
attribute_definition e_max { symbol "E_max" origin design-fixed scope model }
attribute_definition d_min { symbol "D_min" origin test-dependent scope sample }
attribute_definition d_max { symbol "D_max" origin test-dependent scope sample }
attribute_definition v { symbol "v" origin test-dependent scope sample }
attribute_definition n { symbol "n" origin test-dependent scope sample }

instance fam-hbk-hlci {
  of LoadCellModelFamily
  level family
  definition_versions { LoadCellModelFamily : "2021" attributes : "1.0.0" }
  has {
    attributes { e_min : 0 kg p_lc : 0.7 t_min : -10 degC }
    dimensions { technology : digital }
  }
}
instance grp-hbk-hlci-c3 {
  of LoadCellModelGroup
  level group
  family fam-hbk-hlci
  definition_versions { LoadCellModelGroup : "2021" }
  has {
    attributes { n_lc : 6000 v_min : 0.037 kg }
    dimensions { accuracy_class : C }
  }
}
instance mod-hbk-hlci-2-2t-c3 {
  of LoadCellModel
  level model
  group grp-hbk-hlci-c3
  family fam-hbk-hlci
  definition_versions { LoadCellModel : "2021" }
  has {
    attributes { e_max : 2.2 t }
  }
}
instance smp-hbk-hlci-001 {
  of LoadCellSample
  level sample
  model mod-hbk-hlci-2-2t-c3
  definition_versions { LoadCellSample : "2021" }
  has {
    test_context { d_min : 0 kg d_max : 2.2 t v : 0.037 kg n : 6000 }
  }
}
`;

describe('v3 instance construct (parse)', () => {
  it('parses the R 60 subject chain with one sample instance', () => {
    const m = load(R60_CHAIN);
    assert.equal(m.instances.length, 4);

    const fam = m.instances.find(i => i.id === 'fam-hbk-hlci')!;
    assert.equal(fam.of, 'LoadCellModelFamily');
    assert.equal(fam.level, 'family');
    assert.equal(fam.model, '');
    assert.equal(fam.group, '');
    assert.equal(fam.family, '');
    assert.deepEqual(fam.definitionVersions, {
      LoadCellModelFamily: '2021',
      attributes: '1.0.0',
    });
    assert.deepEqual(fam.has.attributes, {
      e_min: { value: 0, unit: 'kg' },
      p_lc: { value: 0.7 },
      t_min: { value: -10, unit: 'degC' },
    });
    assert.deepEqual(fam.has.dimensions, { technology: 'digital' });
    assert.deepEqual(fam.has.testContext, {});

    const grp = m.instances.find(i => i.id === 'grp-hbk-hlci-c3')!;
    assert.equal(grp.level, 'group');
    assert.equal(grp.family, 'fam-hbk-hlci');
    assert.deepEqual(grp.has.attributes.n_lc, { value: 6000 });

    const mod = m.instances.find(i => i.id === 'mod-hbk-hlci-2-2t-c3')!;
    assert.equal(mod.level, 'model');
    assert.equal(mod.group, 'grp-hbk-hlci-c3');
    assert.equal(mod.family, 'fam-hbk-hlci');
    assert.deepEqual(mod.has.attributes.e_max, { value: 2.2, unit: 't' });

    const smp = m.instances.find(i => i.id === 'smp-hbk-hlci-001')!;
    assert.equal(smp.level, 'sample');
    assert.equal(smp.model, 'mod-hbk-hlci-2-2t-c3');
    assert.deepEqual(smp.has.testContext, {
      d_min: { value: 0, unit: 'kg' },
      d_max: { value: 2.2, unit: 't' },
      v: { value: 0.037, unit: 'kg' },
      n: { value: 6000 },
    });
    assert.deepEqual(smp.has.attributes, {});
    assert.deepEqual(smp.has.dimensions, {});
  });

  it('coerces unquoted numeric literals, keeps quoted numerics strings', () => {
    const m = load(`instance i {
  of S
  level model
  has {
    attributes {
      count : 6000
      ratio : 0.037 kg
      sw_id : "2.1"
      impedance : "350 ± 3.5" Ω
      label : plain
      negative : -10 degC
    }
  }
}
`);
    const a = m.instances[0].has.attributes;
    assert.deepEqual(a.count, { value: 6000 });
    assert.deepEqual(a.ratio, { value: 0.037, unit: 'kg' });
    assert.deepEqual(a.sw_id, { value: '2.1' });
    assert.deepEqual(a.impedance, { value: '350 ± 3.5', unit: 'Ω' });
    assert.deepEqual(a.label, { value: 'plain' });
    assert.deepEqual(a.negative, { value: -10, unit: 'degC' });
  });

  it('parses attached-colon entries (key: value) like spaced ones', () => {
    const m = load(`instance i {
  of S
  level sample
  has { test_context { d_min: 0 kg d_max: 2.2 t n: 6000 } }
}
`);
    assert.deepEqual(m.instances[0].has.testContext, {
      d_min: { value: 0, unit: 'kg' },
      d_max: { value: 2.2, unit: 't' },
      n: { value: 6000 },
    });
  });

  it('rejects value entries with more than value + unit', () => {
    assert.throws(
      () =>
        load(`instance i {
  of S
  level model
  has { attributes { broken : 1 2 3 } }
}
`),
      /quote multi-word values/,
    );
  });

  it('round-trips the R 60 chain losslessly (fixpoint)', () => {
    const m1 = load(R60_CHAIN);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.instances, m1.instances);
    assert.deepEqual(m2.subjects, m1.subjects);
    assert.deepEqual(m2.instruments, m1.instruments);
    assert.deepEqual(m2.attributeDefinitions, m1.attributeDefinitions);
    assert.equal(dump(m2), dumped);
  });

  it('round-trips quoted numerics and empty has blocks', () => {
    const src = `instance i {
  of S
  level model
  definition_versions { S : "1" }
  has { attributes { sw_id : "2.1" note : "" } }
}
`;
    const m1 = load(src);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.instances, m1.instances);
    assert.equal(dump(m2), dumped);
  });

  it('round-trips values and units ending in a colon (quoted on dump)', () => {
    // A bare trailing-colon token re-parses as a KEY head (isKeyHead):
    // `note : ref:` would read back as two entries. The dump must quote
    // any value or unit ending in ':'.
    const src = `instance i {
  of S
  level model
  has { attributes { note : "ref:" ratio : 1.5 "kg:" } }
}
`;
    const m1 = load(src);
    assert.deepEqual(m1.instances[0].has.attributes, {
      note: { value: 'ref:' },
      ratio: { value: 1.5, unit: 'kg:' },
    });
    const dumped = dump(m1);
    assert.ok(
      dumped.includes('note : "ref:"'),
      `trailing-colon value quoted on dump, got:\n${dumped}`,
    );
    assert.ok(
      dumped.includes('ratio : 1.5 "kg:"'),
      `trailing-colon unit quoted on dump, got:\n${dumped}`,
    );
    const m2 = load(dumped);
    assert.deepEqual(m2.instances, m1.instances);
    assert.equal(dump(m2), dumped);
  });
});

describe('delegation resolution (INV-10)', () => {
  it('resolves upward: model, group, then family', () => {
    const m = load(R60_CHAIN);
    // model level
    assert.deepEqual(
      resolveInstanceValue(m, 'smp-hbk-hlci-001', 'parameters.e_max'),
      { value: 2.2, unit: 't' },
    );
    // group level
    assert.deepEqual(
      resolveInstanceValue(m, 'smp-hbk-hlci-001', 'parameters.n_lc'),
      { value: 6000 },
    );
    assert.deepEqual(
      resolveInstanceValue(m, 'smp-hbk-hlci-001', 'parameters.v_min'),
      { value: 0.037, unit: 'kg' },
    );
    // family level
    assert.deepEqual(
      resolveInstanceValue(m, 'smp-hbk-hlci-001', 'parameters.t_min'),
      { value: -10, unit: 'degC' },
    );
    assert.deepEqual(
      resolveInstanceValue(m, 'smp-hbk-hlci-001', 'parameters.p_lc'),
      { value: 0.7 },
    );
  });

  it('accepts level-prefixed paths (same delegated answer)', () => {
    const m = load(R60_CHAIN);
    assert.deepEqual(
      resolveInstanceValue(m, 'smp-hbk-hlci-001', 'model.parameters.e_max'),
      { value: 2.2, unit: 't' },
    );
    assert.equal(
      resolveInstanceValue(
        m,
        'smp-hbk-hlci-001',
        'group.classification.accuracy_class',
      ),
      'C',
    );
  });

  it('lower override: a value set at a lower level shadows the inherited one', () => {
    const m = load(R60_CHAIN);
    // The model restates the family-scope p_lc (visible override).
    const override = dump(m).replace(
      'attributes { e_max : 2.2 t }',
      'attributes { e_max : 2.2 t p_lc : 0.8 }',
    );
    const m2 = load(override);
    assert.deepEqual(
      resolveInstanceValue(m2, 'smp-hbk-hlci-001', 'parameters.p_lc'),
      { value: 0.8 },
    );
    // …but resolution anchored at the group still sees the family value.
    assert.deepEqual(
      resolveInstanceValue(m2, 'grp-hbk-hlci-c3', 'parameters.p_lc'),
      { value: 0.7 },
    );
  });

  it('sample-scope values come only from the sample test_context', () => {
    const m = load(R60_CHAIN);
    assert.deepEqual(
      resolveInstanceValue(m, 'smp-hbk-hlci-001', 'parameters.d_min'),
      { value: 0, unit: 'kg' },
    );
    assert.deepEqual(
      resolveInstanceValue(m, 'smp-hbk-hlci-001', 'test_context.d_min'),
      { value: 0, unit: 'kg' },
    );
    // Anchored at the model, a sample-scope attribute is undefined —
    // test-dependent values are never inherited UP the chain either.
    assert.throws(
      () => resolveInstanceValue(m, 'mod-hbk-hlci-2-2t-c3', 'parameters.d_min'),
      (e: Error) =>
        e instanceof InstanceResolutionError &&
        (e as InstanceResolutionError).kind === 'undefined-value',
    );
  });

  it('never inherits a sample-scope value placed higher in the chain', () => {
    // Malformed on purpose (C17 would flag it): d_min stated on the family.
    const src = R60_CHAIN.replace(
      'attributes { e_min : 0 kg p_lc : 0.7 t_min : -10 degC }',
      'attributes { e_min : 0 kg p_lc : 0.7 t_min : -10 degC d_min : 9 kg }',
    ).replace(
      'd_min : 0 kg d_max : 2.2 t v : 0.037 kg n : 6000',
      'd_max : 2.2 t',
    );
    const m = load(src);
    // The sample carries no d_min and the family's copy is invisible.
    assert.throws(
      () => resolveInstanceValue(m, 'smp-hbk-hlci-001', 'parameters.d_min'),
      (e: Error) =>
        e instanceof InstanceResolutionError &&
        (e as InstanceResolutionError).kind === 'undefined-value',
    );
    // The bulk layer likewise excludes it.
    assert.equal(
      resolveInstanceAttributes(m, 'smp-hbk-hlci-001').has('d_min'),
      false,
    );
  });

  it('resolves classification upward, skipping the sample level', () => {
    const m = load(R60_CHAIN);
    assert.equal(
      resolveInstanceValue(
        m,
        'smp-hbk-hlci-001',
        'classification.accuracy_class',
      ),
      'C',
    );
    assert.equal(
      resolveInstanceValue(m, 'smp-hbk-hlci-001', 'classification.technology'),
      'digital',
    );
    assert.deepEqual(
      Object.fromEntries(resolveInstanceClassification(m, 'smp-hbk-hlci-001')),
      { technology: 'digital', accuracy_class: 'C' },
    );
  });

  it('builds the full effective attribute layer (bulk delegation)', () => {
    const m = load(R60_CHAIN);
    const attrs = resolveInstanceAttributes(m, 'smp-hbk-hlci-001');
    assert.deepEqual(Object.fromEntries(attrs), {
      e_min: { value: 0, unit: 'kg' },
      p_lc: { value: 0.7 },
      t_min: { value: -10, unit: 'degC' },
      n_lc: { value: 6000 },
      v_min: { value: 0.037, unit: 'kg' },
      e_max: { value: 2.2, unit: 't' },
      d_min: { value: 0, unit: 'kg' },
      d_max: { value: 2.2, unit: 't' },
      v: { value: 0.037, unit: 'kg' },
      n: { value: 6000 },
    });
  });

  it('bulk and single agree on out-of-discipline data: test_context answers only sample-scope attributes', () => {
    // Out of discipline on purpose (C17 would flag both): a model-scope
    // attribute restated in the sample's test_context, and a declared
    // model-scope attribute that exists ONLY there.
    const src = R60_CHAIN.replace(
      'attribute_definition d_min { symbol "D_min" origin test-dependent scope sample }',
      'attribute_definition d_min { symbol "D_min" origin test-dependent scope sample }\nattribute_definition extra_note { origin declared scope model }',
    ).replace(
      'test_context { d_min : 0 kg d_max : 2.2 t v : 0.037 kg n : 6000 }',
      'test_context { d_min : 0 kg d_max : 2.2 t v : 0.037 kg n : 6000 e_max : 99 t extra_note : "x" }',
    );
    const m = load(src);
    // Single-value: parameters.e_max delegates to the model's own value —
    // a test_context entry is invisible to a non-sample-scope attribute.
    assert.deepEqual(
      resolveInstanceValue(m, 'smp-hbk-hlci-001', 'parameters.e_max'),
      { value: 2.2, unit: 't' },
    );
    // …and parameters.extra_note is undefined (the walk never consults
    // test_context for a non-sample-scope attribute).
    assert.throws(
      () =>
        resolveInstanceValue(m, 'smp-hbk-hlci-001', 'parameters.extra_note'),
      (e: Error) =>
        e instanceof InstanceResolutionError &&
        (e as InstanceResolutionError).kind === 'undefined-value',
    );
    // The bulk layer agrees on both: the out-of-discipline keys neither
    // shadow the delegated value nor appear on their own.
    const bulk = resolveInstanceAttributes(m, 'smp-hbk-hlci-001');
    assert.deepEqual(bulk.get('e_max'), { value: 2.2, unit: 't' });
    assert.equal(bulk.has('extra_note'), false);
  });

  it('walks the chain in order sample → model → group → family', () => {
    const m = load(R60_CHAIN);
    assert.deepEqual(
      instanceChain(m, 'smp-hbk-hlci-001').map(i => i.id),
      [
        'smp-hbk-hlci-001',
        'mod-hbk-hlci-2-2t-c3',
        'grp-hbk-hlci-c3',
        'fam-hbk-hlci',
      ],
    );
    // Anchored at the model: the sample is not part of the walk.
    assert.deepEqual(
      instanceChain(m, 'mod-hbk-hlci-2-2t-c3').map(i => i.id),
      ['mod-hbk-hlci-2-2t-c3', 'grp-hbk-hlci-c3', 'fam-hbk-hlci'],
    );
  });

  it('throws a typed error for an undefined value (never silent)', () => {
    const m = load(R60_CHAIN);
    assert.throws(
      () => resolveInstanceValue(m, 'smp-hbk-hlci-001', 'parameters.e_lim'),
      (e: Error) => {
        assert.ok(e instanceof InstanceResolutionError);
        assert.equal((e as InstanceResolutionError).kind, 'undefined-value');
        assert.match(e.message, /e_lim/);
        return true;
      },
    );
  });

  it('throws typed errors for unknown instance, bad path, and chain cycle', () => {
    const m = load(R60_CHAIN);
    assert.throws(
      () => resolveInstanceValue(m, 'ghost', 'parameters.e_max'),
      (e: Error) =>
        e instanceof InstanceResolutionError &&
        (e as InstanceResolutionError).kind === 'unknown-instance',
    );
    assert.throws(
      () => resolveInstanceValue(m, 'smp-hbk-hlci-001', 'bogus.e_max'),
      (e: Error) =>
        e instanceof InstanceResolutionError &&
        (e as InstanceResolutionError).kind === 'bad-path',
    );
    assert.throws(
      () => parseInstancePath('widget.parameters.e_max'),
      (e: Error) =>
        e instanceof InstanceResolutionError &&
        (e as InstanceResolutionError).kind === 'bad-path',
    );
    const cyclic = load(`instance a { of S level model model b }
instance b { of S level model model a }
`);
    assert.throws(
      () => resolveInstanceValue(cyclic, 'a', 'parameters.e_max'),
      (e: Error) =>
        e instanceof InstanceResolutionError &&
        (e as InstanceResolutionError).kind === 'chain-cycle',
    );
  });

  it('a dangling chain link ends the walk leniently (C19 reports it)', () => {
    const m = load(`instance only {
  of S
  level model
  model ghost-model
  has { attributes { e_max : 5 kg } }
}
`);
    // Locally-set values still resolve…
    assert.deepEqual(resolveInstanceValue(m, 'only', 'parameters.e_max'), {
      value: 5,
      unit: 'kg',
    });
    // …but nothing beyond the dangling link is reachable.
    assert.throws(
      () => resolveInstanceValue(m, 'only', 'parameters.p_lc'),
      (e: Error) =>
        e instanceof InstanceResolutionError &&
        (e as InstanceResolutionError).kind === 'undefined-value',
    );
  });
});

// ── linter fixtures (C17–C20) ───────────────────────────────────────

function makeTmpPackage(files: Record<string, string>): string {
  const { mkdtempSync, mkdirSync, writeFileSync } = require('fs');

  const { tmpdir } = require('os');

  const { join } = require('path');
  const dir = mkdtempSync(join(tmpdir(), 'primmel-instance-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, 'model', name), body);
  }
  return dir;
}

const LINT_DEFS = `subject Fam { }
subject Grp { }
subject Mod { }
subject Smp { }
instrument T {
  dimension technology { scope family values { x y } }
  dimension accuracy_class { scope group values { A B } }
}
attribute_definition e_min { scope family }
attribute_definition p_lc { scope family }
attribute_definition n_lc { scope group }
attribute_definition e_max { scope model }
attribute_definition d_min { scope sample }
`;

const LINT_CLEAN_INSTANCES = `instance fam-1 {
  of Fam
  level family
  definition_versions { Fam : "1" }
  has {
    attributes { e_min : 0 kg p_lc : 0.7 }
    dimensions { technology : x }
  }
}
instance grp-1 {
  of Grp
  level group
  family fam-1
  definition_versions { Grp : "1" }
  has {
    attributes { n_lc : 3000 }
    dimensions { accuracy_class : A }
  }
}
instance mod-1 {
  of Mod
  level model
  group grp-1
  family fam-1
  definition_versions { Mod : "1" }
  has { attributes { e_max : 5 kg p_lc : 0.8 } }
}
instance smp-1 {
  of Smp
  level sample
  model mod-1
  definition_versions { Smp : "1" }
  has { test_context { d_min : 1 kg } }
}
`;

const LINT_BAD_INSTANCES = `instance i-above {
  of Mod
  level family
  definition_versions { Mod : "1" }
  has { attributes { e_max : 5 kg } }
}
instance i-sample-scope-in-attrs {
  of Smp
  level sample
  definition_versions { Smp : "1" }
  has { attributes { d_min : 1 kg } }
}
instance i-nonsample-in-tc {
  of Smp
  level sample
  definition_versions { Smp : "1" }
  has { test_context { e_max : 5 kg } }
}
instance i-tc-on-group {
  of Grp
  level group
  definition_versions { Grp : "1" }
  has { test_context { d_min : 1 kg } }
}
instance i-undeclared {
  of Mod
  level model
  definition_versions { Mod : "1" }
  has { attributes { bogus_attr : 1 } }
}
instance i-unpinned {
  of Mod
  level model
}
instance i-dangling-of {
  of Ghost
  level model
  definition_versions { Mod : "1" }
}
instance i-dangling-link {
  of Mod
  level model
  model ghost-model
  definition_versions { Mod : "1" }
}
instance i-cyc-a {
  of Mod
  level model
  model i-cyc-b
  definition_versions { Mod : "1" }
}
instance i-cyc-b {
  of Mod
  level model
  model i-cyc-a
  definition_versions { Mod : "1" }
}
instance i-dim-above {
  of Fam
  level family
  definition_versions { Fam : "1" }
  has { dimensions { accuracy_class : A } }
}
instance i-dim-undeclared {
  of Fam
  level family
  definition_versions { Fam : "1" }
  has { dimensions { bogus_dim : Q } }
}
instance i-dim-on-sample {
  of Smp
  level sample
  definition_versions { Smp : "1" }
  has { dimensions { accuracy_class : A } }
}
instance i-bad-level {
  of Mod
  level widget
  definition_versions { Mod : "1" }
}
`;

describe('primmel check — instance lint rules (C17–C20)', () => {
  it('C17 instance-scope fires on wrong-level and wrong-plane values', () => {
    const dir = makeTmpPackage({
      'defs.prl': LINT_DEFS,
      'instances.prl': LINT_BAD_INSTANCES,
    });
    const c17 = checkPackage(dir).filter(i => i.check === 'C17');
    const messages = c17.map(i => i.message).join('\n');
    assert.ok(
      messages.includes(
        'attribute "e_max" (scope model) stated at family level',
      ),
      'C17 value above declared scope',
    );
    assert.ok(
      messages.includes(
        'sample-scope attribute "d_min" stated in has.attributes',
      ),
      'C17 sample-scope outside test_context',
    );
    assert.ok(
      messages.includes(
        'attribute "e_max" (scope model) stated in test_context',
      ),
      'C17 non-sample-scope in test_context',
    );
    assert.ok(
      messages.includes('test_context value "d_min" on a group-level instance'),
      'C17 test_context on non-sample level',
    );
    assert.ok(
      messages.includes(
        'attribute "bogus_attr" is not a declared attribute_definition',
      ),
      'C17 undeclared attribute',
    );
    assert.ok(
      messages.includes(
        'classification dimension "accuracy_class" (scope group) stated at family level',
      ),
      'C17 dimension above declared scope',
    );
    assert.ok(
      messages.includes('classification dimension "bogus_dim" is not declared'),
      'C17 undeclared dimension',
    );
    assert.ok(
      messages.includes(
        'classification "accuracy_class" on a sample-level instance',
      ),
      'C17 classification on a sample',
    );
    assert.ok(
      messages.includes('level "widget" is not a chain level'),
      'C17 unknown level',
    );
    assert.equal(c17.length, 9, `expected 9 C17 issues, got:\n${messages}`);
    assert.ok(
      c17.every(i => i.severity === 'error'),
      'C17 is an error',
    );
  });

  it('C18 instance-version-pin fires on an unpinned instance', () => {
    const dir = makeTmpPackage({
      'defs.prl': LINT_DEFS,
      'instances.prl': LINT_BAD_INSTANCES,
    });
    const c18 = checkPackage(dir).filter(i => i.check === 'C18');
    assert.equal(c18.length, 1);
    assert.equal(c18[0].severity, 'error');
    assert.ok(c18[0].message.includes('instance i-unpinned'));
    assert.ok(c18[0].message.includes('INV-8'));
    assert.ok(c18[0].message.includes('instance-version-pin'));
  });

  it('C19 chain-acyclic fires on dangling links and cycles', () => {
    const dir = makeTmpPackage({
      'defs.prl': LINT_DEFS,
      'instances.prl': LINT_BAD_INSTANCES,
    });
    const c19 = checkPackage(dir).filter(i => i.check === 'C19');
    const messages = c19.map(i => i.message).join('\n');
    assert.ok(
      messages.includes(
        'chain link model "ghost-model" is not a declared instance',
      ),
      'C19 dangling link',
    );
    assert.ok(messages.includes('cycle'), 'C19 cycle');
    assert.ok(messages.includes('i-cyc-a') && messages.includes('i-cyc-b'));
    assert.equal(c19.length, 2, `expected 2 C19 issues, got:\n${messages}`);
    assert.ok(
      c19.every(i => i.severity === 'error'),
      'C19 is an error',
    );
  });

  it('C20 instance-of-resolves fires on an undeclared definition', () => {
    const dir = makeTmpPackage({
      'defs.prl': LINT_DEFS,
      'instances.prl': LINT_BAD_INSTANCES,
    });
    const c20 = checkPackage(dir).filter(i => i.check === 'C20');
    assert.equal(c20.length, 1);
    assert.equal(c20[0].severity, 'error');
    assert.ok(c20[0].message.includes('instance i-dangling-of'));
    assert.ok(c20[0].message.includes('"Ghost"'));
    assert.ok(c20[0].message.includes('instance-of-resolves'));
  });

  it('a well-formed chain stays silent on C17–C20 (override is legal)', () => {
    const dir = makeTmpPackage({
      'defs.prl': LINT_DEFS,
      'instances.prl': LINT_CLEAN_INSTANCES,
    });
    const issues = checkPackage(dir);
    const instanceIssues = issues.filter(i =>
      ['C17', 'C18', 'C19', 'C20'].includes(i.check),
    );
    assert.deepEqual(
      instanceIssues,
      [],
      `expected no instance issues, got: ${instanceIssues
        .map(e => `[${e.check}] ${e.message}`)
        .join('\n')}`,
    );
    // No errors at all in this fixture (C5 coverage warnings are fine).
    assert.deepEqual(
      issues.filter(i => i.severity === 'error'),
      [],
    );
  });
});
