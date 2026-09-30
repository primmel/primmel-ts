// ─────────────────────────────────────────────────────────────────────
// The second checker's front end: the shape-tree model's invariants.
// The corpus agreement is the checker2 leg's job; these specs pin the
// MODEL — the forms the shape tree actually delivers (structured
// bodies, raw-text bodies, block values, greedy value runs).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { documentConstructs, resolveParsanolTs } from '../src/front-end.ts';
import { check } from '../src/rules.ts';
import type { ParsedPackage } from '../src/front-end.ts';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const parsanol = resolveParsanolTs(REPO_ROOT);

async function runtime(): Promise<{ parseShape(src: string): unknown } | null> {
  if (
    !parsanol ||
    !existsSync(join(REPO_ROOT, 'grammar', 'artifacts', 'primmel.json'))
  ) {
    return null;
  }
  const { PargRuntime } = (await import(
    join(parsanol, 'dist', 'runtime.js')
  )) as {
    PargRuntime: {
      fromFile(path: string): { parseShape(src: string): unknown };
    };
  };
  return PargRuntime.fromFile(
    join(REPO_ROOT, 'grammar', 'artifacts', 'primmel.json'),
  );
}

const rt = await runtime();

function constructs(src: string) {
  return documentConstructs(rt!.parseShape(src));
}

describe('the shape-tree model', () => {
  it('reads a structured body: nested constructs and lines', () => {
    const cs = constructs(
      'form F {\n  name "N"\n  field x { bind model.parameters.a }\n}\n',
    );
    assert.equal(cs.length, 1);
    assert.equal(cs[0]!.keyword, 'form');
    assert.equal(cs[0]!.ident, 'F');
    const names = cs[0]!.items.filter(
      i => i.kind === 'line' && i.key === 'name',
    );
    assert.deepEqual(names[0]!.tokens, ['N']);
  });

  it('reads a raw-text body (a block whose items produced no captures)', () => {
    const cs = constructs('class A {\n  store { records }\n  id: string\n}\n');
    const stores = cs[0]!.items.filter(i => i.construct?.keyword === 'store');
    assert.deepEqual(
      stores[0]!.construct!.items.flatMap(i => i.tokens),
      ['records'],
    );
  });

  it('reads block values riding a greedy value run', () => {
    const cs = constructs(
      'process p {\n  does {\n    flow { begin -> done }\n  }\n}\n',
    );
    const does = cs[0]!.items[0]!.construct!;
    const flow = does.items[0]!.construct!;
    assert.equal(flow.keyword, 'flow');
    const edge = flow.items[0]!;
    assert.equal(edge.key, 'begin');
    assert.deepEqual(edge.tokens, ['->', 'done']);
  });
});

describe('the second checker rules', () => {
  it('a form binding an undeclared attribute fires C1', () => {
    const pkg: ParsedPackage = {
      constructs: constructs(
        'form F {\n  field x { bind model.parameters.ghost }\n}\n',
      ),
    };
    assert.deepEqual(
      check(pkg).map(i => i.rule),
      ['C1'],
    );
  });

  it('two declarations of one (keyword, id) fire C96 once', () => {
    const pkg: ParsedPackage = {
      constructs: constructs(
        'role r {\n  name "a"\n}\n\nrole r {\n  name "b"\n}\n',
      ),
    };
    assert.deepEqual(
      check(pkg).map(i => i.rule),
      ['C96'],
    );
  });
});
