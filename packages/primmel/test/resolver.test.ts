import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../src/ser-des/index';
import type Standard from '../src/types/Standard';

describe('resolve (lenient mode)', () => {
  it('drops missing references rather than throwing', () => {
    // process p references actor "ghost" which is never declared
    const src = `
      process p {
        name "P"
        actor ghost
      }
    `;
    const s: Standard = load(src);
    assert.equal(s.processes.length, 1);
    assert.equal(s.processes[0].id, 'p');
    assert.equal(s.processes[0].actor, null);
  });

  it('resolves a present reference to the full object', () => {
    const src = `
      role author { name "Author" }
      process p {
        name "P"
        actor author
      }
    `;
    const s = load(src);
    assert.equal(s.processes.length, 1);
    assert.equal(s.processes[0].actor?.id, 'author');
    assert.equal(s.processes[0].actor?.name, 'Author');
  });

  it('strips _relations from resolved items', () => {
    const src = `
      role author { name "Author" }
      provision p1 { modality shall reference { } }
    `;
    const s = load(src);
    assert.equal(s.provisions.length, 1);
    // _relations should not leak through to the typed output
    assert.equal((s.provisions[0] as any)._relations, undefined);
  });

  it('keeps a partially-resolved item when one of many refs is missing', () => {
    const src = `
      role real { name "Real" }
      approval a {
        name "A"
        actor real
        approve_by ghost
      }
    `;
    const s = load(src);
    assert.equal(s.approvals.length, 1);
    assert.equal(s.approvals[0].actor?.id, 'real');
    // approver was missing — lenient mode leaves it null rather than dropping the approval
    assert.equal(s.approvals[0].approver, null);
  });
});
