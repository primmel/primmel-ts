import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import resolve, { resolveFromContext } from '../src/ser-des/resolve';
import { RESOLVER_CONFIG } from '../src/ser-des/config';
import type { ParseContext } from '../src/ser-des/types';
import type Role from '../src/types/Role';

// Unit-scoped resolver tests. The end-to-end resolver.test.ts goes
// through load() (parse + resolve), which can mask resolver bugs behind
// parse quirks. These tests construct a minimal ParseContext by hand
// and call resolve() directly — isolating resolver behaviour.

function emptyContext(): ParseContext {
  return {
    root: '',
    metadata: null,
    roles: {},
    approvals: {},
    provisions: {},
    processes: {},
    pages: {},
    gateways: {},
    regs: {},
    references: {},
    dataclasses: {},
    events: {},
    enums: {},
    variables: {},
    notes: {},
    tables: {},
    figures: {},
    links: {},
    mapProfiles: {},
    viewProfiles: {},
    terms: {},
    forms: {},
    subforms: {},
    symbols: {},
    calculations: {},
    stateMachines: {},
    conformanceTests: {},
    issues: [],
  };
}

describe('resolveFromContext (unit)', () => {
  it('returns undefined when the field table is missing the id', () => {
    const ctx = emptyContext();
    const r = resolveFromContext<Role>(ctx, 'roles', 'ghost');
    assert.equal(r, undefined);
  });

  it('returns the item as-is when it has no _relations', () => {
    const ctx = emptyContext();
    const role: Role = { id: 'author', name: 'Author' };
    ctx.roles.author = role;
    const r = resolveFromContext<Role>(ctx, 'roles', 'author');
    assert.equal(r, role);
  });

  it('returns a stripped copy when the item has _relations, WITHOUT mutating ctx', () => {
    const ctx = emptyContext();
    const unresolved = {
      id: 'r1',
      name: 'R1',
      _relations: { actor: '' },
    } as unknown as Role;
    ctx.roles.r1 = unresolved;

    const r = resolveFromContext<Role>(ctx, 'roles', 'r1');
    assert.equal(r?.id, 'r1');
    // The returned copy has _relations stripped ...
    assert.equal((r as { _relations?: unknown })?._relations, undefined);
    // ... but the original ctx entry is untouched (pure: no side effect).
    assert.notEqual(
      (ctx.roles.r1 as { _relations?: unknown })._relations,
      undefined,
      'resolveFromContext must NOT mutate the cached ctx entry',
    );
  });
});

describe('resolve (unit, minimal context)', () => {
  it('returns an empty Standard for an empty context', () => {
    const s = resolve(emptyContext(), RESOLVER_CONFIG);
    assert.deepEqual(s.roles, []);
    assert.deepEqual(s.processes, []);
    assert.deepEqual(s.provisions, []);
    assert.equal(s.root, null);
  });

  it('passes through fields without a resolver (e.g. roles)', () => {
    const ctx = emptyContext();
    ctx.roles.author = { id: 'author', name: 'Author' };
    ctx.roles.editor = { id: 'editor', name: 'Editor' };
    const s = resolve(ctx, RESOLVER_CONFIG);
    assert.equal(s.roles.length, 2);
    assert.deepEqual(s.roles.map(r => r.id).sort(), ['author', 'editor']);
  });

  it('uses EMPTY_META when metadata is null', () => {
    const ctx = emptyContext();
    const s = resolve(ctx, RESOLVER_CONFIG);
    assert.equal(s.meta.title, '');
    assert.equal(s.meta.schema, '');
  });

  it('resolves registered fields (e.g. provisions)', () => {
    const ctx = emptyContext();
    ctx.provisions.p1 = {
      subject: new Map(),
      id: 'p1',
      modality: 'shall',
      condition: '',
      ref: [],
      _relations: { ref: [] },
    };
    const s = resolve(ctx, RESOLVER_CONFIG);
    assert.equal(s.provisions.length, 1);
    assert.equal(s.provisions[0].id, 'p1');
    // _relations stripped from resolved output
    assert.equal(
      (s.provisions[0] as { _relations?: unknown })._relations,
      undefined,
    );
  });

  it('is order-independent: shuffling RESOLVER_CONFIG does not change results', () => {
    const ctx = emptyContext();
    ctx.roles.author = { id: 'author', name: 'A' };
    ctx.processes.p = {
      id: 'p',
      name: 'P',
      modality: '',
      actor: null,
      output: [],
      input: [],
      provision: [],
      page: null,
      measure: [],
      parent: '',
      children: [],
      _relations: {
        actor: 'author',
        output: [],
        input: [],
        provision: [],
        page: '',
      },
    };

    // Build a reversed-order resolver config — should produce the same
    // result because resolveFromContext is pure.
    const reversedEntries = Object.entries(RESOLVER_CONFIG).reverse();
    const reversedConfig = Object.fromEntries(
      reversedEntries,
    ) as typeof RESOLVER_CONFIG;

    const s1 = resolve(ctx, RESOLVER_CONFIG);
    const s2 = resolve(ctx, reversedConfig);
    assert.equal(s1.processes[0].actor?.id, 'author');
    assert.equal(s2.processes[0].actor?.id, 'author');
  });
});
