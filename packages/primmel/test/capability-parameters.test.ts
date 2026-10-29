// ─────────────────────────────────────────────────────────────────────
// The datum unification's first rung (TODO.lang-gaps/04, spec
// [[datum-unification]]): the capability's `has_parameters` list is the
// composition-scoped plane of the one "named, typed, unit-ed value"
// substrate. The list reads bare ids (the legacy attribute_definition
// alias) and inline `datum <id> [: <type>] { … }` declarations — the
// parse delegates to the top-level datum parser, the resolved list
// stays string ids, and the C190 capability-parameters-resolve leg
// judges every member against the declared datum ∪ attribute_definition
// register.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { loadPackage } from '../src/ser-des/package';
import { checkPackage } from '../src/check';

// The legacy alias: the member names a declared attribute_definition.
const ATTR_ALIAS = `
attribute_definition efficiency {
  name "Efficiency"
  value_type QuantityValue
  origin declared
}

capability gauge {
  label "Gauge"
  has_parameters { efficiency }
}
`;

// The substrate spelling: an inline datum declared in place.
const INLINE_DATUM = `
capability gauge {
  label "Gauge"
  has_parameters {
    efficiency
    datum stability : ratio { unit "1" origin design-fixed label "Stability" }
  }
}

attribute_definition efficiency {
  name "Efficiency"
  value_type QuantityValue
  origin declared
}
`;

// An undeclared member — the seeded C190 violation.
const UNDECLARED = `
capability gauge {
  label "Gauge"
  has_parameters { phantom_param }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-c190-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('capability has_parameters inline datum (TODO.lang-gaps/04)', () => {
  it('parses inline datums among bare ids; the list stays string ids', () => {
    const m = load(INLINE_DATUM);
    const gauge = m.capabilities.find(c => c.id === 'gauge')!;
    assert.deepEqual(gauge.hasParameters, ['efficiency', 'stability']);
    // The inline declaration registers in the datum register — the same
    // substrate the bare members name.
    const stability = m.datums.find(d => d.id === 'stability')!;
    assert.ok(stability);
    assert.equal(stability.unit, '1');
    assert.equal(stability.origin, 'design-fixed');
    assert.equal(stability.label, 'Stability');
  });

  it('the typed spelling rides the parg into the same datum parse', () => {
    const m = load(`
      capability gauge {
        has_parameters { datum stability : ratio { unit "1" } }
      }
    `);
    assert.deepEqual(
      m.capabilities.map(c => c.hasParameters),
      [['stability']],
    );
    assert.equal(m.datums.length, 1);
    assert.equal(m.datums[0]!.id, 'stability');
  });

  it('normalizes the inline declaration to a top-level datum (fixpoint)', () => {
    const m1 = load(INLINE_DATUM);
    const dumped = dump(m1);
    // The dump emits the datum at top level and the list as bare ids.
    assert.ok(dumped.includes('datum stability {'));
    assert.ok(dumped.includes('has_parameters { efficiency stability }'));
    const m2 = load(dumped);
    assert.deepEqual(m2.datums, m1.datums);
    assert.deepEqual(m2.capabilities, m1.capabilities);
    assert.equal(dump(m2), dumped);
  });

  it('an inline datum with no block refuses at parse', () => {
    assert.throws(
      () =>
        load(`
          capability gauge {
            has_parameters { datum stability }
          }
        `),
      /inline datum "stability" in has_parameters expects/,
    );
  });
});

describe('C190 capability-parameters-resolve', () => {
  it('accepts the legacy attribute_definition alias', () => {
    const issues = checkPackage(makePackage(ATTR_ALIAS)).filter(
      i => i.check === 'C190',
    );
    assert.deepEqual(issues, []);
  });

  it('accepts a declared datum member', () => {
    const issues = checkPackage(
      makePackage(`
        datum efficiency : ratio { unit "1" }
        capability gauge { has_parameters { efficiency } }
      `),
    ).filter(i => i.check === 'C190');
    assert.deepEqual(issues, []);
  });

  it('accepts an inline datum member (resolves by construction)', () => {
    const issues = checkPackage(
      makePackage(`
        capability gauge {
          has_parameters { datum stability : ratio { unit "1" } }
        }
      `),
    ).filter(i => i.check === 'C190');
    assert.deepEqual(issues, []);
  });

  it('flags a member nothing declares (seeded violation)', () => {
    const issues = checkPackage(makePackage(UNDECLARED)).filter(
      i => i.check === 'C190',
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.severity, 'error');
    assert.ok(issues[0]!.message.includes('gauge'));
    assert.ok(issues[0]!.message.includes('"phantom_param"'));
  });
});

describe('capability parameters across the uses closure', () => {
  it(
    'a downstream capability naming the base package attribute_definitions ' +
      'resolves through the composed register',
    () => {
      const dirs = new Map<string, string>();
      const make = (
        id: string,
        manifest: string,
        files: Record<string, string>,
      ): string => {
        const dir = mkdtempSync(join(tmpdir(), `primmel-c190-${id}-`));
        writeFileSync(join(dir, 'package.primmel'), manifest);
        for (const [rel, content] of Object.entries(files)) {
          const path = join(dir, rel);
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, content);
        }
        dirs.set(id, dir);
        return dir;
      };
      make('cap-base', 'package { id cap-base kind core }', {
        'model/attrs.prl': `
            attribute_definition efficiency {
              name "Efficiency"
              value_type QuantityValue
              origin declared
            }
          `,
      });
      const downDir = make(
        'cap-down',
        'package { id cap-down uses { cap-base } }',
        {
          'model/caps.prl': `
            capability meter { has_parameters { efficiency } }
          `,
        },
      );
      const resolvePackage = (id: string): string | undefined => dirs.get(id);
      // The composed standard carries the id list (has_parameters rides
      // the capability merge — no new collection).
      const std = loadPackage(downDir, { resolvePackage });
      assert.deepEqual(std.capabilities[0]!.hasParameters, ['efficiency']);
      const issues = checkPackage(downDir, { resolvePackage }).filter(
        i => i.check === 'C190',
      );
      assert.deepEqual(issues, []);
      // The same package without the locator cannot see the base
      // register — the composition is what carries the resolution.
      const alone = checkPackage(downDir).filter(i => i.check === 'C190');
      assert.equal(alone.length, 1);
      assert.ok(alone[0]!.message.includes('"efficiency"'));
    },
  );
});
