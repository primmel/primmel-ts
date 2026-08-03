// ─────────────────────────────────────────────────────────────────────
// The edition-transition worked example (TODO.integration/16 —
// TODO.v3/04's doctrine): a new edition is an ENTIRELY NEW model with
// node relationships back to its predecessor; an implementation model
// ADDS references to the new edition to declare compliance (evidence
// accrues, the old claim never mutates).
//
//   fixtures/edition-transition/
//     r60-demo-2021/   the fictional 2021 baseline (a full small model)
//     r60-demo-2027/   the 2027 successor (supersedes the baseline;
//                      three honest changes)
//     acme-dlc/        the demo product mapping to BOTH editions (two
//                      map_profiles — compliance-as-references)
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { loadPackageWithIssues } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const FIXTURE = join(__dirname, 'fixtures', 'edition-transition');
const CLI = join(__dirname, '..', 'scripts', 'check.mts');

describe('the edition pair (each an ENTIRELY NEW model, linked back)', () => {
  it('both editions load and lint clean', () => {
    for (const pkg of ['r60-demo-2021', 'r60-demo-2027']) {
      const { issues } = loadPackageWithIssues(join(FIXTURE, pkg));
      assert.deepEqual(issues.filter(i => i.severity === 'error'), [], pkg);
      assert.deepEqual(
        checkPackage(join(FIXTURE, pkg)).filter(i => i.severity === 'error'),
        [],
        pkg,
      );
    }
  });

  it('the successor declares the supersedes link (the node relationship back)', () => {
    const { standard } = loadPackageWithIssues(join(FIXTURE, 'r60-demo-2027'));
    const m = standard.packageManifest!;
    assert.deepEqual(m.supersedes, ['urn:oiml:pub:r:60-demo:2021']);
    // The edition register carries BOTH editions (the C79 register
    // discipline) and the version is the newest (C77).
    assert.deepEqual(m.editions, ['2027', '2021']);
    assert.equal(m.version, '2027');
  });

  it('the supersedes graph is acyclic (C79 — the baseline supersedes nothing)', () => {
    const { standard } = loadPackageWithIssues(join(FIXTURE, 'r60-demo-2021'));
    assert.deepEqual(standard.packageManifest!.supersedes ?? [], []);
  });
});

describe('compliance-as-references (the demo product maps to BOTH editions)', () => {
  it('two map_profiles load independently — the edition lenses never merge', () => {
    const { standard, issues } = loadPackageWithIssues(join(FIXTURE, 'acme-dlc'));
    assert.deepEqual(issues.filter(i => i.severity === 'error'), []);
    const profiles = standard.mapProfiles ?? [];
    assert.deepEqual(profiles.map(p => p.namespace).sort(), ['oiml-r60-demo-2021', 'oiml-r60-demo-2027']);
    // Each profile's pairs are ITS OWN (the 2021 profile pairs to the
    // 2021 aliases; the 2027 profile pairs to the 2027 aliases incl.
    // the ADDED warm-up-record) — no shared, no merged pair set.
    const byNs = new Map(profiles.map(p => [p.namespace, p]));
    const p21 = byNs.get('oiml-r60-demo-2021')!;
    const p27 = byNs.get('oiml-r60-demo-2027')!;
    const targetsOf = (p: typeof p21) =>
      Object.values(p.mappings).flat().map((m: { target: string }) => m.target).sort();
    assert.deepEqual(targetsOf(p21), [
      'oiml-r60-demo-2021#/req/metrological/measuring-range-max',
      'oiml-r60-demo-2021#/req/metrological/measuring-range-min',
      'oiml-r60-demo-2021#/req/metrological/zero-return',
      'oiml-r60-demo-2021#/req/technical/warm-up-time',
    ]);
    assert.deepEqual(targetsOf(p27), [
      'oiml-r60-demo-2027#/req/metrological/measuring-range-max',
      'oiml-r60-demo-2027#/req/metrological/measuring-range-min',
      'oiml-r60-demo-2027#/req/metrological/zero-return',
      'oiml-r60-demo-2027#/req/technical/warm-up-record',
      'oiml-r60-demo-2027#/req/technical/warm-up-time',
    ]);
  });

  it('the product lints clean as a product_reference (mapping only, no import)', () => {
    assert.deepEqual(
      checkPackage(join(FIXTURE, 'acme-dlc')).filter(i => i.severity === 'error'),
      [],
    );
  });
});

describe('the edition diff (the drift, printed and pinned)', () => {
  it('primmel diff prints the worked pair\'s drift exactly', { timeout: 120_000 }, () => {
    const out = execFileSync(
      'npx',
      ['tsx', CLI, 'diff', join(FIXTURE, 'r60-demo-2021'), join(FIXTURE, 'r60-demo-2027')],
      { encoding: 'utf-8' },
    );
    // The headline: +2 added, 0 removed, ~4 changed, 0 moved.
    assert.match(out, /elements: \+2 -0 ~4 >0 \(8 unchanged\)/);
    // The ADDED clause and its attribute.
    assert.match(out, /\+ \[primary\/attributeDefinitions\] warm_up_recorded/);
    assert.match(out, /\+ \[secondary\/requirements\] \/req\/technical\/warm-up-record/);
    // The CHANGED clauses (the tightened tolerance + the revised
    // warm-up clause + the attribute definition + the subject shape).
    assert.match(out, /~ \[secondary\/requirements\] \/req\/metrological\/zero-return — statement/);
    assert.match(out, /~ \[secondary\/requirements\] \/req\/technical\/warm-up-time — statement/);
    assert.match(out, /~ \[primary\/attributeDefinitions\] warm_up_time — statement/);
    assert.match(out, /~ \[primary\/subjects\] DemoLoadCell — structure/);
  });
});
