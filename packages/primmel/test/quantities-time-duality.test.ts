// ─────────────────────────────────────────────────────────────────────
// Quantities, time, and the IS↔HAS value duality (TODO.roadmap/06) —
// the quantity_register and dual constructs (parse + round-trip), the
// QuantityValue block form on instances, the time primitives
// (date/datetime/duration/period, validity windows, edition pins),
// map<K, V> type expressions, and the linter rules C32–C36.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';
import {
  checkValidityWindow,
  editionPins,
  isDate,
  isDateTime,
  isDuration,
  isPeriod,
} from '../src/time';
import { isWellFormedMapType, parseTypeExpression } from '../src/type-expr';

// ── construct fixtures ───────────────────────────────────────────────

const REGISTER = `
quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg description "Mass." }
  kind temperature { dimensions { Θ 1 } si_unit K }
  kind time { dimensions { T 1 } si_unit s }
  kind dimensionless { dimensions { } si_unit "1" }
  unit kg { symbol "kg" label "kilogram" kind mass factor 1 }
  unit g { symbol "g" label "gram" kind mass factor 0.001 }
  unit t { symbol "t" label "tonne" kind mass factor 1000 }
  unit degC { symbol "°C" label "degree Celsius" kind temperature factor 1 offset 273.15 }
  unit s { symbol "s" label "second" kind time factor 1 }
  unit min { symbol "min" label "minute" kind time factor 60 }
}
`;

const REGISTER_DOMAIN = `
quantity_register r60 {
  kind verification_interval { dimensions { } si_unit "1" description "Errors in units of v." }
  unit v { symbol "v" label "verification interval" kind verification_interval factor 1 }
}
`;

describe('quantity_register construct (parse)', () => {
  it('parses kinds with dimension vectors and units with conversion', () => {
    const m = load(REGISTER);
    assert.equal(m.quantityRegisters.length, 1);
    const reg = m.quantityRegisters[0];
    assert.equal(reg.id, 'si');
    assert.deepEqual(
      reg.kinds.map(k => k.id),
      ['mass', 'temperature', 'time', 'dimensionless'],
    );
    assert.deepEqual(reg.kinds[0].dimensions, { M: 1 });
    assert.deepEqual(reg.kinds[3].dimensions, {});
    assert.equal(reg.kinds[1].siUnit, 'K');
    const degC = reg.units.find(u => u.id === 'degC')!;
    assert.equal(degC.symbol, '°C');
    assert.equal(degC.kind, 'temperature');
    assert.equal(degC.factorToSI, 1);
    assert.equal(degC.offsetToSI, 273.15);
    const g = reg.units.find(u => u.id === 'g')!;
    assert.equal(g.factorToSI, 0.001);
    assert.equal(g.offsetToSI, 0);
  });

  it('round-trips losslessly (fixpoint)', () => {
    const m1 = load(REGISTER + REGISTER_DOMAIN);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.quantityRegisters, m1.quantityRegisters);
    assert.equal(dump(m2), dumped);
  });
});

describe('dual construct (parse)', () => {
  const DUALS = `
attribute_definition e_max { symbol "E_max" origin design-fixed scope model unit t quantity_kind mass }
dual e-max-rating {
  attribute e_max
  designed { value 2.2 unit t tolerance 0.5 }
  exhibited { value 2.1998 unit t uncertainty 0.0002 }
}
dual one-sided { attribute e_max designed { value 3 unit t } }
`;

  it('parses both roles with tolerance/uncertainty facets', () => {
    const m = load(DUALS);
    assert.equal(m.duals.length, 2);
    const d = m.duals[0];
    assert.equal(d.attribute, 'e_max');
    assert.deepEqual(d.designed, { value: 2.2, unit: 't', tolerance: 0.5 });
    assert.deepEqual(d.exhibited, {
      value: 2.1998,
      unit: 't',
      uncertainty: 0.0002,
    });
    assert.deepEqual(m.duals[1].designed, { value: 3, unit: 't' });
    assert.equal(m.duals[1].exhibited, undefined);
  });

  it('round-trips losslessly (fixpoint)', () => {
    const m1 = load(DUALS);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.duals, m1.duals);
    assert.equal(dump(m2), dumped);
  });
});

describe('instance QuantityValue block form (parse)', () => {
  it('parses the block form with kind/uncertainty/tolerance', () => {
    const m = load(`instance i {
  of S
  level model
  has {
    attributes {
      e_max : { value 2.2 unit t kind mass tolerance 0.5 }
      t_ref : { value 20 unit degC uncertainty 0.1 }
      plain : 5 kg
    }
  }
}
`);
    const a = m.instances[0].has.attributes;
    assert.deepEqual(a.e_max, {
      value: 2.2,
      unit: 't',
      quantityKind: 'mass',
      tolerance: 0.5,
    });
    assert.deepEqual(a.t_ref, { value: 20, unit: 'degC', uncertainty: 0.1 });
    assert.deepEqual(a.plain, { value: 5, unit: 'kg' });
  });

  it('round-trips block and inline forms losslessly (fixpoint)', () => {
    const src = `instance i {
  of S
  level model
  has {
    attributes {
      e_max : { value 2.2 unit t kind mass tolerance 0.5 }
      plain : 5 kg
      bare : "text"
    }
  }
}
`;
    const m1 = load(src);
    const dumped = dump(m1);
    // The block form is preserved for values carrying extra facets; the
    // plain value+unit stays inline.
    assert.ok(
      dumped.includes('e_max : { value 2.2 unit "t" kind mass tolerance 0.5 }'),
    );
    assert.ok(dumped.includes('plain : 5 kg'));
    const m2 = load(dumped);
    assert.deepEqual(m2.instances, m1.instances);
    assert.equal(dump(m2), dumped);
  });
});

// ── time primitives ──────────────────────────────────────────────────

describe('time primitives (parse/validate)', () => {
  it('date: real calendar validation incl. leap years', () => {
    assert.ok(isDate('2021-03-15'));
    assert.ok(isDate('2024-02-29')); // leap year
    assert.ok(!isDate('2023-02-29')); // not a leap year
    assert.ok(!isDate('2021-13-01'));
    assert.ok(!isDate('2021-00-10'));
    assert.ok(!isDate('2021-04-31'));
    assert.ok(!isDate('15-03-2021'));
    assert.ok(!isDate('2021-3-5'));
  });

  it('datetime: clock + optional zone', () => {
    assert.ok(isDateTime('2021-03-15T10:30'));
    assert.ok(isDateTime('2021-03-15T10:30:45Z'));
    assert.ok(isDateTime('2021-03-15T10:30:45+02:00'));
    assert.ok(!isDateTime('2021-03-15T25:30'));
    assert.ok(!isDateTime('2021-03-15T10:61'));
    assert.ok(!isDateTime('2021-02-29T10:30'));
  });

  it('duration: ISO 8601 with at least one component', () => {
    assert.ok(isDuration('P12M'));
    assert.ok(isDuration('P1M'));
    assert.ok(isDuration('P1Y2M3D'));
    assert.ok(isDuration('PT2H30M'));
    assert.ok(isDuration('P7D'));
    assert.ok(isDuration('P2W'));
    assert.ok(isDuration('PT0.5S'));
    assert.ok(!isDuration('P'));
    assert.ok(!isDuration('PT'));
    assert.ok(!isDuration('12M'));
    assert.ok(!isDuration('P1M2W')); // week form never combines
    assert.ok(!isDuration('every 12 months'));
  });

  it('period: intervals with start/end, end not before start', () => {
    assert.ok(isPeriod('2021-01-01/2021-12-31'));
    assert.ok(isPeriod('2021-01-01/P12M'));
    assert.ok(isPeriod('P12M/2021-12-31'));
    assert.ok(isPeriod('2021-01-01T00:00:00Z/2021-01-01T01:00:00Z'));
    assert.ok(!isPeriod('2021-12-31/2021-01-01')); // end before start
    assert.ok(!isPeriod('2021-01-01'));
    assert.ok(!isPeriod('2021-01-01/soon'));
    assert.ok(!isPeriod('P1M/P2M')); // two durations pin no interval
  });

  it('validity windows: end not before start', () => {
    assert.equal(
      checkValidityWindow({ start: '2021-01-01', end: '2031-01-01' }),
      null,
    );
    assert.match(
      checkValidityWindow({ start: '2031-01-01', end: '2021-01-01' })!,
      /before start/,
    );
    assert.match(
      checkValidityWindow({ start: 'soon', end: '2021-01-01' })!,
      /not an ISO 8601/,
    );
  });

  it('edition pins: deterministic sorted pin list (INV-8)', () => {
    assert.deepEqual(
      editionPins({ attributes: '1.0.0', LoadCellSample: '2021' }),
      [
        { definition: 'LoadCellSample', version: '2021' },
        { definition: 'attributes', version: '1.0.0' },
      ],
    );
  });
});

// ── map<K, V> type expressions ───────────────────────────────────────

describe('map<K, V> type expressions', () => {
  it('parses primitives, QuantityValue, reference, and maps', () => {
    assert.deepEqual(parseTypeExpression('string'), {
      kind: 'primitive',
      name: 'string',
    });
    assert.deepEqual(parseTypeExpression('QuantityValue'), {
      kind: 'quantity',
    });
    assert.deepEqual(parseTypeExpression('reference(Manufacturer)'), {
      kind: 'reference',
      target: 'Manufacturer',
    });
    assert.deepEqual(parseTypeExpression('map<string, QuantityValue>'), {
      kind: 'map',
      key: { kind: 'primitive', name: 'string' },
      value: { kind: 'quantity' },
    });
  });

  it('parses enum-keyed and nested maps', () => {
    const expr = parseTypeExpression(
      'map<accuracy_class, map<string, QuantityValue>>',
    );
    assert.deepEqual(expr, {
      kind: 'map',
      key: { kind: 'reference', target: 'accuracy_class' },
      value: {
        kind: 'map',
        key: { kind: 'primitive', name: 'string' },
        value: { kind: 'quantity' },
      },
    });
  });

  it('rejects malformed maps; leaves legacy type strings unchecked', () => {
    assert.ok(isWellFormedMapType('map<string, QuantityValue>'));
    assert.ok(isWellFormedMapType('map<accuracy_class, integer>'));
    assert.ok(!isWellFormedMapType('map<string>'));
    assert.ok(!isWellFormedMapType('map<string,>'));
    assert.ok(!isWellFormedMapType('map<map<string, string>, string>'));
    assert.ok(!isWellFormedMapType('map<string, frobnicate>'));
    assert.equal(parseTypeExpression('string[]'), null); // legacy free-form
  });
});

// ── linter fixtures (C32–C36) ────────────────────────────────────────

function makeTmpPackage(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-qtd-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, 'model', name), body);
  }
  return dir;
}

const QDEFS = `
subject Mod { }
subject Smp { }
attribute_definition e_max {
  symbol "E_max" origin design-fixed scope model unit t quantity_kind mass
}
attribute_definition t_ref {
  symbol "T_ref" origin declared scope model unit degC quantity_kind temperature
}
attribute_definition note { origin declared scope model value_type string }
attribute_definition cal_date {
  origin declared scope model value_type date
}
attribute_definition qv_plain {
  origin declared scope model value_type QuantityValue
}
attribute_definition e_min {
  symbol "E_min" origin design-fixed scope model unit kg
}
`;

const QREGISTER = `
quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg }
  kind temperature { dimensions { Θ 1 } si_unit K }
  unit kg { symbol "kg" kind mass }
  unit t { symbol "t" kind mass factor 1000 }
  unit degC { symbol "°C" kind temperature factor 1 offset 273.15 }
}
`;

describe('primmel check — C32 inv1-no-bare-quantity (INV-1)', () => {
  it('fires on a bare number stated for a declared physical quantity', () => {
    const dir = makeTmpPackage({
      'defs.prl': QDEFS,
      'reg.prl': QREGISTER,
      'inst.prl': `instance i {
  of Mod
  level model
  definition_versions { Mod : "1" }
  has {
    attributes {
      e_max : 2.2
      qv_plain : 3.5
      t_ref : 20 degC
      note : "calibration sticker present"
    }
  }
}
`,
    });
    const c32 = checkPackage(dir).filter(i => i.check === 'C32');
    const messages = c32.map(i => i.message).join('\n');
    assert.ok(
      messages.includes(
        'attribute "e_max" is a declared physical quantity (unit "t") but the stated value is a bare number',
      ),
      `C32 on unit-declared attribute:\n${messages}`,
    );
    assert.ok(
      messages.includes(
        'attribute "qv_plain" is a declared physical quantity (value_type QuantityValue)',
      ),
      `C32 on QuantityValue-typed attribute:\n${messages}`,
    );
    assert.ok(messages.includes('INV-1'));
    assert.equal(c32.length, 2, `expected 2 C32 issues:\n${messages}`);
    assert.ok(c32.every(i => i.severity === 'error'));
  });

  it('stays silent when every physical quantity carries a unit', () => {
    const dir = makeTmpPackage({
      'defs.prl': QDEFS,
      'reg.prl': QREGISTER,
      'inst.prl': `instance i {
  of Mod
  level model
  definition_versions { Mod : "1" }
  has { attributes { e_max : 2.2 t t_ref : 20 degC note : "ok" } }
}
`,
    });
    const c32 = checkPackage(dir).filter(i => i.check === 'C32');
    assert.deepEqual(c32, []);
  });
});

describe('primmel check — C33 quantity-coherence', () => {
  it('a kind-incoherent stated value fails (mass vs time)', () => {
    const dir = makeTmpPackage({
      'defs.prl': QDEFS,
      'reg.prl': `quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg }
  kind time { dimensions { T 1 } si_unit s }
  unit kg { symbol "kg" kind mass }
  unit s { symbol "s" kind time }
}
`,
      'inst.prl': `instance i {
  of Mod
  level model
  definition_versions { Mod : "1" }
  has { attributes { e_max : 2.2 s } }
}
`,
    });
    const c33 = checkPackage(dir).filter(i => i.check === 'C33');
    assert.equal(c33.length, 1);
    assert.equal(c33[0].severity, 'error');
    assert.ok(c33[0].message.includes('kind time'));
    assert.ok(c33[0].message.includes('kind mass'));
    assert.ok(c33[0].message.includes('quantity-coherence'));
  });

  it('register integrity: undeclared kind and cross-register redefinition', () => {
    const dir = makeTmpPackage({
      'reg.prl': `quantity_register a {
  kind mass { dimensions { M 1 } si_unit kg }
  unit kg { symbol "kg" kind mass }
  unit frob { symbol "fb" kind no_such_kind }
}
quantity_register b {
  unit g { symbol "kg" kind mass factor 0.001 }
}
`,
    });
    const c33 = checkPackage(dir).filter(i => i.check === 'C33');
    const messages = c33.map(i => i.message).join('\n');
    assert.ok(
      messages.includes('unit "frob" declares kind "no_such_kind"'),
      `C33 undeclared kind:\n${messages}`,
    );
    assert.ok(
      messages.includes('redefines a unit already declared by register "a"'),
      `C33 redefinition:\n${messages}`,
    );
    assert.ok(c33.every(i => i.severity === 'error'));
  });

  it('condition-set entry with a mismatched unit fails; unmapped units warn', () => {
    const dir = makeTmpPackage({
      'reg.prl': QREGISTER,
      'cs.prl': `condition_set ref {
  role reference
  entries {
    temperature { value 20 unit kg }
    pressure { value 101.325 unit exotic }
  }
}
`,
    });
    const issues = checkPackage(dir).filter(i => i.check === 'C33');
    const errs = issues.filter(i => i.severity === 'error');
    const warns = issues.filter(i => i.severity === 'warning');
    assert.equal(errs.length, 1);
    assert.ok(errs[0].message.includes('entry "temperature"'));
    assert.ok(errs[0].message.includes('kind mass'));
    assert.equal(warns.length, 1);
    assert.ok(warns[0].message.includes('unit "exotic"'));
  });

  it('symbol/verdict declared kind vs unit kind mismatch fails', () => {
    const dir = makeTmpPackage({
      'reg.prl': QREGISTER,
      'sym.prl': `symbol wobble {
  name "w"
  unit "kg"
  quantity_kind temperature
}
verdict drift {
  quantity { kind temperature unit kg }
  derive "ocl{ 1 }"
}
`,
    });
    const c33 = checkPackage(dir).filter(
      i => i.check === 'C33' && i.severity === 'error',
    );
    const messages = c33.map(i => i.message).join('\n');
    assert.ok(messages.includes('symbol wobble'), `C33 symbol:\n${messages}`);
    assert.ok(messages.includes('verdict drift'), `C33 verdict:\n${messages}`);
  });

  it('a coherent model stays silent', () => {
    const dir = makeTmpPackage({
      'defs.prl': QDEFS,
      'reg.prl': QREGISTER,
      'inst.prl': `instance i {
  of Mod
  level model
  definition_versions { Mod : "1" }
  has { attributes { e_max : 2.2 t t_ref : 20 degC e_min : 0 kg } }
}
`,
    });
    const issues = checkPackage(dir).filter(i => i.check === 'C33');
    assert.deepEqual(
      issues,
      [],
      `expected no C33 issues, got:\n${issues.map(i => i.message).join('\n')}`,
    );
  });
});

describe('primmel check — C34 duality-coherence', () => {
  const DUAL_DEFS = QDEFS + '\n' + QREGISTER;

  it('a coherent pair passes', () => {
    const dir = makeTmpPackage({
      'defs.prl': DUAL_DEFS,
      'duals.prl': `dual ok {
  attribute e_max
  designed { value 2.2 unit t tolerance 0.5 }
  exhibited { value 2.19 unit kg uncertainty 0.01 }
}
`,
    });
    const c34 = checkPackage(dir).filter(i => i.check === 'C34');
    assert.deepEqual(
      c34,
      [],
      `expected no C34 issues, got:\n${c34.map(i => i.message).join('\n')}`,
    );
  });

  it('a kind mismatch between roles fails', () => {
    const dir = makeTmpPackage({
      'defs.prl': DUAL_DEFS,
      'duals.prl': `dual bad {
  attribute e_max
  designed { value 2.2 unit t }
  exhibited { value 20 unit degC }
}
`,
    });
    const c34 = checkPackage(dir).filter(i => i.check === 'C34');
    assert.equal(c34.length, 1);
    assert.equal(c34[0].severity, 'error');
    assert.ok(c34[0].message.includes('designed (kind mass)'));
    assert.ok(c34[0].message.includes('exhibited (kind temperature)'));
    assert.ok(c34[0].message.includes('duality-coherence'));
  });

  it('both roles absent fails; a single role passes', () => {
    const dir = makeTmpPackage({
      'defs.prl': DUAL_DEFS,
      'duals.prl': `dual empty { attribute e_max }
dual one { attribute e_max designed { value 2.2 unit t } }
`,
    });
    const c34 = checkPackage(dir).filter(i => i.check === 'C34');
    assert.equal(c34.length, 1);
    assert.ok(c34[0].message.includes('dual empty'));
    assert.ok(c34[0].message.includes('at least one role'));
  });

  it('misplaced tolerance/uncertainty warn; unknown attribute fails', () => {
    const dir = makeTmpPackage({
      'defs.prl': DUAL_DEFS,
      'duals.prl': `dual swapped {
  attribute e_max
  designed { value 2.2 unit t uncertainty 0.1 }
  exhibited { value 2.19 unit t tolerance 0.5 }
}
dual ghost { attribute no_such_attr designed { value 1 unit kg } }
`,
    });
    const c34 = checkPackage(dir).filter(i => i.check === 'C34');
    const errs = c34.filter(i => i.severity === 'error');
    const warns = c34.filter(i => i.severity === 'warning');
    assert.equal(errs.length, 1);
    assert.ok(errs[0].message.includes('dual ghost'));
    assert.equal(warns.length, 2);
    const wm = warns.map(i => i.message).join('\n');
    assert.ok(wm.includes('designed role carries an uncertainty'));
    assert.ok(wm.includes('exhibited role carries a tolerance'));
  });
});

describe('primmel check — C35 time-format', () => {
  it('fires on a timer_event with a malformed period', () => {
    const dir = makeTmpPackage({
      'proc.prl': `process p {
  does {
    start_event s
    action a { executor machine }
    timer_event tick { period "every 12 months" }
    end_event e
    flow { s -> a -> tick -> e }
  }
}
`,
    });
    const c35 = checkPackage(dir).filter(i => i.check === 'C35');
    assert.equal(c35.length, 1);
    assert.equal(c35[0].severity, 'error');
    assert.ok(c35[0].message.includes('"tick"'));
    assert.ok(c35[0].message.includes('not an ISO 8601 duration'));
    assert.ok(c35[0].message.includes('time-format'));
  });

  it('stays silent on a well-formed ISO 8601 period', () => {
    const dir = makeTmpPackage({
      'proc.prl': `process p {
  does {
    start_event s
    action a { executor machine }
    timer_event tick { period "P12M" }
    end_event e
    flow { s -> a -> tick -> e }
  }
}
`,
    });
    const c35 = checkPackage(dir).filter(i => i.check === 'C35');
    assert.deepEqual(c35, []);
  });

  it('fires on a malformed date value for a date-typed attribute', () => {
    const dir = makeTmpPackage({
      'defs.prl': QDEFS,
      'inst.prl': `instance i {
  of Mod
  level model
  definition_versions { Mod : "1" }
  has { attributes { cal_date : "2021-02-29" } }
}
`,
    });
    const c35 = checkPackage(dir).filter(i => i.check === 'C35');
    assert.equal(c35.length, 1);
    assert.ok(c35[0].message.includes('cal_date'));
    assert.ok(c35[0].message.includes('not a valid ISO 8601 date'));
  });
});

describe('primmel check — C36 map-type', () => {
  it('fires on a malformed map type on a class attribute', () => {
    const dir = makeTmpPackage({
      'classes.prl': `class Widget {
  store widgets
  params : map<string> {
    definition "broken map type"
  }
}
`,
    });
    const c36 = checkPackage(dir).filter(i => i.check === 'C36');
    assert.equal(c36.length, 1);
    assert.equal(c36[0].severity, 'error');
    assert.ok(c36[0].message.includes('map<K, V>'));
  });

  it('fires on a malformed map value_type on an attribute_definition', () => {
    const dir = makeTmpPackage({
      'defs.prl': `attribute_definition grid {
  origin declared scope model value_type map<string,map>
}
`,
    });
    const c36 = checkPackage(dir).filter(i => i.check === 'C36');
    assert.equal(c36.length, 1);
    assert.ok(c36[0].message.includes('attribute_definition grid'));
  });

  it('stays silent on well-formed map types and legacy type strings', () => {
    const dir = makeTmpPackage({
      'classes.prl': `class Widget {
  store widgets
  params : map<string,QuantityValue> {
    definition "parameter map"
  }
  name : string {
    definition "legacy primitive type"
  }
}
attribute_definition grid {
  origin declared scope model value_type map<accuracy_class,integer>
}
`,
    });
    const c36 = checkPackage(dir).filter(i => i.check === 'C36');
    assert.deepEqual(c36, []);
  });
});

// ── INV-1 holes closed post-review (C32/C34 hardening) ───────────────

describe('primmel check — C32 physical detection hardening', () => {
  it('an attribute declaring only quantity_kind counts as physical', () => {
    const dir = makeTmpPackage({
      'defs.prl': `subject Mod { }
attribute_definition n_lc {
  origin design-fixed scope model quantity_kind dimensionless
}
`,
      'inst.prl': `instance i {
  of Mod
  level model
  definition_versions { Mod : "1" }
  has { attributes { n_lc : 6000 } }
}
`,
    });
    const c32 = checkPackage(dir).filter(i => i.check === 'C32');
    assert.equal(c32.length, 1);
    assert.equal(c32[0].severity, 'error');
    assert.ok(c32[0].message.includes('attribute "n_lc"'));
    assert.ok(c32[0].message.includes('quantity_kind dimensionless'));
    assert.ok(c32[0].message.includes('INV-1'));
  });

  it("an empty-string unit token counts as bare, not as unit'd", () => {
    const dir = makeTmpPackage({
      'defs.prl': QDEFS,
      'reg.prl': QREGISTER,
      'inst.prl': `instance i {
  of Mod
  level model
  definition_versions { Mod : "1" }
  has { attributes { e_max : 2.2 "" } }
}
`,
    });
    const c32 = checkPackage(dir).filter(i => i.check === 'C32');
    assert.equal(c32.length, 1);
    assert.ok(c32[0].message.includes('attribute "e_max"'));
    assert.ok(c32[0].message.includes('bare number'));
    // …and no stray "unmapped unit" warning for the empty token.
    const c33 = checkPackage(dir).filter(i => i.check === 'C33');
    assert.deepEqual(c33, []);
  });
});

describe('primmel check — C32 condition-set bare values (INV-1)', () => {
  it('a numeric entry value (with tolerance) without a unit is bare', () => {
    const dir = makeTmpPackage({
      'reg.prl': QREGISTER,
      'cs.prl': `condition_set ref {
  role reference
  entries {
    temperature { value 20 tolerance 1 }
  }
}
`,
    });
    const c32 = checkPackage(dir).filter(i => i.check === 'C32');
    assert.equal(c32.length, 1);
    assert.equal(c32[0].severity, 'error');
    assert.ok(c32[0].message.includes('condition_set ref'));
    assert.ok(c32[0].message.includes('entry "temperature"'));
    assert.ok(c32[0].message.includes('inv1-no-bare-quantity'));
  });

  it('numeric-with-unit and free-text values stay silent', () => {
    const dir = makeTmpPackage({
      'reg.prl': QREGISTER,
      'cs.prl': `condition_set ref {
  role reference
  entries {
    temperature { value 20 unit degC tolerance 1 }
    humidity { value "local ambient" }
  }
}
`,
    });
    const issues = checkPackage(dir).filter(
      i => i.check === 'C32' || i.check === 'C33',
    );
    assert.deepEqual(
      issues,
      [],
      `expected no issues, got:\n${issues.map(i => i.message).join('\n')}`,
    );
  });
});

describe('primmel check — C34 bare roles (INV-1)', () => {
  const DUAL_DEFS = QDEFS + '\n' + QREGISTER;

  it('both roles bare fails with one error per role', () => {
    const dir = makeTmpPackage({
      'defs.prl': DUAL_DEFS,
      'duals.prl': `dual bare-both {
  attribute e_max
  designed { value 2.2 tolerance 0.5 }
  exhibited { value 2.19 }
}
`,
    });
    const c34 = checkPackage(dir).filter(i => i.check === 'C34');
    assert.equal(c34.length, 2);
    assert.ok(c34.every(i => i.severity === 'error'));
    const m = c34.map(i => i.message).join('\n');
    assert.ok(
      m.includes(
        'role "designed" of attribute "e_max" is a bare physical value',
      ),
    );
    assert.ok(
      m.includes(
        'role "exhibited" of attribute "e_max" is a bare physical value',
      ),
    );
    assert.ok(m.includes('INV-1'));
    assert.ok(m.includes('duality-coherence'));
  });

  it('one bare role fails with one error', () => {
    const dir = makeTmpPackage({
      'defs.prl': DUAL_DEFS,
      'duals.prl': `dual bare-one { attribute e_max designed { value 3 } }
`,
    });
    const c34 = checkPackage(dir).filter(i => i.check === 'C34');
    assert.equal(c34.length, 1);
    assert.equal(c34[0].severity, 'error');
    assert.ok(c34[0].message.includes('role "designed"'));
  });

  it('roles carrying a unit or an explicit kind stay silent', () => {
    const dir = makeTmpPackage({
      'defs.prl': DUAL_DEFS,
      'duals.prl': `dual ok-units {
  attribute e_max
  designed { value 2.2 unit t tolerance 0.5 }
  exhibited { value 2.19 unit kg uncertainty 0.01 }
}
dual ok-kind {
  attribute e_max
  designed { value 2.2 kind mass tolerance 0.5 }
}
`,
    });
    const c34 = checkPackage(dir).filter(i => i.check === 'C34');
    assert.deepEqual(
      c34,
      [],
      `expected no C34 issues, got:\n${c34.map(i => i.message).join('\n')}`,
    );
  });
});
