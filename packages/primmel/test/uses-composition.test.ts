// ─────────────────────────────────────────────────────────────────────
// `uses` composition (TODO.roadmap/05) — multi-package topological merge:
//   - loadPackage with a resolvePackage locator composes the uses closure
//     in topological order with no-redefine semantics
//   - extends is parsed as a deprecated single-entry uses (warning)
//   - requires satisfied by the composed set (error); provides consumed
//     by a downstream package or explicitly waived (warning)
//   - linter rules C27 uses-resolves, C28 uses-no-redefine, C29
//     uses-cycle, C30 provides-consumed-or-waived, C31 requires-satisfied
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import {
  CompositionError,
  loadPackage,
  loadPackageWithIssues,
} from '../src/ser-des/package';
import {
  dumpPackage,
  parsePackage,
} from '../src/ser-des/config/packageManifest';
import { checkManifestResolution, checkPackage } from '../src/check';
import type { PackageManifest } from '../src/types/Package';

// ── Fixture packages: toy core + one module + one rec ────────────────

const dirs = new Map<string, string>();

function makePackage(
  id: string,
  manifest: string,
  files: Record<string, string>,
): string {
  const dir = mkdtempSync(join(tmpdir(), `primmel-uses-${id}-`));
  writeFileSync(join(dir, 'package.primmel'), manifest);
  for (const [rel, content] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  dirs.set(id, dir);
  return dir;
}

const resolvePackage = (id: string): string | undefined => dirs.get(id);

/** Drop an extra content file into an already-built fixture package. */
function addFile(dir: string, rel: string, content: string): void {
  const path = join(dir, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** core + module + rec with everything consumed/required — the happy path. */
function makeHappyComposition(): string {
  makePackage(
    'toy-core',
    'package { id toy-core kind core provides { base-entities } }',
    {
      'entities/base.prl': `class BaseThing#data {
  store { baseThings }
  id: string [1..1] { modality SHALL }
}`,
      'terminology.prl': `term base-term {
  label "base"
  definition "base term"
}`,
      'model/subjects.prl': `subject ToyBase {
  is { metadata { name "Toy base" } }
}`,
    },
  );
  makePackage(
    'toy-module',
    'package { id toy-module kind module uses { toy-core } requires { toy-core base-entities } provides { module-patterns } }',
    {
      'model/attributes.prl': `attribute_definition m_attr {
  symbol "M"
  origin design-fixed
  scope model
}`,
      // References upstream (core) ids: the subject extends core's ToyBase.
      'model/subjects.prl': `subject ToyChild {
  extends ToyBase
  is { metadata { name "Toy child" } }
}`,
    },
  );
  return makePackage(
    'toy-rec',
    'package { id toy-rec kind rec uses { toy-core toy-module } requires { module-patterns } }',
    {
      'execution/forms.prl': `form F1 {
  name "F"
  field m : number { bind model.parameters.m_attr }
}`,
      'terminology.prl': `term rec-term {
  label "rec"
  definition "rec term"
}`,
    },
  );
}

describe('uses composition — manifest', () => {
  it('parses kind/provides/requires/waives and round-trips them', () => {
    const ctx: { packageManifest: PackageManifest | null } = {
      packageManifest: null,
    };
    parsePackage(
      'package { id m kind module uses { a b } provides { p1 p2 } requires { a } waives { b:p2 } }',
    )(ctx as any);
    const m = ctx.packageManifest!;
    assert.equal(m.id, 'm');
    assert.equal(m.kind, 'module');
    assert.deepEqual(m.uses, ['a', 'b']);
    assert.deepEqual(m.provides, ['p1', 'p2']);
    assert.deepEqual(m.requires, ['a']);
    assert.deepEqual(m.waives, ['b:p2']);

    const dumped = dumpPackage(m);
    assert.match(dumped, /kind module/);
    assert.match(dumped, /uses { a b }/);
    assert.match(dumped, /provides { p1 p2 }/);
    assert.match(dumped, /requires { a }/);
    assert.match(dumped, /waives { b:p2 }/);

    const ctx2: { packageManifest: PackageManifest | null } = {
      packageManifest: null,
    };

    parsePackage(dumped)(ctx2 as any);
    assert.deepEqual(ctx2.packageManifest, m);
  });

  it('an unknown kind value is a parse error naming the valid kinds', () => {
    assert.throws(
      () => parsePackage('package { id m kind banana }'),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.match(
          e.message,
          /Expected kind core\|module\|rec\|product_reference\|certification_program, got "banana"/,
        );
        return true;
      },
    );
    // An absent kind stays legal (an ordinary rec package).
    const ctx: { packageManifest: PackageManifest | null } = {
      packageManifest: null,
    };
    parsePackage('package { id m }')(ctx as any);
    assert.equal(ctx.packageManifest!.kind, undefined);
  });
});

describe('uses composition — loader', () => {
  it('merges core + module + rec in topological order', () => {
    const recDir = makeHappyComposition();
    const { standard, issues, composition } = loadPackageWithIssues(recDir, {
      resolvePackage,
    });
    assert.deepEqual(composition?.order, ['toy-core', 'toy-module', 'toy-rec']);
    assert.equal(composition?.root, 'toy-rec');
    // Content from every package is present in the merged Standard.
    assert.ok(standard.dataclasses.some(c => c.id === 'BaseThing#data'));
    assert.ok(standard.terms.some(t => t.id === 'base-term'));
    assert.ok(standard.attributeDefinitions.some(a => a.id === 'm_attr'));
    assert.ok(standard.forms.some(f => f.id === 'F1'));
    assert.ok(standard.terms.some(t => t.id === 'rec-term'));
    // Cross-package reference: the module's subject extends core's subject
    // — a successfully merged chain clears `extends` at resolve time.
    const child = standard.subjects.find(s => s.id === 'ToyChild');
    assert.ok(child, 'ToyChild present');
    assert.ok(!child.extends, 'extends chain merged across packages');
    // The root manifest wins, with the manifest extensions parsed.
    assert.equal(standard.packageManifest?.id, 'toy-rec');
    assert.equal(standard.packageManifest?.kind, 'rec');
    assert.deepEqual(standard.packageManifest?.uses, [
      'toy-core',
      'toy-module',
    ]);
    // Everything is required or waived — no provides warnings.
    assert.deepEqual(
      issues.filter(i => i.code === 'provides-unconsumed'),
      [],
    );
  });

  it('topological order is deterministic regardless of the declared uses order', () => {
    makeHappyComposition();
    // Rec declares the module BEFORE the core; the module uses the core.
    makePackage(
      'toy-rec2',
      'package { id toy-rec2 kind rec uses { toy-module toy-core } }',
      {},
    );
    const { composition } = loadPackageWithIssues(dirs.get('toy-rec2')!, {
      resolvePackage,
    });
    assert.deepEqual(composition?.order, [
      'toy-core',
      'toy-module',
      'toy-rec2',
    ]);
  });

  it('a diamond (A→B,C; B,C→D) merges D exactly once, in deterministic order, with no cycle', () => {
    makePackage('diamond-d', 'package { id diamond-d kind core }', {
      'entities/base.prl': `class DiamondBase#data {
  store { diamondBases }
  id: string [1..1] { modality SHALL }
}`,
    });
    makePackage(
      'diamond-b',
      'package { id diamond-b kind module uses { diamond-d } }',
      {
        'model/attributes.prl': `attribute_definition diamond_b_attr {
  symbol "DB"
  origin design-fixed
  scope model
}`,
      },
    );
    makePackage(
      'diamond-c',
      'package { id diamond-c kind module uses { diamond-d } }',
      {
        'model/attributes.prl': `attribute_definition diamond_c_attr {
  symbol "DC"
  origin design-fixed
  scope model
}`,
      },
    );
    const aDir = makePackage(
      'diamond-a',
      'package { id diamond-a kind rec uses { diamond-b diamond-c } }',
      {},
    );
    const { standard, composition } = loadPackageWithIssues(aDir, {
      resolvePackage,
    });
    // D before both B and C (DFS post-order over the declared uses
    // order), root last — and D appears exactly once.
    assert.deepEqual(composition?.order, [
      'diamond-d',
      'diamond-b',
      'diamond-c',
      'diamond-a',
    ]);
    // D's content is merged exactly once, and both branches' content
    // survives.
    assert.equal(
      standard.dataclasses.filter(c => c.id === 'DiamondBase#data').length,
      1,
    );
    assert.ok(
      standard.attributeDefinitions.some(a => a.id === 'diamond_b_attr'),
    );
    assert.ok(
      standard.attributeDefinitions.some(a => a.id === 'diamond_c_attr'),
    );
  });

  it('a redefinition of an upstream id is a load error naming both packages', () => {
    makeHappyComposition();
    addFile(
      dirs.get('toy-rec')!,
      'entities/redef.prl',
      'class BaseThing#data { store { redefined } }',
    );
    assert.throws(
      () => loadPackage(dirs.get('toy-rec')!, { resolvePackage }),
      (e: unknown) => {
        assert.ok(e instanceof CompositionError);
        assert.equal(e.rule, 'uses-no-redefine');
        assert.match(e.message, /"toy-rec"/);
        assert.match(e.message, /"toy-core"/);
        assert.match(e.message, /BaseThing#data/);
        return true;
      },
    );
  });

  it('a uses cycle is a load error naming the cycle', () => {
    makePackage('cyc-a', 'package { id cyc-a uses { cyc-b } }', {});
    makePackage('cyc-b', 'package { id cyc-b uses { cyc-a } }', {});
    assert.throws(
      () => loadPackage(dirs.get('cyc-a')!, { resolvePackage }),
      (e: unknown) => {
        assert.ok(e instanceof CompositionError);
        assert.equal(e.rule, 'uses-cycle');
        assert.match(e.message, /cyc-a → cyc-b → cyc-a/);
        return true;
      },
    );
  });

  it('an unresolvable uses entry is a load error naming it', () => {
    makePackage(
      'ghost-rec',
      'package { id ghost-rec uses { ghost-core } }',
      {},
    );
    assert.throws(
      () => loadPackage(dirs.get('ghost-rec')!, { resolvePackage }),
      (e: unknown) => {
        assert.ok(e instanceof CompositionError);
        assert.equal(e.rule, 'uses-resolves');
        assert.match(e.message, /ghost-core/);
        return true;
      },
    );
  });

  it('an unsatisfied requires entry is a load error naming it', () => {
    makePackage('needy-core', 'package { id needy-core kind core }', {});
    makePackage(
      'needy-module',
      'package { id needy-module uses { needy-core } requires { no-such-capability } }',
      {},
    );
    assert.throws(
      () => loadPackage(dirs.get('needy-module')!, { resolvePackage }),
      (e: unknown) => {
        assert.ok(e instanceof CompositionError);
        assert.equal(e.rule, 'requires-satisfied');
        assert.match(e.message, /no-such-capability/);
        assert.match(e.message, /"needy-module"/);
        return true;
      },
    );
  });

  it('extends is treated as a single-entry uses, with a deprecation warning', () => {
    makeHappyComposition();
    makePackage(
      'legacy-rec',
      'package { id legacy-rec kind rec extends toy-core }',
      {},
    );
    const { standard, issues, composition } = loadPackageWithIssues(
      dirs.get('legacy-rec')!,
      { resolvePackage },
    );
    // extends imported the core package (composition happened).
    assert.deepEqual(composition?.order, ['toy-core', 'legacy-rec']);
    assert.ok(standard.dataclasses.some(c => c.id === 'BaseThing#data'));
    const deprecated = issues.filter(i => i.code === 'extends-deprecated');
    assert.equal(deprecated.length, 1);
    assert.equal(deprecated[0].severity, 'warning');
    assert.match(deprecated[0].message, /extends toy-core/);
  });

  it('provides: unconsumed warns; consumed or waived stays silent', () => {
    makePackage('prov-core', 'package { id prov-core kind core }', {});
    makePackage(
      'prov-module',
      'package { id prov-module uses { prov-core } provides { thing-x thing-y thing-z } }',
      {},
    );
    // thing-x consumed (requires), thing-y waived (qualified), thing-z free.
    makePackage(
      'prov-rec',
      'package { id prov-rec uses { prov-core prov-module } requires { thing-x } waives { prov-module:thing-y } }',
      {},
    );
    const { issues } = loadPackageWithIssues(dirs.get('prov-rec')!, {
      resolvePackage,
    });
    const unconsumed = issues.filter(i => i.code === 'provides-unconsumed');
    assert.equal(unconsumed.length, 1);
    assert.equal(unconsumed[0].severity, 'warning');
    assert.match(unconsumed[0].message, /"thing-z"/);
    assert.match(unconsumed[0].message, /"prov-module"/);

    // A bare (unqualified) waiver also matches.
    makePackage(
      'prov-rec2',
      'package { id prov-rec2 uses { prov-core prov-module } requires { thing-x } waives { thing-y thing-z } }',
      {},
    );
    const res2 = loadPackageWithIssues(dirs.get('prov-rec2')!, {
      resolvePackage,
    });
    assert.deepEqual(
      res2.issues.filter(i => i.code === 'provides-unconsumed'),
      [],
    );
  });

  it('without a locator the single directory loads as before (backwards compatible)', () => {
    const recDir = makeHappyComposition();
    const { standard, composition } = loadPackageWithIssues(recDir);
    assert.equal(composition, undefined);
    assert.ok(standard.forms.some(f => f.id === 'F1'));
    // The module's attribute is NOT merged without composition.
    assert.ok(!standard.attributeDefinitions.some(a => a.id === 'm_attr'));
  });
});

describe('uses composition — linter rules C27–C31', () => {
  it('a clean composition stays silent on C27–C31', () => {
    const recDir = makeHappyComposition();
    const issues = checkPackage(recDir, { resolvePackage });
    assert.deepEqual(
      issues.filter(i => /^C(2[7-9]|3[01])$/.test(i.check)),
      [],
    );
  });

  it('C28 reports a redefinition as an issue (not a throw)', () => {
    makeHappyComposition();
    addFile(
      dirs.get('toy-rec')!,
      'entities/redef.prl',
      'class BaseThing#data { store { redefined } }',
    );
    const issues = checkPackage(dirs.get('toy-rec')!, { resolvePackage });
    const c28 = issues.filter(i => i.check === 'C28');
    assert.equal(c28.length, 1);
    assert.equal(c28[0].severity, 'error');
    assert.match(c28[0].message, /uses-no-redefine/);
  });

  it('C29 reports a cycle; C27 reports an unresolvable uses and the extends deprecation', () => {
    makePackage('cyc2-a', 'package { id cyc2-a uses { cyc2-b } }', {});
    makePackage('cyc2-b', 'package { id cyc2-b uses { cyc2-a } }', {});
    const c29 = checkPackage(dirs.get('cyc2-a')!, { resolvePackage }).filter(
      i => i.check === 'C29',
    );
    assert.equal(c29.length, 1);
    assert.equal(c29[0].severity, 'error');
    assert.match(c29[0].message, /cyc2-a → cyc2-b → cyc2-a/);

    makePackage('ghost-rec2', 'package { id ghost-rec2 uses { ghost } }', {});
    const c27 = checkPackage(dirs.get('ghost-rec2')!, {
      resolvePackage,
    }).filter(i => i.check === 'C27');
    assert.equal(c27.length, 1);
    assert.equal(c27[0].severity, 'error');
    assert.match(c27[0].message, /uses-resolves/);

    makeHappyComposition();
    makePackage(
      'legacy-rec2',
      'package { id legacy-rec2 extends toy-core }',
      {},
    );
    const c27w = checkPackage(dirs.get('legacy-rec2')!, {
      resolvePackage,
    }).filter(i => i.check === 'C27');
    assert.equal(c27w.length, 1);
    assert.equal(c27w[0].severity, 'warning');
    assert.match(c27w[0].message, /deprecated/);
  });

  it('C31 reports an unsatisfied requires; C30 reports unconsumed provides but not waived ones', () => {
    makePackage('lp-core', 'package { id lp-core kind core }', {});
    makePackage(
      'lp-module',
      'package { id lp-module uses { lp-core } requires { missing-cap } provides { offered } }',
      {},
    );
    makePackage(
      'lp-rec',
      'package { id lp-rec uses { lp-core lp-module } }',
      {},
    );
    const c31 = checkPackage(dirs.get('lp-rec')!, { resolvePackage }).filter(
      i => i.check === 'C31',
    );
    assert.equal(c31.length, 1);
    assert.match(c31[0].message, /missing-cap/);

    makePackage(
      'lp-module2',
      'package { id lp-module2 uses { lp-core } provides { offered } }',
      {},
    );
    makePackage(
      'lp-rec2',
      'package { id lp-rec2 uses { lp-core lp-module2 } }',
      {},
    );
    const c30 = checkPackage(dirs.get('lp-rec2')!, { resolvePackage }).filter(
      i => i.check === 'C30',
    );
    assert.equal(c30.length, 1);
    assert.equal(c30[0].severity, 'warning');
    assert.match(c30[0].message, /"offered"/);

    makePackage(
      'lp-rec3',
      'package { id lp-rec3 uses { lp-core lp-module2 } waives { lp-module2:offered } }',
      {},
    );
    const c30w = checkPackage(dirs.get('lp-rec3')!, { resolvePackage }).filter(
      i => i.check === 'C30',
    );
    assert.deepEqual(c30w, []);
  });

  it('without a locator the composition rules stay silent on a resolvable manifest', () => {
    // Full composition cannot run (no locator), and the manifest-only
    // stopgap lint finds every uses id + requires token resolvable via
    // the sibling fixture packages — so no C27–C31 issue fires.
    const recDir = makeHappyComposition();
    const issues = checkPackage(recDir);
    assert.deepEqual(
      issues.filter(i => /^C(2[7-9]|3[01])$/.test(i.check)),
      [],
    );
  });
});

describe('manifest-only resolution stopgap (no composition)', () => {
  /** Isolated sibling layout: one parent dir, one child dir per package. */
  function makeSiblingPackages(specs: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'primmel-manifest-lint-'));
    for (const [id, manifest] of Object.entries(specs)) {
      const dir = join(root, id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'package.primmel'), manifest);
    }
    return root;
  }

  it('a dangling uses id is a C27 error naming it, marked manifest-only', () => {
    const root = makeSiblingPackages({
      'pkg-a': 'package { id pkg-a kind rec uses { pkg-ghost } }',
    });
    const issues = checkManifestResolution(join(root, 'pkg-a'));
    const c27 = issues.filter(i => i.check === 'C27');
    assert.equal(c27.length, 1);
    assert.equal(c27[0].severity, 'error');
    assert.match(c27[0].message, /pkg-ghost/);
    assert.match(c27[0].message, /manifest-only/);
    assert.match(c27[0].message, /uses-resolves/);
  });

  it('an id mismatch between the uses entry and the sibling manifest is not resolution', () => {
    // The sibling dir exists but declares a DIFFERENT id — the uses id
    // still resolves nowhere.
    const root = makeSiblingPackages({
      'pkg-a': 'package { id pkg-a kind rec uses { pkg-b } }',
      other: 'package { id other kind core }',
    });
    const c27 = checkManifestResolution(join(root, 'pkg-a')).filter(
      i => i.check === 'C27',
    );
    assert.equal(c27.length, 1);
    assert.match(c27[0].message, /pkg-b/);
  });

  it('a requires token no used package provides is a C31 error', () => {
    const root = makeSiblingPackages({
      'pkg-a':
        'package { id pkg-a kind rec uses { pkg-b } requires { no-such-cap } }',
      'pkg-b': 'package { id pkg-b kind core provides { cap-x } }',
    });
    const issues = checkManifestResolution(join(root, 'pkg-a'));
    const c31 = issues.filter(i => i.check === 'C31');
    assert.equal(c31.length, 1);
    assert.match(c31[0].message, /no-such-cap/);
    assert.match(c31[0].message, /requires-satisfied/);
  });

  it('a uses cycle is a C29 error naming the cycle', () => {
    const root = makeSiblingPackages({
      'pkg-x': 'package { id pkg-x uses { pkg-y } }',
      'pkg-y': 'package { id pkg-y uses { pkg-x } }',
    });
    const c29 = checkManifestResolution(join(root, 'pkg-x')).filter(
      i => i.check === 'C29',
    );
    assert.equal(c29.length, 1);
    assert.match(c29[0].message, /pkg-x → pkg-y → pkg-x/);
  });

  it('resolvable uses + requires (package ids and provides tokens) stay silent', () => {
    const root = makeSiblingPackages({
      'pkg-a':
        'package { id pkg-a kind rec uses { pkg-b pkg-c } requires { pkg-c cap-x } }',
      'pkg-b': 'package { id pkg-b kind module uses { pkg-c } }',
      'pkg-c': 'package { id pkg-c kind core provides { cap-x } }',
    });
    assert.deepEqual(checkManifestResolution(join(root, 'pkg-a')), []);
  });

  it('checkPackage without a locator surfaces the lint for package dirs', () => {
    const root = makeSiblingPackages({
      'pkg-a': 'package { id pkg-a kind rec uses { pkg-ghost } }',
    });
    const issues = checkPackage(join(root, 'pkg-a'));
    const c27 = issues.filter(i => i.check === 'C27');
    assert.equal(c27.length, 1);
    assert.equal(c27[0].severity, 'error');
    assert.match(c27[0].message, /pkg-ghost/);
    assert.match(c27[0].message, /manifest-only/);
  });

  it('a package with no declared imports runs no manifest lint', () => {
    const root = makeSiblingPackages({
      'pkg-solo': 'package { id pkg-solo }',
    });
    assert.deepEqual(checkPackage(join(root, 'pkg-solo')), []);
  });
});
