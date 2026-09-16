// ─────────────────────────────────────────────────────────────────────
// The common_test_condition register (smart TODO.roadmap/40 batch 4;
// the packages-as-SSOT epic) — the model-wide test-conditions register,
// one construct per entry (title, the free citation-string reference,
// description, the optional source provenance), and the C127
// common-test-condition-shape linter rule (the description is the one
// facet both YAML shapes carry).
//
// Fixtures:
//   CONDITIONS — the r60 carrier shape (array entries) plus the r91
//                keyed-map shape flattened to an entry (map key → id,
//                per-entry source, no title).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const CONDITIONS = `
common_test_condition test_equipment {
  title "Test equipment"
  reference "urn:oiml:pub:r:60-2:2021#clause-2.7.2"
  description "Test equipment used for the tests shall be calibrated and traceable to national standards."
}
common_test_condition measurement_counts {
  reference "urn:oiml:pub:r:91-1:1990#clause-8.3"
  description "The number of measurements shall be sufficient to evaluate the drift."
  source { doc "urn:oiml:pub:r:91:1990" clause "8.3" }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-ctc-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('common_test_condition construct (smart TODO.roadmap/40 batch 4)', () => {
  it('parses both entry shapes', () => {
    const m = load(CONDITIONS);
    assert.equal(m.commonTestConditions.length, 2);
    const a = m.commonTestConditions[0]!;
    assert.equal(a.id, 'test_equipment');
    assert.equal(a.title, 'Test equipment');
    assert.equal(a.reference, 'urn:oiml:pub:r:60-2:2021#clause-2.7.2');
    assert.match(a.description, /^Test equipment used/);
    assert.equal(a.source, null);
    const b = m.commonTestConditions[1]!;
    // The r91 keyed-map shape flattened: map key → id, no title.
    assert.equal(b.id, 'measurement_counts');
    assert.equal(b.title, '');
    assert.equal(b.source?.doc, 'urn:oiml:pub:r:91:1990');
    assert.equal(b.source?.clause, '8.3');
  });

  it('round-trips the register losslessly (fixpoint)', () => {
    const once = dump(load(CONDITIONS));
    const twice = dump(load(once));
    assert.equal(twice, once);
    assert.deepEqual(
      load(once).commonTestConditions,
      load(CONDITIONS).commonTestConditions,
    );
  });
});

describe('C127 common-test-condition-shape', () => {
  function c127Issues(body: string) {
    return checkPackage(makePackage(body)).filter(i => i.check === 'C127');
  }

  it('accepts well-formed entries of both shapes', () => {
    assert.deepEqual(c127Issues(CONDITIONS), []);
  });

  it('flags an entry without its description', () => {
    const issues = c127Issues(`
common_test_condition bare {
  title "A title is not a condition"
}
`);
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /description is required/);
    assert.match(issues[0]!.message, /common-test-condition-shape/);
  });
});
