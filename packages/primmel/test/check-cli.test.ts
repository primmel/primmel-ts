// ─────────────────────────────────────────────────────────────────────
// primmel check CLI diagnostics (scripts/check.mts): an unreadable or
// missing --with locator target (or package dir) is a clean usage-class
// diagnostic with exit 2 — never an uncaught stack trace.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = join(__dirname, '..', 'scripts', 'check.mts');

function run(args: string[]): { status: number | null; stderr: string } {
  // npm_config_loglevel=silent: the spawned npx must not leak its own
  // warnings (runner npmrc quirks like `always-auth`) into stderr — the
  // assertions count the CLI's diagnostic lines, never npm's noise.
  const res = spawnSync('npx', ['tsx', CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, npm_config_loglevel: 'silent' },
  });
  return { status: res.status, stderr: res.stderr };
}

describe('primmel check CLI diagnostics', () => {
  it('a missing --with locator target: clean diagnostic, exit 2, no stack trace', () => {
    const dir = mkdtempSync(join(tmpdir(), 'primmel-cli-'));
    writeFileSync(
      join(dir, 'package.primmel'),
      'package { id test uses { oiml-cs } }',
    );
    const { status, stderr } = run([
      '--with',
      'oiml-cs=/nonexistent/oiml-cs',
      dir,
    ]);
    assert.equal(status, 2, `exit 2 (got ${status}): ${stderr}`);
    assert.ok(
      stderr.includes('cannot read package at /nonexistent/oiml-cs:'),
      `clean diagnostic, got: ${stderr}`,
    );
    assert.equal(
      stderr.trim().split('\n').length,
      1,
      `a single diagnostic line — no stack trace: ${stderr}`,
    );
  });

  it('a --with target without package.primmel: clean diagnostic, exit 2', () => {
    const dir = mkdtempSync(join(tmpdir(), 'primmel-cli-'));
    writeFileSync(
      join(dir, 'package.primmel'),
      'package { id test uses { oiml-cs } }',
    );
    const empty = mkdtempSync(join(tmpdir(), 'primmel-cli-empty-'));
    const { status, stderr } = run(['--with', `oiml-cs=${empty}`, dir]);
    assert.equal(status, 2, `exit 2 (got ${status}): ${stderr}`);
    assert.ok(
      stderr.includes(
        `cannot read package at ${empty}: no package.primmel found`,
      ),
      `manifest diagnostic, got: ${stderr}`,
    );
  });

  it('a missing positional package dir: clean diagnostic, exit 2', () => {
    const { status, stderr } = run(['/nonexistent/pkg']);
    assert.equal(status, 2, `exit 2 (got ${status}): ${stderr}`);
    assert.ok(
      stderr.includes('cannot read package at /nonexistent/pkg:'),
      `clean diagnostic, got: ${stderr}`,
    );
  });
});
