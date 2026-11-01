// ─────────────────────────────────────────────────────────────────────
// The three-way structural merge (CRITIQUE-3 REVIEW #10): base/ours/
// theirs over the id-keyed plane. The legs: the disjoint adds and
// changes merge clean; a field only one side touched takes that side;
// a field both touched differently conflicts; a remove against a
// change conflicts (modify/delete); a remove against an untouched
// element removes.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeStandards } from '../src/model-merge';
import { loadPackageWithIssues } from '../src/ser-des/index';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Standard from '../src/types/Standard';

function variant(
  tag: string,
  symbols: string[],
  requirementName: string,
): Standard {
  const dir = mkdtempSync(join(tmpdir(), `prl-merge-${tag}-`));
  writeFileSync(join(dir, 'package.primmel'), 'package { id probe }');
  mkdirSync(join(dir, 'specification'), { recursive: true });
  writeFileSync(join(dir, 'specification', 'c.prl'), symbols.join('\n'));
  writeFileSync(
    join(dir, 'specification', 'r.prl'),
    `requirement /req/x {\n name "${requirementName}"\n statement { S }\n}\n`,
  );
  return loadPackageWithIssues(dir).standard!;
}

describe('the three-way structural merge', () => {
  const base = variant(
    'base',
    [
      'symbol shared { latex "n_s" }',
      'symbol gone { latex "n_g" }',
      'symbol touched { latex "n_t" }',
    ],
    'The base name',
  );
  const ours = variant(
    'ours',
    [
      'symbol shared { latex "n_s" }',
      'symbol gone { latex "n_g" }',
      'symbol touched { latex "n_t_ours" }',
      'symbol ours_only { latex "n_o" }',
    ],
    'The base name',
  );
  const theirs = variant(
    'theirs',
    [
      'symbol shared { latex "n_s" }',
      'symbol touched { latex "n_t" }',
      'symbol theirs_only { latex "n_x" }',
    ],
    'The theirs name',
  );

  it('the disjoint work merges clean: adds, removes, and changes', () => {
    const r = mergeStandards(base, ours, theirs);
    const ids = r.standard.symbols.map(s => s.id).sort();
    // gone: theirs removed, ours untouched → removed
    // ours_only: ours added → kept; theirs_only: theirs added → spliced
    assert.deepEqual(ids, ['ours_only', 'shared', 'theirs_only', 'touched']);
    const touched = r.standard.symbols.find(s => s.id === 'touched');
    // touched: ours changed, theirs didn't → ours' label stands
    assert.equal(touched?.latex, 'n_t_ours');
    const outcomes = r.dispositions.map(d => d.outcome).sort();
    assert.ok(outcomes.includes('removed'));
    assert.ok(outcomes.includes('added-theirs'));
    assert.deepEqual(r.conflicts, []);
  });

  it("the requirement name: theirs changed, ours didn't → takes theirs", () => {
    const r = mergeStandards(base, ours, theirs);
    const req = r.standard.requirements.find(x => x.id === '/req/x');
    assert.equal(req?.name, 'The theirs name');
    assert.ok(
      r.dispositions.some(
        d => d.key === 'requirements:/req/x' && d.outcome === 'took-theirs',
      ),
    );
  });

  it('a field both sides touched differently conflicts — ours kept', () => {
    const both = variant(
      'both',
      [
        'symbol shared { latex "n_s" }',
        'symbol gone { latex "n_g" }',
        'symbol touched { latex "n_t_both" }',
        'symbol ours_only { latex "n_o" }',
      ],
      'The base name',
    );
    const r = mergeStandards(base, ours, both);
    const conflicts = r.conflicts.filter(c => c.element === false);
    assert.equal(conflicts.length, 1, 'one field-level conflict');
    const c = conflicts[0]!;
    assert.equal(c.key, 'symbols:touched');
    assert.ok(c.fields[0].ours.includes('n_t_ours'));
    assert.ok(c.fields[0].theirs.includes('n_t_both'));
    const touched = r.standard.symbols.find(s => s.id === 'touched');
    assert.equal(touched?.latex, 'n_t_ours', 'ours kept in the output');
  });

  it('a remove against a change conflicts (modify/delete)', () => {
    // ours changes `gone`; theirs removes it — the conflict
    const oursMd = variant(
      'oursmd',
      [
        'symbol shared { latex "n_s" }',
        'symbol gone { latex "n_g_ours" }',
        'symbol touched { latex "n_t" }',
        'symbol ours_only { latex "n_o" }',
      ],
      'The base name',
    );
    const r = mergeStandards(base, oursMd, theirs);
    const modDel = r.conflicts.filter(c => c.element);
    assert.equal(modDel.length, 1, 'the modify/delete conflict');
    assert.equal(modDel[0].key, 'symbols:gone');
    // ours' element stands in the output
    assert.ok(r.standard.symbols.some(s => s.id === 'gone'));
  });
});
