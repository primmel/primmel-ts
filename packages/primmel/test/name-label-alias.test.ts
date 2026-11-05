// ─────────────────────────────────────────────────────────────────────
// The name→label unification (the register's item 6, the proceed-all
// waves): `label` is the authoring alias of the `name` facet wherever
// a name facet exists — both spellings parse identically, the wire
// field stays `name`. RUNG TWO (executed 2026-11-05): the canonical
// dump emits `label` — the wire field stays `name`, the serialization
// spells the authored vocabulary. The datum's own `label`
// facet is unaffected (it has no name facet to alias).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../src/ser-des';
import type Standard from '../src/types/Standard';

const parse = (src: string): Standard => load(src);

const ANCHOR = 'requirement /req/a {\n name "Anchor"\n statement { S }\n}\n';

describe('label is the authoring alias of name', () => {
  it('the requirement name accepts label', () => {
    const std = parse(
      `${ANCHOR}requirement /req/b {\n label "The requirement"\n statement { S }\n}\n`,
    );
    assert.equal(std.requirements![1]!.name, 'The requirement');
  });

  it('the symbol name accepts label', () => {
    const std = parse(
      `${ANCHOR}symbol s { name "S" type number }\nsymbol t { label "T" type number }\n`,
    );
    assert.equal(std.symbols![1]!.name, 'T');
  });

  it('the form name accepts label; the field label stays its own facet', () => {
    const std = parse(
      `${ANCHOR}form f {\n label "The form"\n field x { label "X" }\n}\n`,
    );
    assert.equal(std.forms![0]!.name, 'The form');
    assert.equal(std.forms![0]!.fields![0]!.name, 'x');
    assert.equal(std.forms![0]!.fields![0]!.label, 'X');
  });

  it('the conformance test name accepts label', () => {
    const std = parse(`${ANCHOR}conformance_test t {\n label "The test"\n}\n`);
    assert.equal(std.conformanceTests![0]!.name, 'The test');
  });

  it('the process name accepts label', () => {
    const std = parse(`${ANCHOR}process p {\n label "The process"\n}\n`);
    assert.equal(std.processes![0]!.name, 'The process');
  });

  it('the attribute_definition name accepts label', () => {
    const std = parse(
      `${ANCHOR}attribute_definition x { symbol "X" label "The attribute" }\n`,
    );
    assert.equal(std.attributeDefinitions![0]!.name, 'The attribute');
  });

  it('the datum label facet is its own (no name facet to alias)', () => {
    const std = parse(
      `${ANCHOR}datum d : number { label "Reference volume" }\n`,
    );
    const datum = std.datums![0] as unknown as { label: string; name?: string };
    assert.equal(datum.label, 'Reference volume');
  });

  it('the dump keeps the canonical name spelling', () => {
    const std = parse(
      `${ANCHOR}requirement /req/b {\n label "The requirement"\n statement { S }\n}\n`,
    );
    const json = JSON.stringify(std);
    assert.ok(json.includes('"name":"The requirement"'));
    assert.ok(!json.includes('"label":"The requirement"'));
  });

  it('the two spellings load identically', () => {
    const a = parse(`${ANCHOR}symbol s { name "S" type number }\n`);
    const b = parse(`${ANCHOR}symbol s { label "S" type number }\n`);
    assert.deepEqual(
      JSON.parse(JSON.stringify(a.symbols)),
      JSON.parse(JSON.stringify(b.symbols)),
    );
  });
});
