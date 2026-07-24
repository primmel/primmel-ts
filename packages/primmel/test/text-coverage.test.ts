// ─────────────────────────────────────────────────────────────────────
// TODO.roadmap/26 — the normative-text coverage metric (text-coverage.ts):
//   C71 text-coverage-sentence-uncovered (audit, budgeted)
//   C72 text-coverage-budget (audit)
//   C73 text-coverage-config (all levels)
// plus the --coverage report, the allowance semantics (prefix + pinned),
// the duplicate-pair flagging/adjudication, and the sentence-level
// binding surface (source { doc clause fragment "s1" }).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkPackage, type CheckOptions } from '../src/check';
import {
  allowanceAddressMatches,
  allowanceMatches,
  computeTextCoverage,
  containmentSimilarity,
  formatTextCoverageReport,
  loadTextCoverageData,
  normalizeBinding,
  normalizeForSimilarity,
  packageTextCoverageReport,
  type CoverageConfigJson,
  type SentencesManifest,
} from '../src/text-coverage';
import { loadPackageWithIssues } from '../src/ser-des/package';

function makeTmpPackage(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-tcov-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

const checked = (
  files: Record<string, string>,
  options: CheckOptions = {},
): ReturnType<typeof checkPackage> => {
  const dir = makeTmpPackage(files);
  try {
    return checkPackage(dir, options);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const URN = 'urn:oiml:pub:r:60-1:2021';

function manifest(sentences: Array<Partial<SentencesManifest['sentences'][number]> & { address: string; fragment: string; modality: 'normative' | 'informative'; text: string }>): string {
  const m: SentencesManifest = {
    prd_sentences: '0.1.0',
    document: { urn: URN, short: 'T 60-1', part: '1' },
    sentences: sentences.map(s => ({
      kind: 'provision',
      fragment_normative: true,
      ...s,
    })) as SentencesManifest['sentences'],
  };
  return JSON.stringify(m, null, 2);
}

function coverageJson(config: Partial<CoverageConfigJson>): string {
  return JSON.stringify({ prd_coverage: '0.1.0', ...config }, null, 2);
}

/** A small seeded document: clause-2.2 (2 sentences, one normative), clause-5.3.2
 * (2 normative), clause-2.12.1 (2 normative), a note (informative modal). */
const SEEDED_MANIFEST = manifest([
  { address: 'clause-2.2/s1', fragment: 'clause-2.2', modality: 'normative', text: 'Several measurement errors shall be considered together in the error envelope.' },
  { address: 'clause-2.2/s2', fragment: 'clause-2.2', modality: 'informative', text: 'The envelope balances the individual contributions.' },
  { address: 'clause-5.3.2/s1', fragment: 'clause-5.3.2', modality: 'normative', text: 'The error of any load cell shall not exceed the maximum permissible error.' },
  { address: 'clause-5.3.2/s2', fragment: 'clause-5.3.2', modality: 'normative', text: 'The apportioning factor shall be in the range 0.3 to 0.8.' },
  { address: 'clause-2.12.1/s1', fragment: 'clause-2.12.1', modality: 'normative', text: 'The certificate shall be prepared according to OIML B 18.' },
  { address: 'clause-2.12.1/s2', fragment: 'clause-2.12.1', modality: 'normative', text: 'The template shall be supplemented with the Annex B information.' },
  { address: 'clause-2.2/note-1/s1', fragment: 'clause-2.2/note-1', kind: 'note', fragment_normative: false, modality: 'informative', text: 'The envelope may be defined as the boundary.' },
]);

const REQ_MPE = `requirement /req/mpe {
  binds_to { model.parameters.e_max }
  statement "The error of any load cell shall not exceed the maximum permissible error on type evaluation"
  source { doc "${URN}" clause "5.3.2" }
}
instrument T {
  dimension accuracy_class { scope group values { A B } }
}
attribute_definition e_max {
  symbol "E_max" origin design-fixed scope model unit t quantity_kind mass
}
`;

// ── unit: binding normalization ──────────────────────────────────────

describe('normalizeBinding (TODO.roadmap/26)', () => {
  it('normalizes the doc/clause/fragment shapes', () => {
    assert.deepEqual(normalizeBinding(URN, '5.3.2'), { doc: URN, fragmentPath: 'clause-5.3.2' });
    assert.deepEqual(normalizeBinding(URN, 'table-4'), { doc: URN, fragmentPath: 'table-4' });
    assert.deepEqual(normalizeBinding(`${URN}#table-4`, ''), { doc: URN, fragmentPath: 'table-4' });
    assert.deepEqual(normalizeBinding(URN, '2.2', 's1'), { doc: URN, fragmentPath: 'clause-2.2/s1' });
    assert.equal(normalizeBinding(URN, ''), null);
  });
});

// ── unit: allowance matching ─────────────────────────────────────────

describe('allowance matching (TODO.roadmap/26)', () => {
  it('boundary-matches clause prefixes (not string prefixes)', () => {
    assert.ok(allowanceAddressMatches(`${URN}#clause-2.12`, `${URN}#clause-2.12.1/s1`));
    assert.ok(allowanceAddressMatches(`${URN}#clause-2.12.1`, `${URN}#clause-2.12.1/s1`));
    assert.ok(!allowanceAddressMatches(`${URN}#clause-2.1`, `${URN}#clause-2.12.1/s1`));
    assert.ok(!allowanceAddressMatches(`${URN}#clause-2.12.2`, `${URN}#clause-2.12.1/s1`));
  });

  it('pins discharge exactly the pinned sentences', () => {
    const sentences = JSON.parse(SEEDED_MANIFEST).sentences;
    const matched = allowanceMatches(
      { address: `${URN}#clause-2.12.1`, sentences: ['s2'], reason: 'x' },
      sentences,
      URN,
    );
    assert.deepEqual(matched.map(s => s.address), ['clause-2.12.1/s2']);
  });
});

// ── unit: similarity ─────────────────────────────────────────────────

describe('containment similarity (TODO.roadmap/26)', () => {
  it('is 1 for identical texts and containment-weighted otherwise', () => {
    const a = normalizeForSimilarity('The error shall not exceed the MPE.');
    const b = normalizeForSimilarity('the error shall not exceed the mpe');
    assert.equal(containmentSimilarity(a, b), 1);
    const c = normalizeForSimilarity('The error shall not exceed the MPE for class A load cells.');
    assert.ok(containmentSimilarity(a, c) >= 0.8);
    const d = normalizeForSimilarity('Creep recovery differs fundamentally from hysteresis.');
    assert.ok(containmentSimilarity(a, d) < 0.5);
  });
});

// ── the metric over a seeded package ─────────────────────────────────

describe('text coverage in primmel check (TODO.roadmap/26)', () => {
  it('is silent without sources-prd payloads', () => {
    const issues = checked({ 'm.prl': REQ_MPE }, { strictness: 'audit' });
    assert.equal(issues.filter(i => i.check === 'C71' || i.check === 'C73').length, 0);
  });

  it('reports uncovered normative sentences as C71 at --audit, never at the default level', () => {
    const files = { 'm.prl': REQ_MPE, 'sources-prd/r60-1.sentences.json': SEEDED_MANIFEST };
    const auditIssues = checked(files, { strictness: 'audit' });
    const c71 = auditIssues.filter(i => i.check === 'C71');
    // clause-5.3.2 is bound (2 sentences covered); clause-2.2/s1, 2.12.1/s1, 2.12.1/s2 uncovered
    assert.equal(c71.length, 3);
    assert.ok(c71.every(i => i.severity === 'warning'));
    assert.ok(c71[0].message.includes(`${URN}#clause-2.2/s1`));
    assert.ok(c71.some(i => i.message.includes('"The certificate shall be prepared')));
    const normalIssues = checked(files);
    assert.equal(normalIssues.filter(i => i.check === 'C71').length, 0);
  });

  it('a sentence-level binding covers exactly the bound sentence (source … fragment "s1")', () => {    const req = `requirement /req/envelope {
  binds_to { model.parameters.e_max }
  statement "The error envelope considers several measurement errors together"
  source { doc "${URN}" clause "2.2" fragment "s1" }
  source { doc "${URN}" clause "5.3.2" }
}
instrument T {
  dimension accuracy_class { scope group values { A B } }
}
attribute_definition e_max {
  symbol "E_max" origin design-fixed scope model unit t quantity_kind mass
}
`;
    const issues = checked(
      { 'm.prl': req, 'sources-prd/r60-1.sentences.json': SEEDED_MANIFEST },
      { strictness: 'audit' },
    );
    const c71 = issues.filter(i => i.check === 'C71');
    assert.equal(c71.length, 2); // only the 2.12.1 pair remains
    assert.ok(c71.every(i => i.message.includes('clause-2.12.1')));
  });

  it('allowances discharge uncovered sentences (reported, not gated)', () => {
    const files = {
      'm.prl': REQ_MPE,
      'sources-prd/r60-1.sentences.json': SEEDED_MANIFEST,
      'sources-prd/coverage.json': coverageJson({
        allowances: [
          { address: `${URN}#clause-2.2`, sentences: ['s1'], reason: 'error-envelope principle prose' },
          { address: `${URN}#clause-2.12.1`, reason: 'certificate surface modelled YAML-side' },
        ],
      }),
    };
    const issues = checked(files, { strictness: 'audit' });
    assert.equal(issues.filter(i => i.check === 'C71').length, 0);
    assert.equal(issues.filter(i => i.check === 'C73').length, 0);
  });

  it('C73: an allowance matching no sentence is STALE', () => {
    const files = {
      'm.prl': REQ_MPE,
      'sources-prd/r60-1.sentences.json': SEEDED_MANIFEST,
      'sources-prd/coverage.json': coverageJson({
        allowances: [{ address: `${URN}#clause-2.12.1`, sentences: ['s9'], reason: 'drifted pin' }],
      }),
    };
    const issues = checked(files);
    const c73 = issues.filter(i => i.check === 'C73');
    assert.equal(c73.length, 1);
    assert.ok(c73[0].message.includes('matches no sentence'));
  });

  it('C73: an allowance whose matched sentences are all informative is STALE', () => {
    const files = {
      'm.prl': REQ_MPE,
      'sources-prd/r60-1.sentences.json': SEEDED_MANIFEST,
      'sources-prd/coverage.json': coverageJson({
        allowances: [{ address: `${URN}#clause-2.2/note-1`, reason: 'a note needs no allowance' }],
      }),
    };
    const issues = checked(files);
    const c73 = issues.filter(i => i.check === 'C73');
    assert.equal(c73.length, 1);
    assert.ok(c73[0].message.includes('informative'));
  });

  it('C73: an allowance whose matched normative sentences are all bound is STALE (dead)', () => {
    // REQ_MPE binds clause-5.3.2, so both its normative sentences are
    // covered — an allowance for the same fragment discharges nothing.
    const files = {
      'm.prl': REQ_MPE,
      'sources-prd/r60-1.sentences.json': SEEDED_MANIFEST,
      'sources-prd/coverage.json': coverageJson({
        allowances: [{ address: `${URN}#clause-5.3.2`, reason: 'outlived its condition' }],
      }),
    };
    const issues = checked(files);
    const c73 = issues.filter(i => i.check === 'C73');
    assert.equal(c73.length, 1);
    assert.equal(c73[0].severity, 'error');
    assert.ok(c73[0].message.includes('discharges nothing'));
    // a live allowance (≥1 matched sentence still unbound) stays silent
    const live = checked({
      ...files,
      'sources-prd/coverage.json': coverageJson({
        allowances: [{ address: `${URN}#clause-2.12.1`, reason: 'certificate surface modelled YAML-side' }],
      }),
    });
    assert.equal(live.filter(i => i.check === 'C73').length, 0);
  });

  it('C73: malformed payloads are config errors at the default level', () => {
    const issues = checked({
      'm.prl': REQ_MPE,
      'sources-prd/r60-1.sentences.json': '{ not json',
    });
    assert.ok(issues.some(i => i.check === 'C73' && i.severity === 'error'));
  });

  it('the text_coverage_budget gates regressions (C72) — 0 budget, any uncovered fails', () => {
    const files = {
      'm.prl': REQ_MPE,
      'sources-prd/r60-1.sentences.json': SEEDED_MANIFEST,
      '.primmel-allowlist.prl': 'text_coverage_budget 0 "100 % — any uncovered sentence is a regression"\n',
    };
    const issues = checked(files, { strictness: 'audit' });
    const c72 = issues.filter(i => i.check === 'C72');
    assert.equal(c72.length, 1);
    assert.equal(c72[0].severity, 'error');
    assert.ok(c72[0].message.includes('3 uncovered normative sentences'));
  });

  it('the budget caps C71 exactly (met: quiet; slack: warning; strict keeps budget-covered C71 as warnings)', () => {
    const files = {
      'm.prl': REQ_MPE,
      'sources-prd/r60-1.sentences.json': SEEDED_MANIFEST,
      '.primmel-allowlist.prl': 'text_coverage_budget 3\n',
    };
    const met = checked(files, { strictness: 'audit' });
    assert.equal(met.filter(i => i.check === 'C72').length, 0);
    const slack = checked(
      { ...files, '.primmel-allowlist.prl': 'text_coverage_budget 5\n' },
      { strictness: 'audit' },
    );
    const slackC72 = slack.filter(i => i.check === 'C72');
    assert.equal(slackC72.length, 1);
    assert.equal(slackC72[0].severity, 'warning');
    const strict = checked(files, { strictness: 'audit', strict: true });
    // budget-covered C71s stay warnings under --strict (the budget is their allowance)
    assert.equal(strict.filter(i => i.check === 'C71' && i.severity === 'error').length, 0);
    assert.equal(strict.filter(i => i.check === 'C72').length, 0);
  });

  it('duplicate pairs are flagged, adjudicated, and go STALE when unflagged — never auto-failed', () => {
    const dup = `requirement /req/mpe {
  binds_to { model.parameters.e_max }
  statement "The error of any load cell shall not exceed the maximum permissible error on type evaluation"
  source { doc "${URN}" clause "5.3.2" }
}
requirement /req/mpe-copy {
  binds_to { model.parameters.e_max }
  statement "The error of any load cell shall not exceed the maximum permissible error on type evaluation"
  source { doc "${URN}" clause "5.3.2" }
}
instrument T {
  dimension accuracy_class { scope group values { A B } }
}
attribute_definition e_max {
  symbol "E_max" origin design-fixed scope model unit t quantity_kind mass
}
`;
    const files = { 'm.prl': dup, 'sources-prd/r60-1.sentences.json': SEEDED_MANIFEST };
    // unresolved pair: reported, never an issue (never auto-fails)
    const issues = checked(files, { strictness: 'audit' });
    assert.equal(issues.filter(i => i.check === 'C73' && i.message.includes('adjudication')).length, 0);
    // adjudicated: resolved; stale adjudication: C73
    const withAdjudication = checked(
      {
        ...files,
        'sources-prd/coverage.json': coverageJson({
          duplicate_adjudications: [
            { elements: ['/req/mpe', '/req/mpe-copy'], verdict: 'merge-planned', reason: 'seeded copy' },
            { elements: ['/req/ghost-a', '/req/ghost-b'], verdict: 'distinct', reason: 'not flagged' },
          ],
        }),
      },
      { strictness: 'audit' },
    );
    const c73 = withAdjudication.filter(i => i.check === 'C73');
    assert.equal(c73.length, 1);
    assert.ok(c73[0].message.includes('ghost'));
    assert.ok(c73[0].message.includes('STALE'));
  });

  it('the report computes ratios with and without allowances + duplicate status', () => {
    const dir = makeTmpPackage({
      'm.prl': REQ_MPE,
      'sources-prd/r60-1.sentences.json': SEEDED_MANIFEST,
      'sources-prd/coverage.json': coverageJson({
        allowances: [{ address: `${URN}#clause-2.12.1`, reason: 'certificate surface' }],
      }),
    });
    try {
      const report = packageTextCoverageReport(dir, d => loadPackageWithIssues(d));
      assert.ok(report);
      const doc = report.documents[0];
      assert.equal(doc.normative, 5);
      assert.equal(doc.covered, 2);
      assert.equal(doc.allowed, 2);
      assert.equal(doc.uncoveredCounted.length, 1); // clause-2.2/s1
      assert.equal(doc.ratio.toFixed(3), (2 / 5).toFixed(3));
      assert.equal(doc.ratioGated.toFixed(3), (2 / 3).toFixed(3));
      const text = formatTextCoverageReport(report);
      assert.ok(text.includes('duplicate pairs: 0 flagged'));
      assert.ok(text.includes('informative uncovered'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('condition sets cover every repeated source block (the sources-plural surface)', () => {
    const cond = `condition_set reference-conditions {
  role reference
  subject T
  entries {
    temperature { value 20 unit "degC" }
  }
  source { doc "${URN}" clause "2.12.1" }
  source { doc "${URN}" clause "2.2" }
}
instrument T {
  dimension accuracy_class { scope group values { A B } }
}
`;
    const issues = checked(
      { 'm.prl': cond, 'sources-prd/r60-1.sentences.json': SEEDED_MANIFEST },
      { strictness: 'audit' },
    );
    const c71 = issues.filter(i => i.check === 'C71');
    // clause-2.12.1 (both sentences) + clause-2.2/s1 covered by the set's sources
    assert.equal(c71.length, 2);
    assert.ok(c71.every(i => i.message.includes('clause-5.3.2')));
  });

  it('form reference blocks (formReferences / fieldReferences) bind their clauses', () => {
    const form = `form sec-4.9.1 {
  name "General information"
  data_class FormInstance#data
  references {
    report-format { "${URN}#clause-2.12.1" }
  }
  field manufacturer_name : string {
    label "Manufacturer"
    bind manufacturer.legal_name
    references {
      requirement { "${URN}#clause-2.2" }
    }
  }
}
`;
    const issues = checked(
      { 'm.prl': form, 'sources-prd/r60-1.sentences.json': SEEDED_MANIFEST },
      { strictness: 'audit' },
    );
    const c71 = issues.filter(i => i.check === 'C71');
    // the form covers clause-2.12.1 (form-level) + clause-2.2/s1 (field-level)
    assert.equal(c71.length, 2);
    assert.ok(c71.every(i => i.message.includes('clause-5.3.2')));
  });
});

// ── the CLI --coverage flag ──────────────────────────────────────────

describe('primmel check --coverage (TODO.roadmap/26)', () => {
  it('prints the report; silent without payloads', () => {
    const dir = makeTmpPackage({
      'm.prl': REQ_MPE,
      'sources-prd/r60-1.sentences.json': SEEDED_MANIFEST,
      'sources-prd/coverage.json': coverageJson({
        allowances: [{ address: `${URN}#clause-2.12.1`, reason: 'certificate surface' }],
      }),
    });
    const bare = makeTmpPackage({ 'm.prl': REQ_MPE });
    try {
      const out = execFileSync(
        'npx',
        ['tsx', join(__dirname, '..', 'scripts', 'check.mts'), '--audit', '--coverage', dir],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      assert.ok(out.includes('normative-text coverage'));
      assert.ok(out.includes('Allowed exclusions'));
      const silent = execFileSync(
        'npx',
        ['tsx', join(__dirname, '..', 'scripts', 'check.mts'), '--coverage', bare],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      assert.ok(silent.includes('no sources-prd payloads'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(bare, { recursive: true, force: true });
    }
  });
});
