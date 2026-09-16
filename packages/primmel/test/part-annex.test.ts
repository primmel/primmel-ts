// ─────────────────────────────────────────────────────────────────────
// The part_annex register (smart TODO.roadmap/40 batch 4; the
// packages-as-SSOT epic) — the rec's own annex-volume index (r60 Part
// 4: annexes A–F), with the parse-enforced obligation vocabulary and
// the C128 part-annex-shape linter rule (letters unique per package,
// the source provenance required).
//
// Fixture: the r60 carrier shape — two of the six Part-4 annexes.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const ANNEXES = `
part_annex annex_a {
  letter "A"
  title "Definitions from other applicable international publications"
  obligation normative
  summary "Definitions from other publications applicable to this Recommendation."
  realization "The definitions are reproduced with their source citations."
  source { doc "urn:oiml:pub:r:60-4:2021" clause "A" }
}
part_annex annex_b {
  letter "B"
  title "Additional notes"
  obligation informative
  summary "Informative notes on the application of the requirements."
  realization "The notes accompany the test report format."
  source { doc "urn:oiml:pub:r:60-4:2021" clause "B" }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-partannex-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('part_annex construct (smart TODO.roadmap/40 batch 4)', () => {
  it('parses the register entries', () => {
    const m = load(ANNEXES);
    assert.equal(m.partAnnexes.length, 2);
    const a = m.partAnnexes[0]!;
    assert.equal(a.id, 'annex_a');
    assert.equal(a.letter, 'A');
    assert.equal(a.obligation, 'normative');
    assert.match(a.title, /^Definitions from other/);
    assert.match(a.summary, /^Definitions from other/);
    assert.match(a.realization, /^The definitions are reproduced/);
    assert.equal(a.source.doc, 'urn:oiml:pub:r:60-4:2021');
    assert.equal(a.source.clause, 'A');
    assert.equal(m.partAnnexes[1]!.obligation, 'informative');
  });

  it('rejects an unknown obligation at parse (the fail-closed precedent)', () => {
    assert.throws(
      () =>
        load(`
part_annex broken {
  letter "C"
  obligation advisory
}
`),
      /Unknown obligation "advisory"/,
    );
  });

  it('round-trips the register losslessly (fixpoint)', () => {
    const once = dump(load(ANNEXES));
    const twice = dump(load(once));
    assert.equal(twice, once);
    assert.deepEqual(load(once).partAnnexes, load(ANNEXES).partAnnexes);
  });
});

describe('C128 part-annex-shape', () => {
  function c128Issues(body: string) {
    return checkPackage(makePackage(body)).filter(i => i.check === 'C128');
  }

  it('accepts a well-formed register', () => {
    assert.deepEqual(c128Issues(ANNEXES), []);
  });

  it('flags a duplicate letter', () => {
    const issues = c128Issues(
      ANNEXES +
        `
part_annex annex_again {
  letter "A"
  title "A second annex A"
  obligation informative
  source { doc "urn:oiml:pub:r:60-4:2021" clause "A" }
}
`,
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /already declared by annex_a/);
    assert.match(issues[0]!.message, /part-annex-shape/);
  });

  it('flags an entry without its source provenance', () => {
    const issues = c128Issues(`
part_annex orphaned {
  letter "C"
  title "No provenance"
  obligation informative
}
`);
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /source provenance is required/);
  });
});
