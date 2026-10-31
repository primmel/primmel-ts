// ─────────────────────────────────────────────────────────────────────
// The value-set facets take one shape (CRITIQUE-2 #2's facet half,
// TODO.lang-gaps/21): `values` / `enum_values` read the block `{ … }`
// or the bracket list `[A, B]`; the bare line-run spelling TRUNCATED
// (one entry read, the rest silently dropped) and now refuses at
// parse. Every carrier — the dimension, the attribute, the form
// field, the calculation input — shares the guard.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPackageWithIssues } from '../src/ser-des/package';

function pkg(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'prl-valueshape-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id probe }');
  mkdirSync(join(dir, 'specification'), { recursive: true });
  writeFileSync(join(dir, 'specification', 'c.prl'), body);
  return dir;
}

function rejection(body: string): string {
  try {
    loadPackageWithIssues(pkg(body));
  } catch (e) {
    return String((e as Error)?.message ?? e);
  }
  return 'no rejection';
}

describe('the value-set facets take one shape', () => {
  it('the block and bracket forms parse every entry', () => {
    const std = loadPackageWithIssues(
      pkg(
        'dimension accuracy_class {\n  scope group\n  values { A B }\n}\nattribute_definition kind_x {\n  symbol "K"\n  origin design-fixed\n  scope model\n  enum_values { alpha beta }\n}\n',
      ),
    ).standard!;
    const dim = std.dimensions.find((d: any) => d.id === 'accuracy_class');
    assert.deepEqual(
      dim.values.map((v: any) => v.id),
      ['A', 'B'],
    );
    const attr = std.attributeDefinitions.find(
      (a: any) => a.id === 'kind_x',
    );
    assert.deepEqual(attr.enumValues, ['alpha', 'beta']);
  });

  it('the line-run spelling refuses at every carrier', () => {
    assert.match(
      rejection(
        'dimension accuracy_class {\n  scope group\n  values A B\n}\n',
      ),
      /values \{ A … \}/,
      'the dimension values facet refuses',
    );
    assert.match(
      rejection(
        'attribute_definition k {\n  symbol "K"\n  origin design-fixed\n  scope model\n  enum_values alpha beta\n}\n',
      ),
      /enum_values \{ alpha … \}/,
      'the attribute enum_values facet refuses',
    );
    assert.match(
      rejection(
        'form F {\n  name "F"\n  field k : string { values alpha beta }\n}\n',
      ),
      /value-set facet takes the block form/,
      'the form field values facet refuses',
    );
  });
});
