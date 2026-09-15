// ─────────────────────────────────────────────────────────────────────
// The composition-contract guard (the packages-as-SSOT epic): every
// id-keyed ParseContext collection must appear in MERGE_FIELDS — a
// collection missing there is silently dropped from `uses` composition.
// (The pre-epic drift: 11 collections — comments, predicates, the
// artifact registers, activityArchetypes, connectorProfiles, monitors,
// passports, dataspaces, policies, dimensions — existed as constructs
// but never merged.)
//
// The check runs at runtime against the REAL objects: a fresh context
// from parse('') enumerates the actual record collections; MERGE_FIELDS
// is the actual composition list. No hand-maintained mirror.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import parse from '../src/ser-des/parse';
import { PARSER_CONFIG } from '../src/ser-des/config/index';
import { MERGE_FIELDS } from '../src/ser-des/package';

describe('MERGE_FIELDS ≡ the ParseContext record collections', () => {
  it('every id-keyed collection composes through uses — no silent drops', () => {
    const ctx = parse('', PARSER_CONFIG) as unknown as Record<string, unknown>;
    const recordFields = Object.keys(ctx)
      .filter(
        k =>
          typeof ctx[k] === 'object' &&
          ctx[k] !== null &&
          !Array.isArray(ctx[k]),
      )
      .sort();
    const merged = [...MERGE_FIELDS].sort();
    assert.deepEqual(
      recordFields,
      merged,
      'a ParseContext record collection is missing from MERGE_FIELDS (uses composition drops it) or MERGE_FIELDS names a non-collection',
    );
  });
});
