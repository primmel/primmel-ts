// ─────────────────────────────────────────────────────────────────────
// TODO.roadmap/17 — the level semantics of `primmel check`:
//   default   — normal-level rules at catalog severities; audit-only
//               rules (C25, C51, C52, C55) stay silent;
//   --audit   — the audit-only rules join (C25 shown here; C51/C52 in
//               check-coverage.test.ts);
//   --strict  — warnings promote to errors (KNOWN allowlisted issues
//               and budget-covered C51/C52 warnings excepted — see
//               check-allowlist.test.ts).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkPackage, type CheckOptions } from '../src/check';

const PKG = {
  'model/m.prl': `process OpA { name "A" }
process StdS#Process5 { name "alias of StdS Process5" }
map_profile StdS {
  mapping {
    OpA -> StdS#Process5
  }
}`,
};

function checked(options: CheckOptions) {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-levels-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  for (const [rel, body] of Object.entries(PKG)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  try {
    return checkPackage(dir, options);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('level semantics (TODO.roadmap/17)', () => {
  it('default level: C25 (mapping-description) stays silent', () => {
    const c25 = checked({}).filter(i => i.check === 'C25');
    assert.deepEqual(c25, []);
  });

  it('--audit: C25 warns on a mapping without a description', () => {
    const c25 = checked({ strictness: 'audit' }).filter(i => i.check === 'C25');
    assert.equal(c25.length, 1);
    assert.equal(c25[0].severity, 'warning');
    assert.ok(c25[0].message.includes('no description'));
  });

  it('--strict alone does not enable audit-only rules', () => {
    const c25 = checked({ strict: true }).filter(i => i.check === 'C25');
    assert.deepEqual(c25, []);
  });

  it('--strict --audit promotes the C25 warning to an error', () => {
    const c25 = checked({ strictness: 'audit', strict: true }).filter(
      i => i.check === 'C25',
    );
    assert.equal(c25.length, 1);
    assert.equal(c25[0].severity, 'error');
  });
});
