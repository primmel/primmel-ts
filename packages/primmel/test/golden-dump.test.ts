// ─────────────────────────────────────────────────────────────────────
// The golden-dump harness (the design lesson of the dump-flip record:
// the flip's blast radius was "every dump expectation in the tests",
// re-based by hand). The harness holds the dumpers' canonical outputs
// as FILES: test/golden/dump/<name>.prl (the input model) beside
// <name>.expected.prl (the dump's bytes). The test walks the directory
// and compares; `yarn rebake-golden` regenerates the expected files.
// A dumper change reviews as a directory diff, never as a hunt through
// inline string assertions.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';

const GOLDEN = join(process.cwd(), 'test', 'golden', 'dump');

const inputs = existsSync(GOLDEN)
  ? readdirSync(GOLDEN).filter(
      f => f.endsWith('.prl') && !f.endsWith('.expected.prl'),
    )
  : [];

describe('the golden dump harness', () => {
  it('has fixtures (the harness is not silently empty)', () => {
    assert.ok(inputs.length > 0, `no fixtures in ${GOLDEN}`);
  });

  for (const f of inputs) {
    it(`dumps ${f} to its golden bytes`, () => {
      const src = readFileSync(join(GOLDEN, f), 'utf8');
      const expectedPath = join(GOLDEN, f.replace(/\.prl$/, '.expected.prl'));
      assert.ok(
        existsSync(expectedPath),
        `the golden bytes are missing: ${expectedPath} (yarn rebake-golden writes them)`,
      );
      const expected = readFileSync(expectedPath, 'utf8');
      const actual = dump(load(src));
      assert.equal(actual.trimEnd(), expected.trimEnd());
    });
  }
});
