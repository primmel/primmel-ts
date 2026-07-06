import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../src/ser-des/index';

describe('strict mode (unknown keyword handling)', () => {
  it('lenient mode (default): silently skips unknown keywords', () => {
    const src = `
      future_keyword ignored { nothing }
      role author { name "Author" }
    `;
    const s = load(src);
    assert.equal(s.roles.length, 1);
    assert.equal(s.roles[0].id, 'author');
  });

  it('strict mode: throws on unknown top-level keyword', () => {
    const src = `
      future_keyword ignored { nothing }
      role author { name "Author" }
    `;
    assert.throws(
      () => load(src, { strict: true }),
      /Unknown keyword "future_keyword"/,
    );
  });

  it('strict mode: still parses known keywords normally', () => {
    const src = `
      role author { name "Author" }
      process p { name "P" }
    `;
    const s = load(src, { strict: true });
    assert.equal(s.roles.length, 1);
    assert.equal(s.processes.length, 1);
  });

  it('lenient mode: forward-compatible keywords inside a block are silently skipped', () => {
    // process p has an unknown sub-keyword "future_field"
    const src = `
      process p {
        name "P"
        future_field value
      }
    `;
    const s = load(src);
    assert.equal(s.processes.length, 1);
    assert.equal(s.processes[0].name, 'P');
  });

  it('throws when a takesID keyword lacks an ID token', () => {
    // role consumes (id, payload); leaving just "role" at end-of-input
    // should produce a structured error.
    assert.throws(() => load('role'), /expects an ID and payload/);
  });

  it('throws when a payload-only keyword lacks its payload', () => {
    assert.throws(() => load('metadata'), /expects a payload/);
  });
});
