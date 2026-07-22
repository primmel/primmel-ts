// ─────────────────────────────────────────────────────────────────────
// TODO.roadmap/17 — the mutation matrix: ONE seeded violation per rule
// family, each caught under its rule id (the task's mutation-test
// acceptance). Families: base, anatomy, process, instantiation, mapping,
// composition, quantities, state, promises, artifacts, characteristics,
// coverage. Deeper per-rule fixtures live in the dedicated suites
// (check.test.ts, mapping-lint, uses-composition, quantities-time-
// duality, operational-state, promises, artifacts, characteristics,
// instance, check-coverage, check-allowlist).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkPackage, type CheckOptions } from '../src/check';
import { checkRule, type CheckFamily } from '../src/check-rules';

function makeTmpPackage(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-mut-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

interface Mutation {
  family: CheckFamily;
  rule: string;
  files: Record<string, string>;
  options?: CheckOptions;
  /** message fragment the seeded issue must carry */
  fragment: string;
}

const MUTATIONS: Mutation[] = [
  {
    family: 'base',
    rule: 'C4',
    fragment: 'store "things" declared by both',
    files: {
      'entities/a.prl': `class A#data { store { things } id: string { modality SHALL } }
class B#data { store { things } id: string { modality SHALL } }`,
    },
  },
  {
    family: 'anatomy',
    rule: 'C8',
    fragment: '"fly"',
    files: {
      'model/s.prl': `behavior measure { kind measurement }
subject LoadCell {
  does { behavior measure behavior fly }
}`,
    },
  },
  {
    family: 'process',
    rule: 'C16',
    fragment: 'duplicate step id "a"',
    files: {
      'model/p.prl': `process p {
  does {
    start_event s
    action a { executor machine }
    action a { executor actor }
    end_event e
    flow { s -> a a -> e }
  }
}`,
    },
  },
  {
    family: 'instantiation',
    rule: 'C18',
    fragment: 'no definition_versions',
    files: {
      'model/i.prl': `subject Mod { }
instance i {
  of Mod
  level model
}`,
    },
  },
  {
    family: 'mapping',
    rule: 'C22',
    fragment:
      'mapping source "StdS#Process5" is a namespaced reference element',
    files: {
      'model/m.prl': `process StdS#Process5 { name "alias of StdS Process5" }
process StdS#Process3 { name "alias of StdS Process3" }
map_profile StdS {
  mapping {
    StdS#Process5 -> StdS#Process3
  }
}`,
    },
  },
  {
    family: 'composition',
    rule: 'C27',
    fragment: 'oiml-ghost',
    options: { resolvePackage: () => undefined },
    files: {
      'model/m.prl': `process OpA { name "A" }`,
    },
  },
  {
    family: 'quantities',
    rule: 'C32',
    fragment: 'bare number',
    files: {
      'model/q.prl': `subject Mod { }
attribute_definition e_max {
  symbol "E_max" origin design-fixed scope model unit t quantity_kind mass
}
quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg }
  unit t { symbol "t" kind mass factor 1000 }
}
instance i {
  of Mod
  level model
  definition_versions { Mod : "1" }
  has { attributes { e_max : 2.2 } }
}`,
    },
  },
  {
    family: 'state',
    rule: 'C40',
    fragment: 'has.state "Ghost" is not a declared state machine',
    files: {
      'model/s.prl': `subject Meter {
  has { state Ghost }
}`,
    },
  },
  {
    family: 'promises',
    rule: 'C42',
    fragment: 'promise-target-resolves',
    files: {
      'model/s.prl': `subject Meter {
  is {
    promises {
      bogus-claim {
        target no_such_characteristic
        statement "holds nothing"
      }
    }
  }
}`,
    },
  },
  {
    family: 'artifacts',
    rule: 'C45',
    fragment: 'content contract declares no fields',
    files: {
      'model/a.prl': `artifact_definition empty-file {
  name "Empty"
  produced_when per_measurement
}`,
    },
  },
  {
    family: 'characteristics',
    rule: 'C49',
    fragment: 'characteristic-behavior-link',
    files: {
      'model/s.prl': `subject Meter {
  has {
    characteristics {
      creep {
        symbol "c_c"
        derivation ocl{abs(creep_reading)}
        behavior ghost_behavior
      }
    }
  }
}`,
    },
  },
  {
    family: 'coverage',
    rule: 'C54',
    fragment: 'table "bogus_table" is not declared',
    files: {
      'model/a.prl': `attribute_definition e_max {
  symbol "E_max" origin design-fixed scope model unit t quantity_kind mass
}`,
      'specification/r.prl': `requirement /req/r {
  binds_to { model.parameters.e_max }
  limit {
    expression "ocl{e_max <= 40}"
    uses { table:bogus_table }
  }
  verification { method testing description "t" }
}
conformance_test /conf/t { targets { /req/r } }
`,
    },
  },
];

describe('mutation matrix — one seeded violation per family (TODO.roadmap/17)', () => {
  const seenFamilies = new Set<string>();
  for (const m of MUTATIONS) {
    it(`${m.family}: seeded ${m.rule} violation is caught`, () => {
      seenFamilies.add(m.family);
      // The catalog agrees with the test's family assignment.
      assert.equal(
        checkRule(m.rule)?.family,
        m.family,
        `${m.rule} catalog family`,
      );
      const dir = makeTmpPackage(m.files);
      if (m.family === 'composition') {
        // The mutation is the dangling use itself.
        writeFileSync(
          join(dir, 'package.primmel'),
          'package { id test uses { oiml-ghost } }',
        );
      }
      try {
        const issues = checkPackage(dir, m.options ?? {});
        const hit = issues.filter(i => i.check === m.rule);
        assert.ok(
          hit.some(i => i.message.includes(m.fragment)),
          `expected [${m.rule}] "${m.fragment}", got:\n${issues
            .map(i => `[${i.check}] ${i.message}`)
            .join('\n')}`,
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  it('covers all twelve families', () => {
    assert.deepEqual([...seenFamilies].sort(), [
      'anatomy',
      'artifacts',
      'base',
      'characteristics',
      'composition',
      'coverage',
      'instantiation',
      'mapping',
      'process',
      'promises',
      'quantities',
      'state',
    ]);
  });
});
