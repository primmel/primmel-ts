import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

// discrepancy_record construct (TODO.roadmap/54 — BUG.R60-SSOT gap 13's
// corpus-level extension of the shipped source_discrepancy facet): named
// records that two or more source fragments conflict, where no model node
// owns the disagreement. The facet fields (summary / sources / resolution
// / rationale) are identical to the facet; status + governing are the
// corpus wrapper.

const SRC = `discrepancy_record pd-02-vs-od-01-expert-review-cycle {
  status resolved
  summary "PD-02, 11.1 prescribes review of the on-going competence and suitability of experts at least once every four years 'as outlined in OD-01, 13.4', which prescribes a 3-yearly review — a genuine source disagreement."
  sources { "urn:oiml:pub:cs:pd-02:2022#clause-11.1" "urn:oiml:pub:cs:od-01:2022#clause-13.4" }
  resolution annotated_only
  rationale "Both official texts verified verbatim against the published PDFs (task 46, 2026-07-24); neither governs — each document module keeps its own text. A CID-01 clarification candidate."
}

discrepancy_record od-01-toc-vs-body-numbering {
  status resolved
  summary "OD-01's printed Contents skips 7.2, so every TOC entry from 7.2 onward reads body-1."
  sources { "urn:oiml:pub:cs:od-01:2022#contents" "urn:oiml:pub:cs:od-01:2022#clause-7.2" }
  resolution follows_clause_x
  governing "urn:oiml:pub:cs:od-01:2022#clause-7.2"
  rationale "The body numbering — which every internal cross-reference in the CS corpus uses — is authoritative (task 46, verified against the official PDF 2026-07-24)."
}

discrepancy_record suspected-r60-3-drop {
  status open
  summary "A clause possibly dropped between editions — not yet dispositioned."
  sources { "urn:oiml:pub:r:60-3:2021#clause-9.9" "urn:oiml:pub:r:60-3:2021#annex-a" }
}
`;

describe('discrepancy_record construct', () => {
  it('parses every facet', () => {
    const m = load(SRC);
    const r = m.discrepancyRecords.find(
      r => r.id === 'pd-02-vs-od-01-expert-review-cycle',
    )!;
    assert.equal(r.status, 'resolved');
    assert.match(r.summary, /four years/);
    assert.deepEqual(r.sources, [
      'urn:oiml:pub:cs:pd-02:2022#clause-11.1',
      'urn:oiml:pub:cs:od-01:2022#clause-13.4',
    ]);
    assert.equal(r.resolution, 'annotated_only');
    assert.equal(r.governing, '');
    assert.match(r.rationale, /CID-01/);
  });

  it('parses governing for follows_clause_x and tolerates an open record', () => {
    const m = load(SRC);
    const r = m.discrepancyRecords.find(
      r => r.id === 'od-01-toc-vs-body-numbering',
    )!;
    assert.equal(r.resolution, 'follows_clause_x');
    assert.equal(r.governing, 'urn:oiml:pub:cs:od-01:2022#clause-7.2');
    const open = m.discrepancyRecords.find(
      r => r.id === 'suspected-r60-3-drop',
    )!;
    assert.equal(open.status, 'open');
    assert.equal(open.resolution, '');
    assert.equal(open.rationale, '');
  });

  it('rejects an unknown status or resolution', () => {
    assert.throws(
      () =>
        load(
          `discrepancy_record x { status settled summary "s" sources { "urn:oiml:pub:r:60-1:2021" "urn:oiml:pub:r:60-3:2021" } }`,
        ),
      /Unknown status settled/,
    );
    assert.throws(
      () =>
        load(
          `discrepancy_record x { status resolved summary "s" sources { "urn:oiml:pub:r:60-1:2021" "urn:oiml:pub:r:60-3:2021" } resolution follows_newer }`,
        ),
      /Unknown resolution follows_newer/,
    );
  });

  it('dump → re-parse round-trips (semantic fixed point)', () => {
    const once = load(SRC);
    const twice = load(dump(once));
    assert.deepEqual(
      twice.discrepancyRecords.map(r => r.id).sort(),
      once.discrepancyRecords.map(r => r.id).sort(),
    );
    for (const a of once.discrepancyRecords) {
      const b = twice.discrepancyRecords.find(r => r.id === a.id)!;
      assert.deepEqual(b, a);
    }
  });
});
