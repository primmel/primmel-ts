// The exports-map proof (TODO.ops/01): every subpath a consumer may
// reach resolves from the BUILT package by name — no consumer ever
// reaches into src/ again. Runs against the workspace self-reference
// (node_modules/@primmel/primmel), i.e. the same resolution a real
// consumer gets.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const SUBPATHS: [string, string[]][] = [
  ['@primmel/primmel/check', ['checkPackage']],
  ['@primmel/primmel/check-rules', ['CHECK_RULES']],
  ['@primmel/primmel/instance-resolution', []],
  ['@primmel/primmel/mapping-coverage', []],
  ['@primmel/primmel/model-diff', ['formatDiffReport']],
  ['@primmel/primmel/operational-state', []],
  ['@primmel/primmel/text-coverage', ['packageTextCoverageReport']],
  ['@primmel/primmel/ser-des', ['load', 'dump', 'dumpPackage']],
  ['@primmel/primmel/ser-des/package', ['loadPackage', 'loadPackageWithIssues', 'packageFiles']],
  ['@primmel/primmel/ser-des/config/twin', []],
];

for (const [spec, expected] of SUBPATHS) {
  test(`${spec} resolves with its surface`, async () => {
    const mod = (await import(spec)) as Record<string, unknown>;
    assert.ok(mod, `${spec} imported`);
    for (const name of expected) {
      assert.ok(name in mod, `${spec} is missing ${name}`);
    }
  });
}

test('the whole-module imports carry real content', async () => {
  const rules = (await import('@primmel/primmel/check-rules')) as { CHECK_RULES: unknown[] };
  assert.ok(Array.isArray(rules.CHECK_RULES) && rules.CHECK_RULES.length > 0, 'CHECK_RULES non-empty');
  const cov = (await import('@primmel/primmel/mapping-coverage')) as Record<string, unknown>;
  assert.ok(Object.keys(cov).length > 0, 'mapping-coverage non-empty');
  const twin = (await import('@primmel/primmel/ser-des/config/twin')) as Record<string, unknown>;
  assert.ok(Object.keys(twin).length > 0, 'config/twin non-empty');
  const inst = (await import('@primmel/primmel/instance-resolution')) as Record<string, unknown>;
  assert.ok(Object.keys(inst).length > 0, 'instance-resolution non-empty');
  const ops = (await import('@primmel/primmel/operational-state')) as Record<string, unknown>;
  assert.ok(Object.keys(ops).length > 0, 'operational-state non-empty');
});
