import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPackage } from '../src/check';

// The provider pass: a consumer's check applies each provider's own
// KNOWN register to the diagnostics its elements contribute — the
// INHERITED-entry pattern (a consumer re-authoring its provider's
// dispositions) retires.
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'primmel-prov-'));
  const prov = join(root, 'prov-scheme');
  const cons = join(root, 'cons-rec');
  mkdirSync(prov);
  mkdirSync(cons);
  writeFileSync(
    join(prov, 'package.primmel'),
    'package {\n  id prov-scheme\n  kind core\n  provides { prov-flow }\n}\n',
  );
  writeFileSync(
    join(prov, 'evaluation.prl'),
    [
      // C142's target-resolution leg fires only when the package
      // declares at least one process — the gateway's OTHER edge
      // names a stage that is not one.
      'process intake_flow {',
      '  name "Intake"',
      '}',
      'exclusive_gateway branch_gateway {',
      '  label "The applicability branch"',
      '  edge intake_flow { condition "always" label "the declared path" }',
      '  edge run_marker_branch { condition default label "the routing marker" }',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(cons, 'package.primmel'),
    'package {\n  id cons-rec\n  kind rec\n  uses { prov-scheme }\n  requires { prov-flow }\n}\n',
  );
  return root;
}

function locator(root: string) {
  return (id: string): string | undefined =>
    id === 'prov-scheme' ? join(root, 'prov-scheme') : undefined;
}

describe('the provider allowlist pass', () => {
  it('a provider entry absorbs the diagnostic a consumer re-reports', () => {
    const root = fixture();
    // The provider's own KNOWN entry for its gateway's edge target.
    writeFileSync(
      join(root, 'prov-scheme', '.primmel-allowlist.prl'),
      [
        'allowlist_entry {',
        '  rule C142',
        '  match "exclusive_gateway branch_gateway: edge * targets \\"*\\", which is not a declared process (gateway-edges-resolve)"',
        '  reason "Routing marker, not a process id (the fixture\'s provider disposition)."',
        '  audit_ref "test"',
        '}',
      ].join('\n'),
    );
    const issues = checkPackage(join(root, 'cons-rec'), {
      resolvePackage: locator(root),
    });
    const c142 = issues.filter(i => i.check === 'C142');
    assert.equal(c142.length, 1);
    assert.equal(c142[0]!.known, true, 'absorbed by the provider entry');
    assert.equal(
      issues.filter(i => i.severity === 'error' && !i.known).length,
      0,
    );
  });

  it('a STALE provider entry fails the consumer check naming the provider', () => {
    const root = fixture();
    writeFileSync(
      join(root, 'prov-scheme', '.primmel-allowlist.prl'),
      [
        'allowlist_entry {',
        '  rule C142',
        '  match "*this diagnostic never fires*"',
        '  reason "stale by construction"',
        '  audit_ref "test"',
        '}',
      ].join('\n'),
    );
    const issues = checkPackage(join(root, 'cons-rec'), {
      resolvePackage: locator(root),
    });
    const stale = issues.filter(i => i.check === 'C57');
    assert.equal(stale.length, 1);
    assert.equal(stale[0]!.severity, 'warning');
    assert.equal(stale[0]!.known, true, 'never a gate, even under --strict');
    assert.match(stale[0]!.message, /provider "prov-scheme": entry/);
  });

  it('no locator, no provider pass — the entry never applies', () => {
    const root = fixture();
    writeFileSync(
      join(root, 'prov-scheme', '.primmel-allowlist.prl'),
      [
        'allowlist_entry {',
        '  rule C142',
        '  match "exclusive_gateway branch_gateway: edge * targets \\"*\\", which is not a declared process (gateway-edges-resolve)"',
        '  reason "routing marker"',
        '  audit_ref "test"',
        '}',
      ].join('\n'),
    );
    const issues = checkPackage(join(root, 'prov-scheme'));
    // The provider checked ALONE: its own allowlist applies (the root
    // pass) — the same entry, the same absorption. The provider pass
    // itself adds nothing here; this leg pins that the standalone
    // posture is unchanged.
    const c142 = issues.filter(i => i.check === 'C142');
    assert.equal(c142.length, 1);
    assert.equal(c142[0]!.known, true);
  });
});
