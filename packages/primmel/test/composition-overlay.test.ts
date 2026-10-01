// ─────────────────────────────────────────────────────────────────────
// The overlay escape's growth (composition): processes join the
// whole-value last-write-wins escape (the terms' precedent — a
// downstream process intentionally supersedes an upstream abstract),
// and dataclasses join the field-wise deep merge (a downstream class
// adds attributes beside the upstream's). An UNMARKED redefinition
// still errors — the escape is the author's explicit claim.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, loadPackage, dump } from '../src/ser-des/index';

function makePackage(
  root: string,
  id: string,
  body: string,
  uses: string[] = [],
): string {
  const dir = join(root, id);
  mkdirSync(join(dir, 'model'), { recursive: true });
  writeFileSync(
    join(dir, 'package.primmel'),
    `package { id ${id}${uses.length ? ` uses { ${uses.join(' ')} ` + '}' : ''} }`,
  );
  writeFileSync(join(dir, 'model', 'm.prl'), body);
  return dir;
}

describe('the overlay escape beyond terms', () => {
  it('a process overlay supersedes whole-value; unmarked still errors', async () => {
    const root = mkdtempSync(join(tmpdir(), 'prl-ovl-'));
    makePackage(
      root,
      'core',
      `process application {
  name "Application"
  summary "The abstract one."
  phase intake
}`,
    );
    const recDir = makePackage(
      root,
      'rec',
      `process application {
  overlay true
  name "Application"
  summary "The rec's concrete one."
  phase intake
}`,
      ['core'],
    );
    const std = (await loadPackage(recDir, {
      resolvePackage: (id: string) => join(root, id),
    })) as unknown as { processes: { id: string; summary: string }[] };
    const merged = std.processes.find(p => p.id === 'application');
    assert.equal(merged?.summary, "The rec's concrete one.");

    const unmarked = makePackage(
      root,
      'rec2',
      `process application {
  name "Application"
  summary "Another one."
}`,
      ['core'],
    );
    let rejected: unknown = null;
    try {
      await loadPackage(unmarked, { resolvePackage: id => join(root, id) });
    } catch (e) {
      rejected = e;
    }
    assert.match(
      String((rejected as Error)?.message ?? 'no rejection'),
      /uses-no-redefine/,
    );
  });

  it('the overlay facet round-trips (absent never canonicalizes)', () => {
    const src = `process p1 {
  name "One"
  overlay true
}
`;
    const once = dump(load(src));
    const twice = dump(load(once));
    assert.equal(once, twice);
    assert.match(once, /overlay true/);

    const plain = dump(load('process p2 {\n  name "Two"\n}\n'));
    assert.doesNotMatch(plain, /overlay/);
  });

  it('a class overlay deep-merges: attributes union by id, first-seen order', async () => {
    const root = mkdtempSync(join(tmpdir(), 'prl-ovl-'));
    makePackage(
      root,
      'core',
      `class Entity#data {
  store { entities }
  attribute id, string {
    modality SHALL
  }
  attribute label, string {
    modality MAY
  }
}`,
    );
    const recDir = makePackage(
      root,
      'rec',
      `class Entity#data {
  overlay { true }
  attribute extra_note, string {
    modality MAY
  }
}`,
      ['core'],
    );
    const std = (await loadPackage(recDir, {
      resolvePackage: (id: string) => join(root, id),
    })) as unknown as {
      dataclasses: {
        id: string;
        store?: string;
        attributes: { id: string; modality: string }[];
      }[];
    };
    const merged = std.dataclasses.find(c => c.id === 'Entity#data');
    assert.ok(merged, 'the class survives the merge');
    assert.equal(merged?.store, 'entities', 'scalars survive');
    assert.deepEqual(
      merged?.attributes.map(a => a.id),
      ['id', 'label', 'extra_note'],
      'attributes union in first-seen order, the rec additions last',
    );
  });

  it('the class-level overlay facet round-trips in the brace form', () => {
    const src = `class C#data {
  overlay { true }
  attribute a, string {
    modality MAY
  }
}
`;
    const once = dump(load(src));
    const twice = dump(load(once));
    assert.equal(once, twice);
    assert.match(once, /overlay \{ true \}/);
  });
});
