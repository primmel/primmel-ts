// ─────────────────────────────────────────────────────────────────────
// Mapping linter rules C21–C26 (TODO.roadmap/04; concept doc §5.8):
//   C21 mapping-resolves            — both ends of every mapping resolve
//   C22 mapping-direction           — implementation → reference only
//   C23 mapping-calculus-consistency — authored assertions vs the calculus
//   C24 import-not-mapping          — inclusion ≠ fulfilment
//   C25 mapping-description         — warning at audit strictness
//   C26 view-read-only              — views read, never invent or edit
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { checkPackage } from '../src/check';
import { load } from '../src/ser-des/index';

function makePackage(
  files: Record<string, string>,
  manifest = 'package { id OrgO }',
): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-mapping-lint-'));
  writeFileSync(join(dir, 'package.primmel'), manifest);
  for (const [rel, content] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return dir;
}

const CLEAN_MODEL = `
process OpA { name "Operation A" }
process OpB { name "Operation B" }
process StdS#Process5 { name "alias of StdS Process5" }
process StdS#Process3 { name "alias of StdS Process3" }
map_profile StdS {
  description "Mappings into Standard S"
  mapping {
    OpA -> StdS#Process5 { description "A fulfils 5" }
    OpB -> StdS#Process3 { description "B fulfils 3" }
  }
}
`;

describe('C21 mapping-resolves', () => {
  it('stays silent when both ends of every mapping resolve', () => {
    const dir = makePackage({ 'model/m.prl': CLEAN_MODEL });
    const issues = checkPackage(dir).filter(i =>
      ['C21', 'C22', 'C23', 'C24', 'C25', 'C26'].includes(i.check),
    );
    assert.deepEqual(issues, []);
  });

  it('flags an undeclared source component', () => {
    const dir = makePackage({
      'model/m.prl': `
        process OpA { name "A" }
        process StdS#Process5 { name "alias" }
        map_profile StdS { mapping { Ghost -> StdS#Process5 } }
      `,
    });
    const c21 = checkPackage(dir).filter(i => i.check === 'C21');
    assert.equal(c21.length, 1);
    assert.equal(c21[0].severity, 'error');
    assert.ok(c21[0].message.includes('"Ghost"'));
    assert.ok(c21[0].message.includes('not a declared component'));
  });

  it('flags a target with no declared Namespace#ElementID alias', () => {
    const dir = makePackage({
      'model/m.prl': `
        process OpA { name "A" }
        map_profile StdS { mapping { OpA -> StdS#Process9 } }
      `,
    });
    const c21 = checkPackage(dir).filter(i => i.check === 'C21');
    assert.equal(c21.length, 1);
    assert.ok(c21[0].message.includes('StdS#Process9'));
    assert.ok(c21[0].message.includes('no declared alias element'));
  });

  it('flags a target namespace that differs from the profile namespace', () => {
    const dir = makePackage({
      'model/m.prl': `
        process OpA { name "A" }
        process Other#X { name "alias" }
        map_profile StdS { mapping { OpA -> Other#X } }
      `,
    });
    const c21 = checkPackage(dir).filter(i => i.check === 'C21');
    assert.ok(c21.some(i => i.message.includes('≠ the profile namespace')));
  });
});

describe('C22 mapping-direction', () => {
  it('flags a namespaced (reference) element as the mapping source', () => {
    const dir = makePackage({
      'model/m.prl': `
        process StdS#Process5 { name "alias" }
        map_profile StdS { mapping { StdS#Process5 -> StdS#Process5 } }
      `,
    });
    const c22 = checkPackage(dir).filter(i => i.check === 'C22');
    assert.equal(c22.length, 1);
    assert.equal(c22[0].severity, 'error');
    assert.ok(c22[0].message.includes('implementation → reference'));
  });

  it('flags a mapping into the model’s own namespace', () => {
    const dir = makePackage({
      'model/m.prl': `
        process OpA { name "A" }
        process OrgO#OpA { name "alias" }
        map_profile OrgO { mapping { OpA -> OrgO#OpA } }
      `,
    });
    const c22 = checkPackage(dir).filter(i => i.check === 'C22');
    assert.ok(
      c22.some(i => i.message.includes("the model's own namespace")),
      `expected own-namespace C22, got: ${c22.map(i => i.message).join('\n')}`,
    );
  });
});

describe('C23 mapping-calculus-consistency', () => {
  const ALIAS_FOREST = `
process OpA { name "A" }
process OpB { name "B" }
process StdS#Process1 {
  name "alias of Process1"
  process StdS#Process3 { name "alias 3" }
  process StdS#Process4 { name "alias 4" }
}
process StdS#Process2 {
  name "alias of Process2"
  child_composition gateway
  process StdS#Process5 { name "alias 5" }
  process StdS#Process6 { name "alias 6" }
}
`;

  it('agrees silently when assertions match the computed calculus', () => {
    const dir = makePackage({
      'model/m.prl':
        ALIAS_FOREST +
        `
map_profile StdS {
  mapping {
    OpA -> StdS#Process5 { description "d" coverage full }
    OpB -> StdS#Process3 { description "d" coverage full }
  }
  coverage {
    StdS#Process2 minimal
    StdS#Process1 partial
    StdS#Process4 none
  }
}
`,
    });
    const c23 = checkPackage(dir).filter(i => i.check === 'C23');
    assert.deepEqual(
      c23,
      [],
      `expected no C23, got: ${c23.map(i => i.message).join('\n')}`,
    );
  });

  it('errors when a per-pair assertion disagrees with the calculus', () => {
    const dir = makePackage({
      'model/m.prl':
        ALIAS_FOREST +
        `
map_profile StdS {
  mapping {
    OpA -> StdS#Process5 { description "d" coverage minimal }
  }
}
`,
    });
    const c23 = checkPackage(dir).filter(i => i.check === 'C23');
    assert.equal(c23.length, 1);
    assert.equal(c23[0].severity, 'error');
    assert.ok(c23[0].message.includes('asserts coverage "minimal"'));
    assert.ok(c23[0].message.includes('computes "full"'));
  });

  it('errors when a profile-level tripwire disagrees with the calculus', () => {
    const dir = makePackage({
      'model/m.prl':
        ALIAS_FOREST +
        `
map_profile StdS {
  mapping {
    OpA -> StdS#Process5 { description "d" }
    OpB -> StdS#Process3 { description "d" }
  }
  coverage { StdS#Process1 full }
}
`,
    });
    const c23 = checkPackage(dir).filter(i => i.check === 'C23');
    assert.equal(c23.length, 1);
    assert.ok(c23[0].message.includes('StdS#Process1: full'));
    assert.ok(c23[0].message.includes('computed "partial"'));
  });

  it('computes against a supplied reference model when provided', () => {
    // The package declares only FLAT aliases (no tree); the real tree
    // comes from options.references — the gateway parent computes minimal.
    const dir = makePackage({
      'model/m.prl': `
        process OpA { name "A" }
        process StdS#Process2 { name "alias 2" }
        process StdS#Process5 { name "alias 5" }
        map_profile StdS {
          mapping { OpA -> StdS#Process5 { description "d" } }
          coverage { StdS#Process2 minimal }
        }
      `,
    });
    const reference = load(`
      process Process2 {
        child_composition gateway
        process Process5 { name "5" }
        process Process6 { name "6" }
      }
    `);
    const issues = checkPackage(dir, { references: { StdS: reference } });
    const c23 = issues.filter(i => i.check === 'C23');
    assert.deepEqual(
      c23,
      [],
      `expected no C23 with the reference supplied, got: ${c23
        .map(i => i.message)
        .join('\n')}`,
    );
  });
});

describe('C24 import-not-mapping', () => {
  it('flags a map_profile whose namespace is imported via uses', () => {
    const dir = makePackage(
      { 'model/m.prl': CLEAN_MODEL },
      'package { id OrgO uses { StdS } }',
    );
    const c24 = checkPackage(dir).filter(i => i.check === 'C24');
    assert.equal(c24.length, 1);
    assert.equal(c24[0].severity, 'error');
    assert.ok(c24[0].message.includes('import-not-mapping'));
    assert.ok(c24[0].message.includes('inclusion ≠ fulfilment'));
  });

  it('flags a map_profile whose namespace is imported via extends', () => {
    const dir = makePackage(
      { 'model/m.prl': CLEAN_MODEL },
      'package { id OrgO extends StdS }',
    );
    const c24 = checkPackage(dir).filter(i => i.check === 'C24');
    assert.equal(c24.length, 1);
  });

  it('stays silent when imports and mappings are disjoint', () => {
    const dir = makePackage(
      { 'model/m.prl': CLEAN_MODEL },
      'package { id OrgO uses { QmsOps } extends oiml-core }',
    );
    const c24 = checkPackage(dir).filter(i => i.check === 'C24');
    assert.deepEqual(c24, []);
  });
});

describe('C25 mapping-description', () => {
  const UNDOCUMENTED = `
process OpA { name "A" }
process StdS#Process5 { name "alias" }
map_profile StdS { mapping { OpA -> StdS#Process5 } }
`;

  it('stays silent at normal strictness', () => {
    const dir = makePackage({ 'model/m.prl': UNDOCUMENTED });
    const c25 = checkPackage(dir).filter(i => i.check === 'C25');
    assert.deepEqual(c25, []);
  });

  it('warns at audit strictness', () => {
    const dir = makePackage({ 'model/m.prl': UNDOCUMENTED });
    const c25 = checkPackage(dir, { strictness: 'audit' }).filter(
      i => i.check === 'C25',
    );
    assert.equal(c25.length, 1);
    assert.equal(c25[0].severity, 'warning');
    assert.ok(c25[0].message.includes('mapping-description'));
  });
});

describe('C26 view-read-only', () => {
  it('stays silent on a clean lens', () => {
    const dir = makePackage({
      'model/m.prl':
        CLEAN_MODEL +
        `
view_profile QmsLens {
  description "The QMS lens"
  visible { OpA }
  against StdS
}
`,
    });
    const c26 = checkPackage(dir).filter(i => i.check === 'C26');
    assert.deepEqual(c26, []);
  });

  it('flags a view naming undeclared elements', () => {
    const dir = makePackage({
      'model/m.prl':
        CLEAN_MODEL +
        `
view_profile Lens { visible { OpA Ghost } against StdS }
`,
    });
    const c26 = checkPackage(dir).filter(i => i.check === 'C26');
    assert.equal(c26.length, 1);
    assert.ok(c26[0].message.includes('"Ghost"'));
    assert.ok(c26[0].message.includes('view-read-only'));
  });

  it('flags a view reading against a namespace the model does not map to', () => {
    const dir = makePackage({
      'model/m.prl':
        CLEAN_MODEL +
        `
view_profile Lens { visible { OpA } against StdT }
`,
    });
    const c26 = checkPackage(dir).filter(i => i.check === 'C26');
    assert.equal(c26.length, 1);
    assert.ok(c26[0].message.includes('against "StdT"'));
  });
});

describe('standalone .prm files in a package are linted too', () => {
  it('checks both ends of .prm pairs', () => {
    const dir = makePackage({
      'model/m.prl': `
        process OpA { name "A" }
      `,
      'mappings.prm': `{
        "@type": "Primmel_MAP",
        "id": "org-to-std",
        "mapSet": {
          "StdS": {
            "id": "StdS",
            "mappings": {
              "OpA": { "StdS#Process5": { "description": "d", "justification": "" } }
            }
          }
        }
      }`,
    });
    const c21 = checkPackage(dir).filter(i => i.check === 'C21');
    assert.equal(c21.length, 1);
    assert.ok(c21[0].message.includes('StdS#Process5'));
  });

  it('reports a malformed .prm as a lint error naming the file', () => {
    const dir = makePackage({
      'model/m.prl': 'process OpA { name "A" }',
      'broken.prm': 'not json at all',
    });
    const c21 = checkPackage(dir).filter(i => i.check === 'C21');
    assert.equal(c21.length, 1);
    assert.ok(c21[0].message.includes('broken.prm'));
  });
});
