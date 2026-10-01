// ─────────────────────────────────────────────────────────────────────
// The LutaML surface (the full flow's phase 2): the class accepts
// `attribute <name>, <Type> { <facets> }` beside the v2 field dialect,
// and the instance accepts the ASSIGNMENT FORM `attribute = value`
// beside the has-facet form. Both surfaces parse through the migration
// window; the class dump preserves the authored form byte-for-byte
// (the canonical emission flips when the window closes).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

describe('the LutaML class surface', () => {
  const src = [
    'class LoadCellSample {',
    '  attribute serial_number, String { definition "The serial number" modality SHALL }',
    '  attribute e_max, Mass { cardinality 1..1 }',
    '  attribute accuracy_class, AccuracyClass { values A B C D }',
    '}',
  ].join('\n');

  it('parses the attribute declarations with their facets', () => {
    const attrs = load(src).dataclasses[0]!.attributes;
    assert.deepEqual(
      attrs.map(a => [a.id, a.type, a.modality, a.cardinality, a.enumValues]),
      [
        ['serial_number', 'String', 'SHALL', '', undefined],
        ['e_max', 'Mass', '', '1..1', undefined],
        ['accuracy_class', 'AccuracyClass', '', '', ['A', 'B', 'C', 'D']],
      ],
    );
  });

  it('the dump preserves the authored form and is a fixed point', () => {
    const out = dump(load(src));
    assert.ok(out.includes('attribute serial_number, String { definition "The serial number" modality SHALL }'));
    assert.ok(out.includes('attribute e_max, Mass { cardinality 1..1 }'));
    assert.equal(dump(load(out)), out);
  });

  it('the v2 field dialect still parses (the migration window)', () => {
    const attrs = load('class C {\n  a : string [0..1] { modality MAY }\n}')
      .dataclasses[0]!.attributes;
    assert.deepEqual(
      [attrs[0]!.id, attrs[0]!.type, attrs[0]!.cardinality, attrs[0]!.modality],
      ['a', 'string', '0..1', 'MAY'],
    );
  });
});

describe('the LutaML instance surface (the assignment form)', () => {
  it('parses attribute = value assignments with quantities', () => {
    const inst = load([
      'class C {',
      '  attribute serial_number, String { definition "sn" }',
      '  attribute e_max, Mass { cardinality 1..1 }',
      '}',
      'instance smp-001 {',
      '  of C',
      '  serial_number = "HBK-001"',
      '  e_max = 2.2 t',
      '}',
    ].join('\n')).instances[0]!;
    assert.equal(inst.id, 'smp-001');
    assert.equal(inst.of, 'C');
    assert.deepEqual(inst.has.attributes['serial_number'], { value: 'HBK-001' });
    assert.deepEqual(inst.has.attributes['e_max'], { value: '2.2', unit: 't' });
  });

  it('the has-facet form still parses (the migration window)', () => {
    const inst = load([
      'instance i {',
      '  of C',
      '  has { attributes { a : "v" } }',
      '}',
    ].join('\n')).instances[0]!;
    assert.deepEqual(inst.has.attributes['a'], { value: 'v' });
  });
});
