// ─────────────────────────────────────────────────────────────────────
// Composition scenarios (the deeper audit's surface D): the merge
// planes no test exercised end to end —
//   1. the quantity register's overlay deep merge (and its unmarked
//      throw), the OVERLAY_DEEP_MERGE_FIELDS row a same-id
//      redeclaration reaches only when the marker parses;
//   2. the boolean-fold re-derivation over a composed closure: folds
//      are parse-side views, never merged as data, and the OWNER
//      collision is the guard;
//   3. the overlay allowlist's fail-closed boundary: a marked
//      attribute_definition replaces whole-value, a marked symbol
//      stays uses-no-redefine (the marker is a no-op off-list).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPackage } from '../src/ser-des/index';

function makePackage(
  root: string,
  id: string,
  body: string,
  uses: string[] = [],
): string {
  const dir = join(root, id);
  mkdirSync(join(dir, 'specification'), { recursive: true });
  writeFileSync(
    join(dir, 'package.primmel'),
    `package { id ${id}${uses.length ? ` uses { ${uses.join(' ')} }` : ''} }`,
  );
  writeFileSync(join(dir, 'specification', 'c.prl'), body);
  return dir;
}

const resolveFrom = (root: string) => (id: string) => join(root, id);

async function rejection(fn: () => unknown): Promise<string> {
  try {
    await fn();
  } catch (e) {
    return String((e as Error)?.message ?? e);
  }
  return 'no rejection';
}

describe('composition scenario — the quantity register', () => {
  const core = `quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg }
  unit kg { symbol "kg" label "kilogram" kind mass factor 1 }
}`;

  it('an overlay-marked same-id redeclaration deep-merges', async () => {
    const root = mkdtempSync(join(tmpdir(), 'prl-comp-qr-'));
    makePackage(root, 'core', core);
    const rec = makePackage(
      root,
      'rec',
      `quantity_register si {
  overlay true
  kind temperature { dimensions { Θ 1 } si_unit K }
  unit kg { symbol "kg" label "kilogramme" kind mass factor 1 }
  unit K { symbol "K" label "kelvin" kind temperature factor 1 }
}`,
      ['core'],
    );
    const std = (await loadPackage(rec, {
      resolvePackage: resolveFrom(root),
    })) as unknown as {
      quantityRegisters: {
        id: string;
        kinds: { id: string }[];
        units: { id: string; label: string }[];
        overlay?: boolean;
      }[];
    };
    const reg = std.quantityRegisters.find(r => r.id === 'si');
    assert.ok(reg, 'the merged register exists');
    assert.deepEqual(
      reg!.kinds.map(k => k.id),
      ['mass', 'temperature'],
      'entries union by id in first-seen order',
    );
    assert.deepEqual(
      reg!.units.map(u => u.id),
      ['kg', 'K'],
      'the rec unit lands beside the core units, first-seen order',
    );
    assert.equal(
      reg!.units.find(u => u.id === 'kg')!.label,
      'kilogramme',
      'a differing entry with the same id overrides field-wise',
    );
    assert.equal(reg!.overlay, undefined, 'the marker is consumed, never data');
  });

  it('an unmarked same-id redeclaration stays uses-no-redefine', async () => {
    const root = mkdtempSync(join(tmpdir(), 'prl-comp-qr2-'));
    makePackage(root, 'core', core);
    const rec = makePackage(
      root,
      'rec',
      `quantity_register si {
  unit g { symbol "g" label "gram" kind mass factor 0.001 }
}`,
      ['core'],
    );
    assert.match(
      await rejection(() =>
        loadPackage(rec, { resolvePackage: resolveFrom(root) }),
      ),
      /uses-no-redefine/,
    );
  });
});

describe('composition scenario — the fold re-derivation', () => {
  it('folds re-derive from the merged owners, one view per owner', async () => {
    const root = mkdtempSync(join(tmpdir(), 'prl-comp-fold-'));
    makePackage(
      root,
      'core',
      'requirement /req/core-a {\n name "A"\n statement { S }\n limit {\n  expression {\n   1 <= 2\n  }\n }\n}\n',
    );
    const rec = makePackage(
      root,
      'rec',
      'requirement /req/rec-b {\n name "B"\n statement { S }\n limit {\n  expression {\n   2 <= 3\n  }\n }\n}\n',
      ['core'],
    );
    const std = (await loadPackage(rec, {
      resolvePackage: resolveFrom(root),
    })) as unknown as {
      checks: { id: string; folds?: unknown }[];
    };
    const ids = std.checks.map(c => c.id);
    assert.ok(
      ids.includes('requirement:/req/core-a:limit:1'),
      'the upstream owner folds in the composed closure',
    );
    assert.ok(
      ids.includes('requirement:/req/rec-b:limit:1'),
      'the local owner folds beside it',
    );
    assert.equal(
      ids.filter(i => i === 'requirement:/req/core-a:limit:1').length,
      1,
      'the derived view appears exactly once',
    );
    assert.ok(
      std.checks.every(c => c.folds !== undefined),
      'every check in the closure is a fold view (no authored checks here)',
    );
  });

  it('the OWNER collision is the guard — two packages never collide on a derived id', async () => {
    const root = mkdtempSync(join(tmpdir(), 'prl-comp-fold2-'));
    makePackage(
      root,
      'core',
      'requirement /req/core-a {\n name "A"\n statement { S }\n limit {\n  expression {\n   1 <= 2\n  }\n }\n}\n',
    );
    const rec = makePackage(
      root,
      'rec',
      'requirement /req/core-a {\n name "A again"\n statement { S }\n limit {\n  expression {\n   2 <= 3\n  }\n }\n}\n',
      ['core'],
    );
    assert.match(
      await rejection(() =>
        loadPackage(rec, { resolvePackage: resolveFrom(root) }),
      ),
      /uses-no-redefine/,
      'an unmarked owner redeclaration refuses before any fold id could collide',
    );
  });
});

describe('composition scenario — the overlay allowlist boundary', () => {
  it('a marked attribute_definition replaces whole-value', async () => {
    const root = mkdtempSync(join(tmpdir(), 'prl-comp-ovl-ad-'));
    makePackage(
      root,
      'core',
      'attribute_definition m_attr {\n symbol "M"\n origin design-fixed\n scope model\n}\n',
    );
    const rec = makePackage(
      root,
      'rec',
      'attribute_definition m_attr {\n overlay true\n symbol "M"\n origin declared\n scope model\n}\n',
      ['core'],
    );
    const std = (await loadPackage(rec, {
      resolvePackage: resolveFrom(root),
    })) as unknown as {
      attributeDefinitions: { id: string; origin: string }[];
    };
    const attr = std.attributeDefinitions.find(a => a.id === 'm_attr');
    assert.equal(attr?.origin, 'declared', 'the marked redeclaration wins');
  });

  it('a marked symbol stays uses-no-redefine — the marker is a no-op off-list', async () => {
    const root = mkdtempSync(join(tmpdir(), 'prl-comp-ovl-sym-'));
    makePackage(root, 'core', 'symbol s { label "s" }\n');
    const rec = makePackage(
      root,
      'rec',
      'symbol s {\n overlay true\n label "s again"\n}\n',
      ['core'],
    );
    assert.match(
      await rejection(() =>
        loadPackage(rec, { resolvePackage: resolveFrom(root) }),
      ),
      /uses-no-redefine/,
    );
  });
});
