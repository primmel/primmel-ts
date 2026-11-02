// ─────────────────────────────────────────────────────────────────────
// The origin axis is closed (the origin-axis wave): the flat facets on
// attribute_definition and symbol, the datum block, and the LutaML
// attribute surface all take the four axis tokens only — the retired
// free-form spellings (measured, derived, test-dependent, lookup)
// refuse at parse, naming the axis. The corpus migrated onto the axis
// before the enforcement landed (180 sites, model-library); the
// fixtures migrated with it.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../src/ser-des';
import type Standard from '../src/types/Standard';

const parse = (src: string): Standard => load(src);

const AX = 'declared, design-fixed, observed, computed';

describe('the origin axis is closed', () => {
  it('every axis token parses on the attribute flat facet', () => {
    for (const origin of ['declared', 'design-fixed', 'observed', 'computed']) {
      const std = parse(
        `requirement /req/a {\n name "A"\n statement { S }\n}\nattribute_definition x { symbol "X" origin ${origin} }\n`,
      );
      assert.equal(std.attributeDefinitions![0]!.origin, origin);
    }
  });

  it('every axis token parses on the symbol flat facet', () => {
    for (const origin of ['declared', 'design-fixed', 'observed', 'computed']) {
      const std = parse(
        `requirement /req/a {\n name "A"\n statement { S }\n}\nsymbol s { name "S" type number origin ${origin} }\n`,
      );
      assert.equal(std.symbols![0]!.origin, origin);
    }
  });

  for (const retired of ['measured', 'derived', 'test-dependent', 'lookup']) {
    it(`the attribute flat origin refuses "${retired}"`, () => {
      assert.throws(
        () =>
          parse(
            `requirement /req/a {\n name "A"\n statement { S }\n}\nattribute_definition x { symbol "X" origin ${retired} }\n`,
          ),
        new RegExp(
          `Unknown origin "${retired}" \\(valid: ${AX.replaceAll(',', ',')}\\)`,
        ),
      );
    });
    it(`the symbol flat origin refuses "${retired}"`, () => {
      assert.throws(
        () =>
          parse(
            `requirement /req/a {\n name "A"\n statement { S }\n}\nsymbol s { name "S" type number origin ${retired} }\n`,
          ),
        /Unknown origin/,
      );
    });
  }

  it('the LutaML datum surface refuses a retired token (no silent declared)', () => {
    assert.throws(
      () => parse(`datum d { origin design-variable }\n`),
      /Unknown origin "design-variable"/,
    );
  });

  it('an omitted origin stays absent on both carriers', () => {
    const std = parse(
      `requirement /req/a {\n name "A"\n statement { S }\n}\nattribute_definition x { symbol "X" }\nsymbol s { name "S" type number }\n`,
    );
    assert.equal(std.attributeDefinitions![0]!.origin, '');
    assert.equal(std.symbols![0]!.origin, '');
  });

  it('the round trip keeps the axis tokens verbatim', () => {
    const src = `requirement /req/a {\n name "A"\n statement { S }\n}\nattribute_definition x { symbol "X" origin design-fixed }\nsymbol s { name "S" type number origin computed }\n`;
    const std = parse(src);
    assert.ok(JSON.stringify(std).includes('"origin":"design-fixed"'));
    assert.ok(JSON.stringify(std).includes('"origin":"computed"'));
  });
});
