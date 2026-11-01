// ─────────────────────────────────────────────────────────────────────
// The one debt ledger (CRITIQUE-2 #5): the gates' declared exclusions
// travel with the package — fidelity_entry (the source-extract tokens)
// and method_ref_entry (the unlinked citations) parse with the same
// validation discipline as allowlist_entry (C56 judges malformed
// entries; a non-empty key, reason, and audit_ref).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAllowlist } from '../src/check-allowlist';

function ledger(text: string): ReturnType<typeof loadAllowlist> {
  const dir = mkdtempSync(join(tmpdir(), 'prl-ledger-'));
  writeFileSync(join(dir, '.primmel-allowlist.prl'), text);
  return loadAllowlist(dir);
}

describe('the gate entries in the one ledger', () => {
  it('fidelity_entry parses with its key, reason, and audit_ref', () => {
    const { allowlist, issues } = ledger(`fidelity_entry {
  token "80 %"
  reason "the extract ships no fragment text yet: the source document is being obtained."
  audit_ref "TODO.external-refs/06"
}
`);
    assert.deepEqual(issues, []);
    assert.equal(allowlist.fidelityEntries.length, 1);
    assert.equal(allowlist.fidelityEntries[0].token, '80 %');
    assert.match(allowlist.fidelityEntries[0].reason, /source document/);
    assert.equal(
      allowlist.fidelityEntries[0].auditRef,
      'TODO.external-refs/06',
    );
  });

  it('method_ref_entry parses; a malformed entry is C56', () => {
    const ok = ledger(`method_ref_entry {
  citation "IEC 61000-4-6:2013, Table 1"
  reason "the citation names the register's own severity row, linked there."
  audit_ref "TODO.external-refs/09"
}
`);
    assert.deepEqual(ok.issues, []);
    assert.equal(ok.allowlist.methodRefEntries.length, 1);
    assert.equal(
      ok.allowlist.methodRefEntries[0].citation,
      'IEC 61000-4-6:2013, Table 1',
    );

    const bad = ledger(`method_ref_entry {
  citation "IEC 61000-4-6:2013, Table 1"
}
`);
    assert.equal(bad.allowlist.methodRefEntries.length, 0);
    assert.ok(
      bad.issues.some(i => i.message.includes('has no reason')),
      'the missing reason is named',
    );
    assert.ok(
      bad.issues.some(i => i.message.includes('has no audit_ref')),
      'the missing audit_ref is named',
    );
    assert.ok(bad.issues.every(i => i.check === 'C56'));
  });

  it('an entry missing its key is C56; the directive list grew', () => {
    const noKey = ledger(`fidelity_entry {
  reason "orphan reason"
  audit_ref "TODO.x"
}
`);
    assert.equal(noKey.allowlist.fidelityEntries.length, 0);
    assert.ok(noKey.issues.some(i => i.message.includes('carries no token')));

    const unknown = ledger(`mystery_entry {
  token "x"
}
`);
    assert.match(
      unknown.issues[0].message,
      /allowlist_entry \| fidelity_entry \| method_ref_entry/,
    );
  });
});
