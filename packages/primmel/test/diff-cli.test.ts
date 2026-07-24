// ─────────────────────────────────────────────────────────────────────
// primmel diff CLI tests (TODO.roadmap/28): usage diagnostics (exit 2,
// no stack trace), the text/JSON reports, and --exit-code — the
// change-audit gate form (working tree vs baseline wired into review
// flows).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = join(__dirname, '..', 'scripts', 'check.mts');

function run(args: string[]): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const res = spawnSync('npx', ['tsx', CLI, ...args], { encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

function pkg(version: string, clause: string): string {
  const parent = mkdtempSync(join(tmpdir(), 'primmel-diffcli-'));
  const dir = join(parent, 'pkg');
  mkdirSync(dir);
  writeFileSync(
    join(dir, 'package.primmel'),
    `package {
  id oiml-r60
  kind rec
  version "${version}"
  editions { 2021 2017 }
  baseUrn "urn:oiml:pub:r:60:${version}"
  description "d"
}`,
  );
  mkdirSync(join(dir, 'specification'));
  writeFileSync(
    join(dir, 'specification', 'calc.prl'),
    `calculation vMin {
  name "vMin"
  expression "ocl{(d_max - d_min) / (n_lc * f)}"
  source { doc "urn:oiml:pub:r:60-1:${version}" clause "${clause}" }
}`,
  );
  return dir;
}

describe('primmel diff CLI', () => {
  it('missing operands: usage, exit 2, no stack trace', () => {
    const { status, stderr } = run(['diff', '/tmp']);
    assert.equal(status, 2);
    assert.match(stderr, /Usage: primmel diff/);
    assert.equal(stderr.trim().split('\n').length <= 2, true);
  });

  it('an unreadable package dir: clean diagnostic, exit 2', () => {
    const { status, stderr } = run(['diff', '/nonexistent/a', '/nonexistent/b']);
    assert.equal(status, 2);
    assert.match(stderr, /cannot read package at \/nonexistent\/a:/);
    assert.equal(stderr.trim().split('\n').length, 1);
  });

  it('unknown flag: usage, exit 2', () => {
    const { status, stderr } = run(['diff', '--bogus', 'a', 'b']);
    assert.equal(status, 2);
    assert.match(stderr, /unknown flag: --bogus/);
  });

  it('the edition-comparison report prints the clause-drift table', () => {
    const a = pkg('2017', '3.7.5');
    const b = pkg('2021', '3.5.11');
    const { status, stdout } = run(['diff', a, b]);
    assert.equal(status, 0);
    assert.match(stdout, /edition comparison — oiml-r60@2017 → oiml-r60@2021/);
    assert.match(stdout, /urn:oiml:pub:r:60-1\s+3\.7\.5\s+3\.5\.11\s+renumbered/);
    assert.match(stdout, /vMin/);
  });

  it('--json emits a machine-readable report', () => {
    const a = pkg('2017', '3.7.5');
    const b = pkg('2021', '3.5.11');
    const { status, stdout } = run(['diff', '--json', a, b]);
    assert.equal(status, 0);
    const report = JSON.parse(stdout);
    assert.equal(report.editionComparison, true);
    assert.equal(report.clauseDrift.length, 1);
    assert.equal(report.clauseDrift[0].from, '3.7.5');
    assert.equal(report.clauseDrift[0].to, '3.5.11');
    assert.equal(report.clauseDrift[0].kind, 'renumbered');
  });

  it('--exit-code: 1 on a non-empty diff, 0 on a no-op (the review gate)', () => {
    const a = pkg('2017', '3.7.5');
    const b = pkg('2021', '3.5.11');
    const changed = run(['diff', '--exit-code', a, b]);
    assert.equal(changed.status, 1);
    const noop = run(['diff', '--exit-code', b, b]);
    assert.equal(noop.status, 0);
    assert.match(noop.stdout, /clause drift: none/);
  });
});
