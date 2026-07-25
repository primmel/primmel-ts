// ─────────────────────────────────────────────────────────────────────
// TODO.roadmap/17 — the rule catalog (check-rules.ts): integrity of the
// machine-readable registry the CLI prints (`primmel check --rules`).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CHECK_RULES, activeRuleIds, checkRule } from '../src/check-rules';
import { checkPackage } from '../src/check';

const pkgRoot = join(__dirname, '..');

// The real R 60 package lives in the sibling smart repo checkout, which
// CI and fresh clones do not have — the R 60-dependent spec then SKIPs
// gracefully. Set R60_PACKAGE to a built primmel-packages/oiml-r60
// directory to enable it; an env value pointing nowhere skips the same way.
const R60 =
  process.env.R60_PACKAGE ??
  '/Users/mulgogi/src/oimlsmart/smart/primmel-packages/oiml-r60';
const R60_AVAILABLE = existsSync(R60);
const R60_SKIP: string | false = R60_AVAILABLE
  ? false
  : `no oiml-r60 package at ${R60} — set R60_PACKAGE to a built primmel-packages/oiml-r60 directory`;
if (!R60_AVAILABLE) {
  console.log(
    `check-rules.test.ts: skipping the R 60 package spec — ${R60_SKIP}`,
  );
}

const FAMILIES = [
  'base',
  'anatomy',
  'process',
  'instantiation',
  'mapping',
  'composition',
  'quantities',
  'state',
  'promises',
  'artifacts',
  'characteristics',
  'twins',
  'coverage',
  'edition',
  'supply-chain',
];

describe('check rule catalog (TODO.roadmap/17)', () => {
  it('ids are unique and sequential (C1…C84)', () => {
    const ids = CHECK_RULES.map(r => r.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate rule ids');
    const expected = Array.from({ length: 84 }, (_, i) => `C${i + 1}`);
    assert.deepEqual(
      [...ids].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))),
      expected,
      'the catalog is exactly C1…C84 (TODO.roadmap/38 adds C74–C76, TODO.roadmap/28 adds C77–C80, TODO.roadmap/36 adds C81–C83, TODO.roadmap/51 adds C84)',
    );
  });

  it('every rule has a valid family, severity, level, and a docs pointer', () => {
    for (const r of CHECK_RULES) {
      assert.ok(FAMILIES.includes(r.family), `${r.id}: family ${r.family}`);
      assert.ok(['error', 'warning'].includes(r.severity), r.id);
      assert.ok(['normal', 'audit'].includes(r.level), r.id);
      assert.ok(r.name.length > 0, `${r.id}: name`);
      assert.ok(r.docs.length > 0, `${r.id}: docs pointer`);
    }
  });

  it('every family is represented', () => {
    const present = new Set(CHECK_RULES.map(r => r.family));
    for (const f of FAMILIES) {
      assert.ok(present.has(f as never), `family ${f} has no rules`);
    }
  });

  it('checkRule() resolves ids; activeRuleIds(audit) ⊇ activeRuleIds(normal)', () => {
    assert.equal(checkRule('C51')?.name, 'coverage-test-evidence');
    assert.equal(checkRule('C51')?.level, 'audit');
    assert.equal(checkRule('C25')?.level, 'audit');
    assert.equal(checkRule('C5')?.level, 'normal');
    assert.equal(checkRule('C99'), undefined);
    const normal = activeRuleIds('normal');
    const audit = activeRuleIds('audit');
    for (const id of normal) {
      assert.ok(audit.has(id), `${id} active at normal but not audit`);
    }
    assert.ok(audit.size > normal.size, 'audit activates more rules');
    assert.deepEqual(
      [...audit].filter(id => !normal.has(id)).sort(),
      ['C25', 'C51', 'C52', 'C55', 'C71', 'C72'],
      'the audit-only rules (C71/C72 join with TODO.roadmap/26)',
    );
  });

  it('primmel check --rules prints the full catalog', () => {
    const out = execFileSync(
      'npx',
      ['tsx', join(pkgRoot, 'scripts', 'check.mts'), '--rules'],
      { encoding: 'utf8' },
    );
    for (const r of CHECK_RULES) {
      assert.ok(
        out.includes(`${r.id} `) && out.includes(r.name),
        `--rules output missing ${r.id} ${r.name}`,
      );
    }
    assert.ok(out.includes(`${CHECK_RULES.length} rules`), 'rule count line');
  });

  it(
    'every issue id checkPackage emits on the R 60 package is catalogued',
    { skip: R60_SKIP },
    () => {
      for (const strictness of ['normal', 'audit'] as const) {
        for (const i of checkPackage(R60, { strictness })) {
          assert.ok(
            checkRule(i.check),
            `issue id ${i.check} (${strictness}) is not in the catalog`,
          );
        }
      }
    },
  );
});
