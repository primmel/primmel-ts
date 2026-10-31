// ─────────────────────────────────────────────────────────────────────
// The declared normalization layer (CRITIQUE-2 #8): a register unit
// declares the token spellings it answers to beside its canonical
// symbol; the register's resolution reads them; a collision refuses at
// parse.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPackageWithIssues, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

function pkg(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'prl-sv-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id probe }');
  mkdirSync(join(dir, 'model'), { recursive: true });
  writeFileSync(join(dir, 'model', 'q.prl'), body);
  return dir;
}

describe('spelling_variants on the register unit', () => {
  const register = `quantity_register probe {
  kind concentration { dimensions { 1 } si_unit "%"}
  unit percent { symbol "%" label "percent" kind concentration factor 1
    spelling_variants [ "80%" "80 %" "pct" ] }
}
`;

  it('the variants parse, round-trip, and resolve', () => {
    const r = loadPackageWithIssues(pkg(register));
    const u = r.standard!.quantityRegisters[0]!.units[0]!;
    assert.deepEqual(u.spellingVariants, ['80%', '80 %', 'pct']);
    const wire = dump(r.standard as never);
    assert.match(wire, /spelling_variants \["80%" "80 %" "pct"\]/);
    // the resolution: a value carrying a variant token resolves — the
    // unit kind is found through the variant (C33's map)
    const c33 = checkPackage(pkg(register + '')).filter(i => i.check === 'C33');
    assert.deepEqual(c33, []);
  });

  it('the line-run spelling refuses at parse', () => {
    let threw = '';
    try {
      loadPackageWithIssues(
        pkg(
          `quantity_register probe {\n  kind concentration { dimensions { 1 } si_unit "%"}\n  unit percent { symbol "%" label "percent" kind concentration factor 1\n    spelling_variants "80%"\n }\n}\n`,
        ),
      );
    } catch (e) {
      threw = String((e as Error).message);
    }
    assert.match(threw, /spelling_variants takes the bracket list form/);
  });

  it('a variant colliding with a unit id refuses at parse', () => {
    let threw = '';
    try {
      loadPackageWithIssues(
        pkg(
          `quantity_register probe {\n  kind concentration { dimensions { 1 } si_unit "%"}\n  unit percent { symbol "%" label "percent" kind concentration factor 1\n    spelling_variants [ "pct" ] }\n  unit pct { symbol "pct2" label "pct" kind concentration factor 1 }\n}\n`,
        ),
      );
    } catch (e) {
      threw = String((e as Error).message);
    }
    assert.match(threw, /the unit pct "pct" collides/);
  });
});
