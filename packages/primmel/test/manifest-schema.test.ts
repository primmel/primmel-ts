// ─────────────────────────────────────────────────────────────────────
// The manifest's declared schema (CRITIQUE-2 #10): the facet registry
// and the parser cannot drift — every handler the parser carries has a
// schema row, and every schema row names a facet the parser reads.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MANIFEST_FACETS,
  manifestFacet,
} from '../src/ser-des/config/manifestSchema';

describe('the manifest schema (CRITIQUE-2 #10)', () => {
  const parserSource = readFileSync(
    join(__dirname, '..', 'src', 'ser-des', 'config', 'packageManifest.ts'),
    'utf8',
  );

  it('covers the parser handler set — and vice versa', () => {
    const handlers = new Set<string>();
    for (const m of parserSource.matchAll(/cmd === '([a-zA-Z_]+)'/g)) {
      handlers.add(m[1]!);
    }
    assert.ok(handlers.size >= 25, `the handler scan found ${handlers.size}`);
    const schemaKeywords = new Set(
      MANIFEST_FACETS.flatMap(f => [f.keyword, ...(f.aliases ?? [])]),
    );
    for (const h of handlers) {
      assert.ok(
        schemaKeywords.has(h),
        `the parser handles "${h}" but the schema declares no row`,
      );
    }
    for (const k of schemaKeywords) {
      assert.ok(
        handlers.has(k),
        `the schema declares "${k}" but the parser never reads it`,
      );
    }
  });

  it('the closed vocabularies are the ones the parser refuses on', () => {
    assert.equal(manifestFacet('kind')!.vocabulary?.length, 5);
    assert.equal(manifestFacet('status')!.vocabulary?.length, 4);
    // the schema and the parser share the same constants — the parser
    // imports them from the schema module
    assert.match(parserSource, /from '\.\/manifestSchema'/);
  });

  it('every schema row states its arity and a note', () => {
    for (const f of MANIFEST_FACETS) {
      assert.ok(f.note.length > 5, `${f.keyword} carries a note`);
      assert.ok(
        ['scalar', 'block-list', 'urn-list', 'ref-block', 'block'].includes(
          f.arity,
        ),
        `${f.keyword} states a known arity`,
      );
    }
  });
});
