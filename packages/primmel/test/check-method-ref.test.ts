// ─────────────────────────────────────────────────────────────────────
// C168 method-ref-resolves (check.ts): a conformance test's method_ref
// names THE PROCESS the test realizes — bare in-package, or scoped
// <package>:<id> resolved read-only through the locator. A
// bibliographic standard id is not a resolution target.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkPackage, type CheckOptions } from '../src/check';

function makeTmpPackage(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-mref-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

const TESTS = (mref: string): string => `conformance_test t1 {
  name "Under test"
  method_ref ${mref}
}
`;

const c168 = (
  files: Record<string, string>,
  options: CheckOptions = {},
): string[] =>
  (() => {
    const dir = makeTmpPackage(files);
    try {
      return checkPackage(dir, options)
        .filter(i => i.check === 'C168')
        .map(i => i.message);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  })();

const withDep = (fn: (depDir: string) => void): void => {
  const depDir = makeTmpPackage({
    'model/processes.prl': 'process dep-proc { name "Dep proc" }\n',
  });
  try {
    fn(depDir);
  } finally {
    rmSync(depDir, { recursive: true, force: true });
  }
};

describe('C168 method-ref-resolves', () => {
  it('accepts a bare id declared in the same package', () => {
    const msgs = c168({
      'model/processes.prl': 'process target_proc { name "Target" }\n',
      'specification/tests.prl': TESTS('target_proc'),
    });
    assert.deepEqual(msgs, []);
  });

  it('rejects a bare id naming nothing in the package', () => {
    const msgs = c168({ 'specification/tests.prl': TESTS('no_such_proc') });
    assert.equal(msgs.length, 1);
    assert.match(msgs[0], /t1/);
    assert.match(msgs[0], /method-ref-resolves/);
  });

  it('resolves a scoped reference through the locator', () => {
    withDep(depDir => {
      const msgs = c168(
        { 'specification/tests.prl': TESTS('dep:dep-proc') },
        { resolvePackage: id => (id === 'dep' ? depDir : undefined) },
      );
      assert.deepEqual(msgs, []);
    });
  });

  it('rejects a scoped reference the target does not declare', () => {
    withDep(depDir => {
      const msgs = c168(
        { 'specification/tests.prl': TESTS('dep:no_such') },
        { resolvePackage: id => (id === 'dep' ? depDir : undefined) },
      );
      assert.equal(msgs.length, 1);
      assert.match(msgs[0], /package "dep"/);
    });
  });

  it('is locator-gated: the scoped leg stays silent without a locator', () => {
    const msgs = c168({ 'specification/tests.prl': TESTS('dep:no_such') });
    assert.deepEqual(msgs, []);
  });
});
