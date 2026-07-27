// ─────────────────────────────────────────────────────────────────────
// Model diff tests (TODO.roadmap/28; doctrine ch. 13 §13.2–§13.3).
//
// The structural diff is id-keyed (never position-keyed), tier-annotated,
// and classified (added/removed/changed/moved). These tests pin the
// contract: aspect classification, declaration-order independence, the
// no-op ZERO-FALSE-POSITIVE proof, edition-normalized provenance, and
// the clause-drift table (the R 60:2017→2021 renumbering detector).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from '../src/ser-des/index';
import {
  diffStandards,
  elementIndex,
  formatDiffReport,
  normalizeSourceRef,
  type ClauseTextIndex,
} from '../src/model-diff';
import { diffPackageDirs } from '../src/package-diff';

const BASE = `
requirement /req/metrological/mpe {
  name "Maximum permissible error"
  statement "The error shall not exceed the MPE."
  binds_to { model.parameters.mpe }
  limit { expression "ocl{abs(e_l) <= mpe}" uses { mpe } }
  source { doc "urn:oiml:pub:r:60-1:2021" clause "5.2.1" }
}
conformance_test /conf/mpe-test {
  name "MPE test"
  purpose "Verify MPE compliance."
  targets { /req/metrological/mpe }
  binds_to { model.parameters.mpe }
  reference { doc "urn:oiml:pub:r:60-2:2021" clause "2.7.1" }
}
calculation vMin {
  name "vMin"
  description "Minimum verification interval"
  expression "ocl{(d_max - d_min) / (n_lc * f)}"
  source { doc "urn:oiml:pub:r:60-1:2021" clause "3.5.11" }
}
`;

function diff(aSrc: string, bSrc: string) {
  return diffStandards(load(aSrc), load(bSrc));
}

describe('model diff — added/removed/changed', () => {
  it('a no-op diff is EMPTY (zero false positives)', () => {
    const d = diff(BASE, BASE);
    assert.equal(d.empty, true);
    assert.equal(d.added.length, 0);
    assert.equal(d.removed.length, 0);
    assert.equal(d.changed.length, 0);
    assert.equal(d.moved.length, 0);
    assert.equal(d.clauseDrift.length, 0);
    assert.equal(d.unchanged, 3);
  });

  it('detects added and removed elements by stable id', () => {
    const b = diff(
      BASE,
      BASE + '\nrequirement /req/technical/software { name "Software" }\n',
    );
    assert.equal(b.added.length, 1);
    assert.equal(b.added[0].id, '/req/technical/software');
    assert.equal(b.added[0].kind, 'requirements');
    assert.equal(b.added[0].tier, 'secondary');
    const r = diff(BASE, BASE.replace(/conformance_test[\s\S]*?\n}\n/, ''));
    assert.equal(r.removed.length, 1);
    assert.equal(r.removed[0].id, '/conf/mpe-test');
  });

  it('classifies a statement change as statement, nothing else', () => {
    const d = diff(
      BASE,
      BASE.replace(
        'The error shall not exceed',
        'The error shall never exceed',
      ),
    );
    assert.equal(d.changed.length, 1);
    assert.equal(d.changed[0].id, '/req/metrological/mpe');
    assert.deepEqual(d.changed[0].aspects, ['statement']);
    assert.equal(d.moved.length, 0);
  });

  it('classifies a limit change as limit', () => {
    const d = diff(BASE, BASE.replace('abs(e_l) <= mpe', 'abs(e_l) < mpe'));
    assert.equal(d.changed.length, 1);
    assert.deepEqual(d.changed[0].aspects, ['limit']);
  });

  it('classifies a calculation expression change as limit', () => {
    const d = diff(BASE, BASE.replace('(n_lc * f)', '(n_lc * f * f)'));
    assert.equal(d.changed.length, 1);
    assert.equal(d.changed[0].id, 'vMin');
    assert.deepEqual(d.changed[0].aspects, ['limit']);
  });

  it('classifies a structural change as structure', () => {
    const d = diff(
      BASE,
      BASE.replace(
        'binds_to { model.parameters.mpe }\n  reference',
        'binds_to { model.parameters.mpe }\n  kind influence\n  reference',
      ),
    );
    assert.equal(d.changed.length, 1);
    assert.deepEqual(d.changed[0].aspects, ['structure']);
  });
});

describe('model diff — moved (re-anchored)', () => {
  it('an anchor-only change is MOVED, not changed', () => {
    const d = diff(
      BASE,
      BASE.replace(
        'binds_to { model.parameters.mpe }\n  limit',
        'binds_to { model.parameters.e_max }\n  limit',
      ),
    );
    assert.equal(d.changed.length, 0);
    assert.equal(d.moved.length, 1);
    assert.equal(d.moved[0].id, '/req/metrological/mpe');
    assert.match(d.moved[0].from, /model\.parameters\.mpe/);
    assert.match(d.moved[0].to, /model\.parameters\.e_max/);
  });

  it('an anchor + statement change is changed with both aspects (partition)', () => {
    const d = diff(
      BASE,
      BASE.replace(
        'binds_to { model.parameters.mpe }\n  limit',
        'binds_to { model.parameters.e_max }\n  limit',
      ).replace('The error shall not exceed', 'The error shall never exceed'),
    );
    assert.equal(d.moved.length, 0);
    assert.equal(d.changed.length, 1);
    assert.deepEqual(d.changed[0].aspects, ['anchor', 'statement']);
  });

  it('a moved row renders the differing anchor fields, not a JSON dump', () => {
    const d = diff(
      BASE,
      BASE.replace(
        'binds_to { model.parameters.mpe }\n  limit',
        'binds_to { model.parameters.e_max }\n  limit',
      ),
    );
    const report = formatDiffReport(d);
    assert.match(report, /moved \(re-anchored\):/);
    assert.match(
      report,
      /bindsTo: \["model\.parameters\.mpe"\] → \["model\.parameters\.e_max"\]/,
    );
    assert.ok(!report.includes('from {"bindsTo"'), 'no whole-aspect dump');
  });
});

describe('model diff — binding content is changed, never moved (M1)', () => {
  it('a calculation inputs/output SIGNATURE change is changed — binding', () => {
    // The reviewer's live repro: adding one input to vMin must NOT report
    // moved — a signature is content (§13.2 `changed`), not an anchor.
    const withSignature = BASE.replace(
      '  expression "ocl{(d_max - d_min) / (n_lc * f)}"',
      '  inputs {\n    d_max : number { description "Maximum test load" }\n  }\n' +
        '  output : number { name "v_min" }\n' +
        '  expression "ocl{(d_max - d_min) / (n_lc * f)}"',
    );
    const d = diff(BASE, withSignature);
    assert.equal(d.moved.length, 0);
    assert.equal(d.changed.length, 1);
    assert.equal(d.changed[0].id, 'vMin');
    assert.deepEqual(d.changed[0].aspects, ['binding']);
  });

  it('a requirement subjects change is changed — binding, not moved', () => {
    const d = diff(
      BASE,
      BASE.replace(
        '  binds_to { model.parameters.mpe }\n  limit',
        '  binds_to { model.parameters.mpe }\n' +
          '  subjects {\n    subject 1 { entity_id "dimensions.p_LC" label "Factor" }\n  }\n' +
          '  limit',
      ),
    );
    assert.equal(d.moved.length, 0);
    assert.equal(d.changed.length, 1);
    assert.deepEqual(d.changed[0].aspects, ['binding']);
  });

  it('a requirement channel change is changed — binding, not moved', () => {
    const d = diff(
      BASE,
      BASE.replace(
        '  binds_to { model.parameters.mpe }\n  limit',
        '  binds_to { model.parameters.mpe }\n  channel measurand_components\n  limit',
      ),
    );
    assert.equal(d.moved.length, 0);
    assert.equal(d.changed.length, 1);
    assert.deepEqual(d.changed[0].aspects, ['binding']);
  });

  it('a conformance test conditionsToEnforce change is changed — binding, not moved', () => {
    const d = diff(
      BASE,
      BASE.replace(
        '  binds_to { model.parameters.mpe }\n  reference',
        '  binds_to { model.parameters.mpe }\n  conditions_to_enforce { /cond/rated }\n  reference',
      ),
    );
    assert.equal(d.moved.length, 0);
    assert.equal(d.changed.length, 1);
    assert.equal(d.changed[0].id, '/conf/mpe-test');
    assert.deepEqual(d.changed[0].aspects, ['binding']);
  });

  it('a conformance test re-targeting IS moved (targets is an anchor)', () => {
    const d = diff(
      BASE,
      BASE.replace(
        'targets { /req/metrological/mpe }',
        'targets { /req/metrological/other }',
      ),
    );
    assert.equal(d.changed.length, 0);
    assert.equal(d.moved.length, 1);
    assert.equal(d.moved[0].id, '/conf/mpe-test');
    assert.match(d.moved[0].from, /\/req\/metrological\/mpe/);
    assert.match(d.moved[0].to, /\/req\/metrological\/other/);
  });

  it('anchor + binding content together is changed with both aspects', () => {
    const d = diff(
      BASE,
      BASE.replace(
        '  binds_to { model.parameters.mpe }\n  limit',
        '  binds_to { model.parameters.e_max }\n  channel measurand_components\n  limit',
      ),
    );
    assert.equal(d.moved.length, 0);
    assert.equal(d.changed.length, 1);
    assert.deepEqual(d.changed[0].aspects, ['anchor', 'binding']);
  });
});

describe('model diff — id-keyed, not position-keyed', () => {
  it('reordering declarations is not a model change', () => {
    const parts = BASE.split('\n}\n').filter(p => p.trim().length > 0);
    const reversed = parts
      .reverse()
      .map(p => p + '\n}')
      .join('\n');
    const d = diff(BASE, reversed);
    assert.equal(d.empty, true);
    assert.equal(d.unchanged, 3);
  });

  it('re-keyed ids are removal+addition, never a silent rename', () => {
    const d = diff(BASE, BASE.replace('calculation vMin', 'calculation v_min'));
    assert.equal(d.removed.length, 1);
    assert.equal(d.added.length, 1);
    assert.equal(d.removed[0].id, 'vMin');
    assert.equal(d.added[0].id, 'v_min');
  });
});

describe('model diff — edition-normalized provenance', () => {
  it('normalizeSourceRef splits basis/edition/fragment', () => {
    assert.deepEqual(normalizeSourceRef('urn:oiml:pub:r:60-2:2021', '2.10.4'), {
      basis: 'urn:oiml:pub:r:60-2',
      edition: '2021',
      clause: '2.10.4',
      fragment: '',
    });
    assert.deepEqual(
      normalizeSourceRef('urn:oiml:pub:r:60-1:2021#table-4', ''),
      {
        basis: 'urn:oiml:pub:r:60-1',
        edition: '2021',
        clause: '',
        fragment: 'table-4',
      },
    );
  });

  it('an edition-only doc change at the SAME clause is not a model change', () => {
    const d = diff(
      BASE,
      BASE.replace(
        /urn:oiml:pub:r:60-1:2021/g,
        'urn:oiml:pub:r:60-1:2017',
      ).replace(/urn:oiml:pub:r:60-2:2021/g, 'urn:oiml:pub:r:60-2:2017'),
    );
    assert.equal(d.empty, true);
    assert.equal(d.clauseDrift.length, 0);
  });

  it('a clause move between editions is a provenance change AND a drift row', () => {
    const d = diff(BASE, BASE.replace('clause "2.7.1"', 'clause "2.7.2"'));
    assert.equal(d.changed.length, 1);
    assert.equal(d.changed[0].id, '/conf/mpe-test');
    assert.deepEqual(d.changed[0].aspects, ['provenance']);
    assert.equal(d.clauseDrift.length, 1);
    const row = d.clauseDrift[0];
    assert.equal(row.doc, 'urn:oiml:pub:r:60-2');
    assert.equal(row.from, '2.7.1');
    assert.equal(row.to, '2.7.2');
    assert.equal(row.kind, 'renumbered');
    assert.deepEqual(
      row.citedBy.map(e => e.id),
      ['/conf/mpe-test'],
    );
  });
});

describe('clause drift — pairing, folding, text', () => {
  const DRIFT_A = `
calculation c1 {
  name "c1"
  expression "ocl{1}"
  source { doc "urn:oiml:pub:r:60-2:2017" clause "2.10.4" }
}
calculation c2 {
  name "c2"
  expression "ocl{2}"
  source { doc "urn:oiml:pub:r:60-3:2017" clause "2.1.3" }
  source { doc "urn:oiml:pub:r:60-3:2017" clause "2.1.3.1" }
}
calculation c3 {
  name "c3"
  expression "ocl{3}"
  source { doc "urn:oiml:pub:r:60-3:2017" clause "9.9.8" }
  source { doc "urn:oiml:pub:r:60-3:2017" clause "9.9.9" }
}
calculation c4 {
  name "c4"
  expression "ocl{4}"
  source { doc "urn:oiml:pub:r:60-3:2017" clause "9.9.9" }
}
`;
  const DRIFT_B = `
calculation c1 {
  name "c1"
  expression "ocl{1}"
  source { doc "urn:oiml:pub:r:60-2:2021" clause "2.10.5" }
  source { doc "urn:oiml:pub:r:60-2:2021" clause "2.10.6" }
}
calculation c2 {
  name "c2"
  expression "ocl{2}"
  source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1.2" }
  source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1.2.1" }
}
calculation c3 {
  name "c3"
  expression "ocl{3}"
  source { doc "urn:oiml:pub:r:60-3:2021" clause "9.9.9" }
}
calculation c4 {
  name "c4"
  expression "ocl{4}"
  source { doc "urn:oiml:pub:r:60-3:2021" clause "8.8.8" }
  source { doc "urn:oiml:pub:r:60-3:2021" clause "9.9.9" }
}
`;

  it('a 1:N renumbering (clause split) pairs the old clause with each new one', () => {
    const d = diff(DRIFT_A, DRIFT_B);
    const rows = d.clauseDrift.filter(r => r.doc === 'urn:oiml:pub:r:60-2');
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map(r => [r.from, r.to, r.kind]),
      [
        ['2.10.4', '2.10.5', 'renumbered'],
        ['2.10.4', '2.10.6', 'renumbered'],
      ],
    );
  });

  it('sub-clauses fold into their drifted parent (2.1.3/2.1.3.1 → 2.1.2)', () => {
    const d = diff(DRIFT_A, DRIFT_B);
    const rows = d.clauseDrift.filter(
      r =>
        r.doc === 'urn:oiml:pub:r:60-3' && r.citedBy.some(e => e.id === 'c2'),
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].from, '2.1.3');
    assert.equal(rows[0].to, '2.1.2');
    assert.equal(rows[0].kind, 'renumbered');
  });

  it('a clause cited in one edition only reports decited + recited', () => {
    const d = diff(DRIFT_A, DRIFT_B);
    // c3 cites 9.9.8 in the old edition only → de-cited; c4 gains 8.8.8
    // in the new edition only → re-cited. (A 1:1 clause move pairs as
    // renumbered — decited/recited is the leftover shape.)
    const decited = d.clauseDrift.find(r => r.kind === 'decited');
    assert.equal(decited?.from, '9.9.8');
    assert.equal(decited?.to, '');
    assert.deepEqual(
      decited?.citedBy.map(e => e.id),
      ['c3'],
    );
    const recited = d.clauseDrift.find(r => r.kind === 'recited');
    assert.equal(recited?.from, '');
    assert.equal(recited?.to, '8.8.8');
    assert.deepEqual(
      recited?.citedBy.map(e => e.id),
      ['c4'],
    );
  });

  it('clause texts classify same vs differed when payloads exist', () => {
    const sentencesA: ClauseTextIndex = new Map([
      ['urn:oiml:pub:r:60-3#2.1.3', 'The load cell error is computed thus.'],
    ]);
    const sentencesSame: ClauseTextIndex = new Map([
      ['urn:oiml:pub:r:60-3#2.1.2', 'The load cell   error is computed thus.'],
    ]);
    const sentencesDiff: ClauseTextIndex = new Map([
      [
        'urn:oiml:pub:r:60-3#2.1.2',
        'The load cell error SHALL be computed thus.',
      ],
    ]);
    const same = diffStandards(load(DRIFT_A), load(DRIFT_B), {
      sentencesA,
      sentencesB: sentencesSame,
    });
    const row = same.clauseDrift.find(
      r => r.doc === 'urn:oiml:pub:r:60-3' && r.from === '2.1.3',
    );
    assert.equal(row?.text, 'same');
    const differed = diffStandards(load(DRIFT_A), load(DRIFT_B), {
      sentencesA,
      sentencesB: sentencesDiff,
    });
    assert.equal(
      differed.clauseDrift.find(r => r.from === '2.1.3')?.text,
      'differed',
    );
    // Without payloads the row still reports — structural only.
    const none = diff(DRIFT_A, DRIFT_B);
    assert.equal(
      none.clauseDrift.find(r => r.from === '2.1.3')?.text,
      'unavailable',
    );
  });
});

describe('edition-comparison report', () => {
  it('is tier-annotated and carries the clause-drift table', () => {
    const d = diff(BASE, BASE.replace('clause "2.7.1"', 'clause "2.7.2"'));
    const report = formatDiffReport(d);
    assert.match(report, /primmel diff:/);
    assert.match(report, /by tier:/);
    assert.match(report, /secondary/);
    assert.match(report, /clause drift:/);
    assert.match(
      report,
      /urn:oiml:pub:r:60-2\s+2\.7\.1\s+2\.7\.2\s+renumbered/,
    );
    assert.match(report, /\/conf\/mpe-test/);
  });

  it('flags the same package at two versions as an edition comparison', () => {
    const a = load('');
    const b = load('');
    a.packageManifest = {
      id: 'oiml-r60',
      title: '',
      version: '2017',
      editions: ['2021', '2017'],
      baseUrn: 'urn:oiml:pub:r:60:2017',
      extends: '',
      description: '',
      source: null,
    };
    b.packageManifest = {
      ...a.packageManifest,
      version: '2021',
      baseUrn: 'urn:oiml:pub:r:60:2021',
    };
    const d = diffStandards(a, b);
    assert.equal(d.editionComparison, true);
    assert.match(
      formatDiffReport(d),
      /edition comparison — oiml-r60@2017 → oiml-r60@2021/,
    );
  });
});

describe('package-dir diff — file layout is not model identity', () => {
  it('the same model in different file layouts diffs EMPTY (no-op proof)', () => {
    const a = mkdtempSync(join(tmpdir(), 'primmel-diff-a-'));
    const b = mkdtempSync(join(tmpdir(), 'primmel-diff-b-'));
    for (const dir of [a, b]) {
      writeFileSync(
        join(dir, 'package.primmel'),
        `package { id probe version "1" editions { 1 } baseUrn "urn:probe:1" description "probe" }`,
      );
    }
    // Layout A: one file. Layout B: the same model across nested dirs.
    mkdirSync(join(a, 'specification'));
    writeFileSync(join(a, 'specification', 'all.prl'), BASE);
    mkdirSync(join(b, 'specification', 'requirements'), { recursive: true });
    mkdirSync(join(b, 'specification', 'conformance'));
    const [req, test, calc] = BASE.split('\n}\n').filter(p => p.trim());
    writeFileSync(
      join(b, 'specification', 'requirements', 'mpe.prl'),
      req + '\n}\n',
    );
    writeFileSync(
      join(b, 'specification', 'conformance', 'mpe.prl'),
      test + '\n}\n',
    );
    writeFileSync(join(b, 'specification', 'v.prl'), calc + '\n}\n');
    const { diff: d } = diffPackageDirs(a, b);
    assert.equal(d.empty, true);
    assert.equal(d.unchanged, 3);
    assert.equal(d.editionComparison, false);
  });
});

describe('element index', () => {
  it('keys elements by kind:id and assigns tiers', () => {
    const idx = elementIndex(load(BASE));
    assert.ok(idx.has('requirements:/req/metrological/mpe'));
    assert.ok(idx.has('conformanceTests:/conf/mpe-test'));
    assert.ok(idx.has('calculations:vMin'));
    assert.equal(
      idx.get('requirements:/req/metrological/mpe')?.tier,
      'secondary',
    );
    assert.equal(
      idx.get('conformanceTests:/conf/mpe-test')?.provenance[0].basis,
      'urn:oiml:pub:r:60-2',
    );
  });

  it('passports are diff elements (tertiary, beside monitors) — TODO.roadmap/35', () => {
    // The TIER_BY_FIELD registration pin: elementIndex iterates the table
    // keys only, so an unregistered first-class collection is silently
    // invisible to `primmel diff`. Two models differing ONLY in a
    // passport produce exactly the passport diff elements; an unchanged
    // passport produces none.
    const PASSPORT = `
passport lc500_passport {
  upi { pattern upi:acme:lc500 level model }
  public { identity composition promises_as_verified }
  authority { live_compliance_status }
}
`;
    const idx = elementIndex(load(PASSPORT));
    assert.equal(idx.size, 1);
    assert.ok(idx.has('passports:lc500_passport'));
    assert.equal(idx.get('passports:lc500_passport')?.tier, 'tertiary');

    const added = diff(BASE, BASE + PASSPORT);
    assert.equal(added.added.length, 1);
    assert.deepEqual(
      added.added.map(e => `${e.kind}:${e.id}:${e.tier}`),
      ['passports:lc500_passport:tertiary'],
    );
    const removed = diff(BASE + PASSPORT, BASE);
    assert.equal(removed.removed.length, 1);
    assert.equal(removed.removed[0].kind, 'passports');
    const changed = diff(
      BASE + PASSPORT,
      BASE + PASSPORT.replace('level model', 'level batch'),
    );
    assert.equal(changed.changed.length, 1);
    assert.equal(changed.changed[0].kind, 'passports');
    // An unchanged passport produces no diff elements.
    const noop = diff(BASE + PASSPORT, BASE + PASSPORT);
    assert.equal(noop.empty, true);
    assert.equal(noop.unchanged, 4);
  });

  it('invariants are diff elements (cross-cutting, beside notes) — smart gap-close E9', () => {
    // The TIER_BY_FIELD registration pin: elementIndex iterates the table
    // keys only, so an unregistered first-class collection is silently
    // invisible to `primmel diff`. Two models differing ONLY in an
    // invariant produce exactly the invariant diff elements; an unchanged
    // invariant produces none.
    const INVARIANT = `
invariant INV-1 {
  name "No bare numbers"
  statement "every physical quantity is a QuantityValue (value + unit [+ uncertainty])."
  severity error
  applies_to { QuantityValue }
  source "docs/oiml-core/09-invariants.md#9.2"
  enforcement { kernel:C32 linker:quantity-coherence gate:schema-quantity-value }
}
`;
    const idx = elementIndex(load(INVARIANT));
    assert.equal(idx.size, 1);
    assert.ok(idx.has('invariants:INV-1'));
    assert.equal(idx.get('invariants:INV-1')?.tier, 'cross-cutting');

    const added = diff(BASE, BASE + INVARIANT);
    assert.equal(added.added.length, 1);
    assert.deepEqual(
      added.added.map(e => `${e.kind}:${e.id}:${e.tier}`),
      ['invariants:INV-1:cross-cutting'],
    );
    const removed = diff(BASE + INVARIANT, BASE);
    assert.equal(removed.removed.length, 1);
    assert.equal(removed.removed[0].kind, 'invariants');
    const changed = diff(
      BASE + INVARIANT,
      BASE + INVARIANT.replace('severity error', 'severity warning'),
    );
    assert.equal(changed.changed.length, 1);
    assert.equal(changed.changed[0].kind, 'invariants');
    // A statement change classifies as statement, nothing else.
    const reworded = diff(
      BASE + INVARIANT,
      BASE +
        INVARIANT.replace('every physical quantity', 'each physical quantity'),
    );
    assert.equal(reworded.changed.length, 1);
    assert.deepEqual(reworded.changed[0].aspects, ['statement']);
    // An unchanged invariant produces no diff elements.
    const noop = diff(BASE + INVARIANT, BASE + INVARIANT);
    assert.equal(noop.empty, true);
    assert.equal(noop.unchanged, 4);
  });

  it('a duplicate kind:id is collected and surfaces as a diff warning', () => {
    // Duplicate ids are a data error (the duplicate-id linter owns them) —
    // but a diff over an UNLINTED package must not stay silent: the last
    // declaration wins the slot and the report carries the warning. The
    // parser itself collapses duplicate declarations (last wins, reported
    // as parse issues), so the duplicate is seeded at the Standard level —
    // the shape a programmatically assembled/merged model can carry.
    const dupStd = load(BASE);
    (dupStd.requirements as unknown[]).push({
      id: '/req/metrological/mpe',
      name: 'Duplicate declaration',
    });
    const keys: string[] = [];
    elementIndex(dupStd, keys);
    assert.deepEqual(keys, ['requirements:/req/metrological/mpe']);
    const d = diffStandards(dupStd, dupStd);
    assert.equal(d.empty, true); // a warning is not a model change
    assert.equal(d.warnings.length, 2); // both sides flagged
    assert.match(
      d.warnings[0],
      /duplicate element requirements:\/req\/metrological\/mpe/,
    );
    assert.match(formatDiffReport(d), /warnings:/);
  });
});
