// ─────────────────────────────────────────────────────────────────────
// Retrieval export tests (primmel/primmel-ts#65 — the AI-native
// retrieval projection): the contract core. The legs pin, each against
// the fixture package and the real R 60 corpus package:
//
//   ask 1 — clause URNs first-class: every edge is { doc, clause, urn }
//     on the DOCUMENT's own numbering; a producer-internal UUID anchor
//     is demoted to the optional `anchor` extra whether it arrives in
//     the doc-fragment slot or the clause slot, and a non-clause
//     fragment (#table-2) rides as a citable anchor; the stats count
//     the anchor-only debt.
//   ask 2 — edition semantics: `edition` (the publication edition) and
//     `model_version` (the package's own version) are distinct fields
//     that never borrow each other's value (the fixture declares
//     version "2" against editions { 2021 2017 } — the observed drift).
//   ask 3 — the flat retrieval facet: every unit carries one flat
//     scalar map (string values only) keyed congruent with the
//     consumer's chunk wire schema, the applicability dimensions
//     flattened to `app_<dim>` keys, the whole shape versioned as
//     `retrieval-facet/1` — and EXCLUDED from the content_hash input
//     (a derived projection, never authored content).
//   ask 4 — stable ids + digests: ids are the package-authored
//     identifiers; a display-text rename moves the content_hash, never
//     the id (identity = id, currency = digest); the digest recomputes
//     from the shipped unit with the documented canonical form.
//   ask 6 — the machine passport: every unit carries the compact
//     digest (kind, text, expression, units, applicability, acceptance,
//     provenance URNs, content hash) with a canonical serialized form.
//   ask 7 — language-tagged variants: every unit carries `language`
//     (the package default spelling, tagging the inline prose) and
//     `variants` (the package's text blocks resolved by the C89
//     longest-prefix address rule onto the KERNEL element id, keyed by
//     field path) — authored content, digest-participating; blocks
//     addressed at unprojected elements are counted, never dropped
//     silently.
//
// Plus the bundle-level contract: the projection version, byte
// determinism, and the source_hash algorithm (the deployed consumer's
// derive-model-plane.ts byte-for-byte).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RETRIEVAL_FACET_VERSION,
  RETRIEVAL_PROJECTION,
  canonicalJson,
  exportPackageRetrieval,
  exportStandardRetrieval,
  normalizeClause,
  packageEdition,
  packageSourceHash,
  passportCanonical,
  resolveTextAddress,
  retrievalDigest,
  retrievalDocParts,
  type RetrievalUnit,
} from '../src/export/retrieval';
import { buildRetrievalFixturePackage } from './helpers/retrieval';
import { loadPackage } from '../src/ser-des';
import { R60, R60_AVAILABLE, R60_SKIP } from './helpers/corpus';

if (!R60_AVAILABLE) {
  console.log(`retrieval-export.test.ts: skipping the R 60 leg — ${R60_SKIP}`);
}

/** The units of a fresh fixture export, indexed by id. */
function fixtureUnits(): {
  units: Map<string, RetrievalUnit>;
  doc: ReturnType<typeof exportPackageRetrieval>['document'];
  stats: ReturnType<typeof exportPackageRetrieval>['stats'];
} {
  const result = exportPackageRetrieval(buildRetrievalFixturePackage());
  return {
    units: new Map(result.document.units.map(u => [u.id, u])),
    doc: result.document,
    stats: result.stats,
  };
}

describe('retrieval export — the document block (ask 2)', () => {
  it('exposes edition and model_version as distinct stable fields', () => {
    const { doc } = fixtureUnits();
    assert.equal(doc.projection, RETRIEVAL_PROJECTION);
    // The fixture's drift: version "2" (the package's own version)
    // against editions { 2021 2017 } (the publication editions).
    assert.equal(doc.package.edition, '2021');
    assert.equal(doc.package.model_version, '2');
    assert.deepEqual(doc.package.editions, ['2021', '2017']);
    assert.equal(doc.package.base_urn, 'urn:test:r:9:2021');
    assert.equal(doc.package.id, 'test-retrieval');
    assert.equal(doc.package.kind, 'rec');
    assert.equal(doc.package.status, 'current');
    assert.equal(doc.package.default_spelling, 'eng-Latn');
    assert.deepEqual(doc.package.supersedes, ['urn:test:r:9:2017']);
  });

  it('derives the edition from the newest register entry, the baseUrn as fallback', () => {
    assert.equal(
      packageEdition({
        editions: ['2021', '2017'],
        baseUrn: 'urn:test:r:9:2021',
      } as never),
      '2021',
    );
    // No register: the baseUrn's trailing year segment is the edition.
    assert.equal(
      packageEdition({ editions: [], baseUrn: 'urn:test:r:9:2017' } as never),
      '2017',
    );
    // Neither: empty, never a borrow from the version field.
    assert.equal(packageEdition({ editions: [], baseUrn: '' } as never), '');
  });

  it('carries the package-byte source_hash (the consumer pin key)', () => {
    const dir = buildRetrievalFixturePackage();
    const result = exportPackageRetrieval(dir);
    assert.equal(result.document.source_hash, packageSourceHash(dir));
    // The deployed algorithm: sha256 over the sorted walk, path + NUL +
    // file-digest + LF — a byte change anywhere moves it.
    writeFileSync(
      join(dir, 'terminology.prl'),
      readFileSync(join(dir, 'terminology.prl'), 'utf8') + '\n# a comment\n',
    );
    assert.notEqual(packageSourceHash(dir), result.document.source_hash);
  });

  it('is byte-deterministic: two exports of one package agree byte-for-byte', () => {
    const dir = buildRetrievalFixturePackage();
    assert.equal(
      exportPackageRetrieval(dir).json,
      exportPackageRetrieval(dir).json,
    );
  });
});

describe('retrieval export — the flat facet (ask 3)', () => {
  /** The scalar-only invariant, asserted recursively (flat by contract). */
  function assertFlatScalar(facet: Record<string, unknown>, id: string): void {
    for (const [k, v] of Object.entries(facet)) {
      assert.equal(
        typeof v,
        'string',
        `${id} facet.${k} is a scalar string (got ${typeof v})`,
      );
    }
  }

  it('versions the facet shape on the document', () => {
    const { doc } = fixtureUnits();
    assert.equal(doc.facet_version, RETRIEVAL_FACET_VERSION);
  });

  it('carries one flat scalar facet per unit, currency keys included', () => {
    const { units } = fixtureUnits();
    for (const unit of units.values()) {
      assert.ok(unit.facet, `${unit.id} carries a facet`);
      assertFlatScalar(unit.facet, unit.id);
      assert.equal(unit.facet.unit_id, unit.id);
      assert.equal(unit.facet.unit_hash, unit.content_hash);
      assert.equal(unit.facet.block, unit.kind);
      // The document fields flatten onto every unit of the package.
      assert.equal(unit.facet.doc_id, 'test-retrieval');
      assert.equal(unit.facet.edition, '2021');
      assert.equal(unit.facet.model_version, '2');
      assert.equal(unit.facet.language, 'eng-Latn');
      assert.equal(unit.facet.status, 'current');
      // The fixture base URN is not an oiml-pub URN: the parsed parts
      // are empty (never invented) and docidentifier falls back to the
      // package title.
      assert.equal(unit.facet.doctype, '');
      assert.equal(unit.facet.doc_number, '');
      assert.equal(unit.facet.docidentifier, 'Retrieval fixture package');
    }
  });

  it('parses the publication URN into the document parts', () => {
    assert.deepEqual(retrievalDocParts('urn:oiml:pub:r:60:2021'), {
      doctype: 'r',
      doc_number: '60',
      year: '2021',
      label: 'OIML R 60:2021',
    });
    // The part-suffixed form the clause URNs carry.
    assert.deepEqual(retrievalDocParts('urn:oiml:pub:r:60-1:2021'), {
      doctype: 'r',
      doc_number: '60-1',
      year: '2021',
      label: 'OIML R 60-1:2021',
    });
    // A year-less URN labels without the edition segment.
    assert.deepEqual(retrievalDocParts('urn:oiml:pub:d:29'), {
      doctype: 'd',
      doc_number: '29',
      year: '',
      label: 'OIML D 29',
    });
    // A non-register URN parses to empty parts, never an invention.
    assert.deepEqual(retrievalDocParts('urn:test:r:9:2021'), {
      doctype: '',
      doc_number: '',
      year: '',
      label: '',
    });
  });

  it('carries the primary clause anchor and title, honestly empty when none', () => {
    const { units } = fixtureUnits();
    // Primary edge: urn:test:r:9-1:2021#clause-5.2 → the clause number.
    assert.equal(units.get('/req/scope/alpha')!.facet.clause_anchor, '5.2');
    assert.equal(units.get('/req/scope/alpha')!.facet.clause_title, 'Alpha');
    // The sentence sub-address stays on the clause edge; the anchor is
    // the bare clause number.
    assert.equal(
      units.get('/conf/scope/alpha-frob')!.facet.clause_anchor,
      '7.1',
    );
    // Anchor-only provenance (the UUID demotion): the clause anchor is
    // empty — NEVER the producer-internal UUID.
    assert.equal(units.get('/req/scope/beta')!.facet.clause_anchor, '');
    // No provenance at all: empty, not a lane marker.
    assert.equal(units.get('/req/orphan')!.facet.clause_anchor, '');
    // A nameless-by-construct unit falls back to its id for the title.
    assert.equal(
      units.get('/state-machine/WidgetOperational')!.facet.clause_title,
      'WidgetOperational',
    );
  });

  it('flattens the applicability dimensions to app_ keys', () => {
    const { units } = fixtureUnits();
    // Existential default: the values join, no _match key rides.
    const alpha = units.get('/req/scope/alpha')!.facet;
    assert.equal(alpha.app_accuracy_class, 'A|C');
    assert.equal(alpha.app_accuracy_class_match, undefined);
    // The declared match mode rides beside the values.
    const beta = units.get('/req/scope/beta')!.facet;
    assert.equal(beta.app_tech, 'analogue|digital');
    assert.equal(beta.app_tech_match, 'all');
    // A unit without applicability carries no app_ keys at all.
    const orphan = units.get('/req/orphan')!.facet;
    assert.deepEqual(
      Object.keys(orphan).filter(k => k.startsWith('app_')),
      [],
    );
  });
});

describe('retrieval export — language-tagged variants (ask 7)', () => {
  it('tags every unit with the package default spelling', () => {
    const { units } = fixtureUnits();
    for (const unit of units.values()) {
      // The INLINE prose values' tag — the same code facet.language
      // carries, on the unit for the agent reading one unit.
      assert.equal(unit.language, 'eng-Latn', `${unit.id} language tag`);
    }
  });

  it('resolves text blocks onto their units, keyed by the field path', () => {
    const { units, stats } = fixtureUnits();
    const alpha = units.get('/req/scope/alpha')!;
    assert.deepEqual(alpha.variants, {
      statement: [
        { spelling: 'fra-Latn', value: 'Le widget doit frobniquer.' },
        {
          spelling: 'zho-Latn',
          via: 'BGN-PCGN:zho-Hans:Latn:1979',
          value: '该小部件应进行frobnicate。',
        },
      ],
    });
    // Kernel-id addressing: the term's text block addresses
    // `frobnicator`, not the namespaced unit id /term/frobnicator.
    const term = units.get('/term/frobnicator')!;
    assert.deepEqual(term.variants, {
      definition: [
        { spelling: 'fra-Latn', value: 'un dispositif qui frobnique' },
      ],
    });
    // A unit no text block addresses carries no variants key.
    assert.equal(units.get('/req/scope/beta')!.variants, undefined);
    // The block addressed at the instrument (registered with C89, not
    // projected as a unit) is counted, never silently dropped.
    assert.equal(stats.withVariants, 2);
    assert.equal(stats.droppedTextBlocks, 1);
  });

  it('resolves the longest registered dot-boundary prefix (the C89 rule)', () => {
    // Element ids may themselves carry dots (r144-3/sec-3.4)…
    const ids = new Set(['/req/a', 'r144-3/sec-3.4', 'a.b']);
    assert.deepEqual(resolveTextAddress('/req/a.statement', ids), {
      elementId: '/req/a',
      path: 'statement',
    });
    assert.deepEqual(resolveTextAddress('r144-3/sec-3.4.guidance', ids), {
      elementId: 'r144-3/sec-3.4',
      path: 'guidance',
    });
    // …and a dotted element id wins over its own prefix (a.b the
    // element, not a + path b.statement).
    assert.deepEqual(resolveTextAddress('a.b.statement', ids), {
      elementId: 'a.b',
      path: 'statement',
    });
    // The nested prose path (gap-close E13) rides whole as the key.
    assert.deepEqual(resolveTextAddress('a.b.fields.indication.label', ids), {
      elementId: 'a.b',
      path: 'fields.indication.label',
    });
    // No registered prefix, or a shapeless address: unresolved.
    assert.equal(resolveTextAddress('nope.statement', ids), null);
    assert.equal(resolveTextAddress('bareid', ids), null);
  });

  it('variants are authored content: a translation change moves the unit digest', () => {
    const dir = buildRetrievalFixturePackage();
    const before = exportPackageRetrieval(dir);
    // Reauthor the French alternate: alpha's content moved…
    writeFileSync(
      join(dir, 'texts.prl'),
      readFileSync(join(dir, 'texts.prl'), 'utf8').replace(
        'Le widget doit frobniquer.',
        'Le widget doit frobniquer doucement.',
      ),
    );
    const after = exportPackageRetrieval(dir);
    const b = before.document.units.find(u => u.id === '/req/scope/alpha')!;
    const a = after.document.units.find(u => u.id === '/req/scope/alpha')!;
    assert.notEqual(a.content_hash, b.content_hash);
    // …identity and every other unit unmoved; the bundle hash moved.
    assert.equal(a.id, b.id);
    const betaB = before.document.units.find(u => u.id === '/req/scope/beta')!;
    const betaA = after.document.units.find(u => u.id === '/req/scope/beta')!;
    assert.equal(betaA.content_hash, betaB.content_hash);
    assert.notEqual(after.document.source_hash, before.document.source_hash);
  });
});

describe('retrieval export — clause URNs first-class (ask 1)', () => {
  it('normalizes derives-from refs onto { doc, clause, urn } edges', () => {
    const { units } = fixtureUnits();
    const alpha = units.get('/req/scope/alpha')!;
    assert.deepEqual(alpha.clause, {
      doc: 'urn:test:r:9-1:2021',
      clause: '5.2',
      urn: 'urn:test:r:9-1:2021#clause-5.2',
    });
    assert.deepEqual(
      alpha.clauses!.map(c => c.urn),
      ['urn:test:r:9-1:2021#clause-5.2', 'urn:test:r:9-1:2021#clause-5.2.1'],
    );
  });

  it('keeps the sentence sub-address on the clause URN', () => {
    const { units } = fixtureUnits();
    const test = units.get('/conf/scope/alpha-frob')!;
    assert.deepEqual(test.clause, {
      doc: 'urn:test:r:9-2:2021',
      clause: '7.1',
      urn: 'urn:test:r:9-2:2021#clause-7.1/s3',
      fragment: 's3',
    });
  });

  it('demotes a UUID in the doc-fragment slot to the anchor extra', () => {
    const { units, stats } = fixtureUnits();
    const beta = units.get('/req/scope/beta')!;
    // The UUID is never the clause; it rides as the optional anchor
    // extra, and the URN degrades to the bare document (a UUID is not
    // citable — presenting it as one is the failure the ask names).
    assert.equal(beta.clause!.clause, '');
    assert.equal(beta.clause!.anchor, '_eb46a3a3-b2c3-4d5e-8f90-a1b2c3d4e5f6');
    assert.equal(beta.clause!.urn, 'urn:test:r:9-1:2021');
    assert.equal(beta.clause!.doc, 'urn:test:r:9-1:2021');
    assert.ok(stats.anchorOnlyProvenance >= 1);
  });

  it('demotes a UUID in the clause slot to the anchor extra', () => {
    const { units } = fixtureUnits();
    const gamma = units.get('/req/scope/gamma')!;
    assert.equal(gamma.clause!.clause, '');
    assert.equal(gamma.clause!.anchor, '_eb46a3a3-b2c3-4d5e-8f90-a1b2c3d4e5f6');
    assert.equal(gamma.clause!.urn, 'urn:test:r:9-1:2021');
  });

  it('keeps a non-clause fragment anchor citable (#table-2)', () => {
    const { units } = fixtureUnits();
    const delta = units.get('/req/scope/delta')!;
    // A table anchor is the document's own anchor naming — citable and
    // diffable, unlike a UUID — so it stays on the URN as the anchor.
    assert.deepEqual(delta.clause, {
      doc: 'urn:test:r:9-1:2021',
      clause: '',
      urn: 'urn:test:r:9-1:2021#table-2',
      anchor: 'table-2',
    });
  });

  it('splits a term source string into one edge per URN', () => {
    const { units } = fixtureUnits();
    const term = units.get('/term/frobnicator')!;
    assert.deepEqual(
      term.clauses!.map(c => c.urn),
      ['urn:test:v:1:2022#clause-4.1', 'urn:test:r:9-1:2021#clause-3.2.1'],
    );
    assert.equal(term.clause!.urn, 'urn:test:v:1:2022#clause-4.1');
  });

  it('falls back to the section on the package base URN when nothing else cites a clause', () => {
    const { units } = fixtureUnits();
    const orphan = units.get('/term/orphan-term')!;
    // The document's own clause numbering (the terminology section),
    // never an internal anchor.
    assert.deepEqual(orphan.clause, {
      doc: 'urn:test:r:9:2021',
      clause: '3.9',
      urn: 'urn:test:r:9:2021#clause-3.9',
    });
  });

  it('leaves a provenance-free unit honestly uncited', () => {
    const { units, stats } = fixtureUnits();
    const orphan = units.get('/req/orphan')!;
    assert.equal(orphan.clause, undefined);
    assert.equal(orphan.clauses, undefined);
    assert.ok(stats.withoutProvenance >= 1);
    // The tallies partition the unit space.
    assert.equal(
      stats.withClause + stats.anchorOnlyProvenance + stats.withoutProvenance,
      stats.units,
    );
  });

  it('normalizeClause is the single normalization door', () => {
    assert.deepEqual(normalizeClause('urn:a:1:2021', '5.2'), {
      doc: 'urn:a:1:2021',
      clause: '5.2',
      urn: 'urn:a:1:2021#clause-5.2',
    });
    // The fold's shape: the anchor embedded in the doc string.
    assert.deepEqual(normalizeClause('urn:a:1:2021#clause-5.2/s1', ''), {
      doc: 'urn:a:1:2021',
      clause: '5.2',
      urn: 'urn:a:1:2021#clause-5.2/s1',
      fragment: 's1',
    });
  });
});

describe('retrieval export — stable ids + content digests (ask 4)', () => {
  it('projects the package-authored identifiers, one per kind', () => {
    const { units, stats } = fixtureUnits();
    const expected: [string, string][] = [
      ['/req/scope/alpha', 'requirement'],
      ['/conf/scope/alpha-frob', 'conformance_test'],
      ['/term/frobnicator', 'term'],
      ['/attribute/widget_mass', 'attribute'],
      ['/behavior/beep-response', 'behavior'],
      ['/calc/frob-index', 'calculation'],
      ['/calculation/lookupFrob', 'formula'],
      ['/symbol/b_l', 'symbol'],
      ['/constraint/widget_geometry', 'constraint'],
      ['/characteristic/beep_level', 'characteristic'],
      ['/table/frob_tiers', 'table'],
      ['/sequence/frob-then-beep', 'sequence'],
      ['/note/frob-note', 'note'],
      ['/state-machine/WidgetOperational', 'state_machine'],
      ['/dimension/tech', 'dimension'],
    ];
    for (const [id, kind] of expected) {
      const unit = units.get(id);
      assert.ok(unit, `unit ${id} present`);
      assert.equal(unit.kind, kind);
    }
    assert.equal(stats.units, units.size);
    assert.equal(stats.byKind.requirement, 5);
    assert.equal(stats.byKind.formula, 1);
  });

  it('the digest recomputes from the shipped unit (the canonical form is documented)', () => {
    const { units } = fixtureUnits();
    for (const unit of units.values()) {
      // The digest input is the AUTHORED content: the derived
      // projections (passport, facet) ride beside it, never inside it.
      const { content_hash, passport, facet, ...content } = unit;
      assert.equal(
        retrievalDigest(content),
        content_hash,
        `${unit.id} digest recomputes`,
      );
      assert.equal(passport.content_hash, content_hash);
      assert.equal(facet.unit_hash, content_hash);
    }
  });

  it('a display-text rename moves the digest, never the id', () => {
    const dir = buildRetrievalFixturePackage();
    const before = exportPackageRetrieval(dir);
    const path = join(dir, 'specification', 'requirements.prl');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        'name "Alpha"',
        'name "Alpha (renamed)"',
      ),
    );
    const after = exportPackageRetrieval(dir);
    const b = before.document.units.find(u => u.id === '/req/scope/alpha')!;
    const a = after.document.units.find(u => u.id === '/req/scope/alpha')!;
    // Identity = id (unmoved); currency = digest (moved).
    assert.equal(a.id, '/req/scope/alpha');
    assert.notEqual(a.content_hash, b.content_hash);
    assert.notEqual(after.document.source_hash, before.document.source_hash);
    // …and the id SET is untouched: no unit appears or disappears.
    assert.deepEqual(
      after.document.units.map(u => u.id),
      before.document.units.map(u => u.id),
    );
  });

  it('content-free reordering of the package files moves nothing', () => {
    const dir = buildRetrievalFixturePackage();
    const before = exportPackageRetrieval(dir);
    // Reauthor a file with a leading comment: the package bytes move
    // (the bundle hash — deliberately byte-sensitive) but no unit does.
    const path = join(dir, 'specification', 'constraints.prl');
    writeFileSync(path, '# a comment\n' + readFileSync(path, 'utf8'));
    const after = exportPackageRetrieval(dir);
    assert.notEqual(after.document.source_hash, before.document.source_hash);
    const b = before.document.units.find(
      u => u.id === '/constraint/widget_geometry',
    )!;
    const a = after.document.units.find(
      u => u.id === '/constraint/widget_geometry',
    )!;
    assert.equal(a.content_hash, b.content_hash);
  });
});

describe('retrieval export — the machine passport (ask 6)', () => {
  it('carries the compact digest per unit', () => {
    const { units } = fixtureUnits();
    const alpha = units.get('/req/scope/alpha')!.passport;
    assert.equal(alpha.v, 1);
    assert.equal(alpha.kind, 'requirement');
    assert.equal(alpha.id, '/req/scope/alpha');
    assert.equal(alpha.text, 'The widget shall frobnicate.');
    assert.equal(alpha.expression, 'ocl{family.parameters.x > 0}');
    assert.equal(alpha.applicability, 'accuracy_class=A|C');
    assert.deepEqual(alpha.provenance, [
      'urn:test:r:9-1:2021#clause-5.2',
      'urn:test:r:9-1:2021#clause-5.2.1',
    ]);
    assert.match(alpha.content_hash, /^[0-9a-f]{64}$/);
  });

  it('carries the expression and units of the machine kinds', () => {
    const { units } = fixtureUnits();
    const constraint = units.get('/constraint/widget_geometry')!.passport;
    assert.equal(
      constraint.expression,
      'ocl{model.parameters.x <= model.parameters.x_max}',
    );
    const calc = units.get('/calc/frob-index')!.passport;
    assert.equal(calc.expression, 'ocl{x / x_ref}');
    assert.deepEqual(calc.units, ['v']);
    const characteristic = units.get('/characteristic/beep_level')!.passport;
    assert.equal(characteristic.expression, 'ocl{abs(b_l)}');
    assert.deepEqual(characteristic.units, ['dB']);
    const term = units.get('/term/frobnicator')!.passport;
    assert.equal(term.expression, '');
    assert.equal(term.text, 'a device that frobnicates');
  });

  it('serializes canonically — an agent verifies without the package', () => {
    const { units } = fixtureUnits();
    const unit = units.get('/req/scope/alpha')!;
    const canonical = passportCanonical(unit.passport);
    // The canonical form is the compact sorted-key JSON…
    assert.equal(canonical, canonicalJson(unit.passport));
    assert.equal(JSON.parse(canonical).id, '/req/scope/alpha');
    // …and re-hashing it is the verification an agent runs.
    assert.equal(
      createHash('sha256').update(canonical, 'utf8').digest('hex'),
      retrievalDigest(unit.passport),
    );
  });
});

describe('retrieval export — the unit payloads', () => {
  it('projects the requirement surface the consumer binds', () => {
    const { units } = fixtureUnits();
    const alpha = units.get('/req/scope/alpha')!;
    assert.equal(alpha.class, '/req/scope');
    assert.equal(alpha.modality, 'shall');
    assert.deepEqual(alpha.binds_to, ['family.parameters.x']);
    assert.deepEqual(
      alpha.applicability!.map(a => [a.dimension, a.values]),
      [['accuracy_class', ['A', 'C']]],
    );
    assert.deepEqual(alpha.dependencies, ['/req/scope/beta']);
    assert.deepEqual(alpha.verification, {
      method: 'examination',
      description: 'By inspection.',
    });
  });

  it('splits calculations and formulas on the rule type (the consumer split)', () => {
    const { units } = fixtureUnits();
    const calc = units.get('/calc/frob-index')!;
    assert.equal(calc.kind, 'calculation');
    assert.equal(calc.name, 'frobIndex');
    assert.deepEqual(calc.payload!.inputs, [
      { name: 'x', type: 'number', unit: 'v' },
    ]);
    const formula = units.get('/calculation/lookupFrob')!;
    assert.equal(formula.kind, 'formula');
    assert.equal(formula.name, 'Frob lookup');
    assert.equal(formula.payload!.rule_type, 'table_lookup');
  });

  it('projects the term, table, sequence, note, state machine, and dimension payloads', () => {
    const { units } = fixtureUnits();
    const term = units.get('/term/frobnicator')!;
    assert.deepEqual(term.payload!.alt, ['frobber']);
    assert.equal(term.payload!.language, 'en');
    const table = units.get('/table/frob_tiers')!;
    assert.deepEqual(table.payload!.columns, [
      { name: 'tech', type: 'string' },
      { name: 'tier_min', type: 'number', unit: 'v' },
      { name: 'tier_max', type: 'number', unit: 'v' },
    ]);
    assert.deepEqual(table.units, ['v']);
    const sequence = units.get('/sequence/frob-then-beep')!;
    assert.deepEqual(sequence.payload!.steps, [
      { order: 1, test: '/conf/scope/alpha-frob', role: 'baseline' },
      { order: 2, phase: 'warm-up', depends_on: 1 },
    ]);
    const note = units.get('/note/frob-note')!;
    assert.equal(note.name, 'CAUTION');
    assert.equal(note.statement, 'Frobnicate only under supervision.');
    const machine = units.get('/state-machine/WidgetOperational')!;
    assert.deepEqual(machine.payload!.states, ['off', 'ready']);
    const dimension = units.get('/dimension/tech')!;
    assert.deepEqual(
      (dimension.payload!.values as { id: string }[]).map(v => v.id),
      ['analogue', 'digital'],
    );
  });
});

describe('retrieval export — the R 60 corpus leg', () => {
  it(
    'projects the real package with clause-URN provenance throughout',
    {
      skip: R60_SKIP,
    },
    () => {
      const result = exportPackageRetrieval(R60);
      const { units } = result.document;
      assert.ok(units.length > 300, `expected 300+ units, got ${units.length}`);
      // The tallies partition the unit space.
      assert.equal(
        result.stats.withClause +
          result.stats.anchorOnlyProvenance +
          result.stats.withoutProvenance,
        units.length,
      );
      for (const unit of units) {
        // Every clause edge carries the document's own numbering — never
        // a bare UUID (ask 1's invariant, corpus-wide). The doc may be a
        // legacy non-URN token (the corpus carries "OIML-V1" style refs —
        // the register mapping stays consumer-side); those are counted in
        // the stats, never rewritten.
        for (const c of unit.clauses ?? []) {
          assert.ok(c.doc.length > 0, `${unit.id} edge names a document`);
          assert.ok(
            !/^_?[0-9a-f]{8}-[0-9a-f]{4}-/i.test(c.clause),
            `${unit.id} clause is never a UUID anchor`,
          );
          assert.ok(
            c.urn === c.doc || c.urn.startsWith(`${c.doc}#`),
            `${unit.id} urn derives from the doc`,
          );
        }
        // Every digest recomputes (the documented canonical form); the
        // facet is the derived projection, excluded from the input.
        const { content_hash, passport, facet, ...content } = unit;
        assert.equal(retrievalDigest(content), content_hash);
        assert.equal(passport.content_hash, content_hash);
        assert.equal(facet.unit_hash, content_hash);
        // The facet (ask 3), corpus-wide: flat scalars, the package's
        // document fields, the honest clause anchor.
        assert.ok(facet, `${unit.id} carries a facet`);
        for (const [k, v] of Object.entries(facet)) {
          assert.equal(
            typeof v,
            'string',
            `${unit.id} facet.${k} is a scalar string`,
          );
        }
        assert.equal(facet.unit_id, unit.id);
        assert.equal(facet.block, unit.kind);
        assert.equal(facet.doc_id, 'oiml-r60');
        assert.equal(facet.docidentifier, 'OIML R 60:2021');
        assert.equal(facet.doctype, 'r');
        assert.equal(facet.doc_number, '60');
        assert.equal(facet.edition, '2021');
        assert.equal(facet.model_version, '2021');
        assert.equal(facet.language, 'eng-Latn');
        assert.equal(facet.clause_anchor, unit.clause?.clause ?? '');
        // The language tag rides every unit (ask 7; the R 60 package
        // ships no text blocks — variants absent, never fabricated).
        assert.equal(unit.language, 'eng-Latn');
        // The applicability flattening agrees with the typed entries.
        const appKeys = Object.keys(facet).filter(
          k => k.startsWith('app_') && !k.endsWith('_match'),
        );
        const dims = new Set(
          (unit.applicability ?? []).map(a => `app_${a.dimension}`),
        );
        assert.deepEqual(new Set(appKeys), dims);
      }
      // Applicability is exercised corpus-wide (never a fixture-only path).
      assert.ok(
        units.some(u => Object.keys(u.facet).some(k => k.startsWith('app_'))),
        'the corpus carries app_ facet keys',
      );
      // R 60 ships no text blocks: the variant tallies are honestly zero.
      assert.equal(result.stats.withVariants, 0);
      assert.equal(result.stats.droppedTextBlocks, 0);
      // The deployed consumer's pin shape: standard → { source_hash, … }.
      assert.match(result.document.source_hash!, /^[0-9a-f]{64}$/);
      assert.equal(result.document.source_hash, packageSourceHash(R60));
    },
  );

  it(
    'the pure Standard form exports without the source hash',
    {
      skip: R60_SKIP,
    },
    () => {
      const standard = loadPackage(R60);
      const result = exportStandardRetrieval(standard);
      assert.equal(result.document.source_hash, undefined);
      assert.ok(result.document.units.length > 300);
      assert.equal(result.document.package.edition, '2021');
      // The manifest version IS the publication year on this package —
      // the fields stay distinct even when their values coincide.
      assert.equal(result.document.package.model_version, '2021');
    },
  );
});
