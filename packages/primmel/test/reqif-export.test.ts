// ─────────────────────────────────────────────────────────────────────
// ReqIF export tests (TODO.roadmap/27, interop projections surface 1):
// the exact modality mapping, the document/heading/provision hierarchy,
// the spec-relation projection (dependencies, bindings, targets — with
// unexported refs dropped, never dangling), XML well-formedness checked
// by parsing the output back, a golden small-package document, the
// header-note doctrine, and the real R 60 package exercised end to end.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  exportPackageReqif,
  reqifModality,
  requirementClassOf,
  xmlCommentSafe,
} from '../src/export/reqif';
import {
  FIXTURE_NOW,
  buildCounterexamplePackage,
  buildFixturePackage,
  child,
  findAll,
  hierarchyTree,
  parseXml,
  specObjectValues,
  specObjectsById,
  textOf,
  type HierarchyTree,
  type XmlElement,
} from './helpers/reqif';
import { R60, R60_AVAILABLE, R60_SKIP } from './helpers/corpus';

// The corpus/R 60 resolution (env-first, repo-relative default, loud
// skip) has one home — test/helpers/corpus.ts (TODO.v2/13 item 3c).
if (!R60_AVAILABLE) {
  console.log(`reqif-export.test.ts: skipping the R 60 spec — ${R60_SKIP}`);
}

/** ids.unique → modality enum value, for every provision spec-object. */
function modalityByUniqueId(root: XmlElement): Map<string, string> {
  const out = new Map<string, string>();
  for (const obj of specObjectsById(root).values()) {
    const values = specObjectValues(obj);
    const unique = values.get('primmel-ads-provision-ids.unique');
    const modality = values.get('primmel-ade-provision-obj.modality');
    if (unique !== undefined && modality !== undefined) {
      out.set(unique, modality.replace('primmel-ev-modality-', ''));
    }
  }
  return out;
}

function relationsOf(
  root: XmlElement,
): { kind: string; source: string; target: string }[] {
  return findAll(root, 'SPEC-RELATION').map(r => ({
    kind: r.attrs['LONG-NAME'],
    source: textOf(child(child(r, 'SOURCE')!, 'SPEC-OBJECT-REF')!),
    target: textOf(child(child(r, 'TARGET')!, 'SPEC-OBJECT-REF')!),
  }));
}

describe('ReqIF export (TODO.roadmap/27)', () => {
  it('maps obligations to ReqIF modality exactly: shall→requirement, should→recommendation, may→permission', () => {
    assert.equal(reqifModality('shall'), 'requirement');
    assert.equal(reqifModality('should'), 'recommendation');
    assert.equal(reqifModality('may'), 'permission');
    // The empty obligation is the Primmel default (shall); anything
    // else maps to the profile's undefined value, never silently
    // promoted.
    assert.equal(reqifModality(''), 'requirement');
    assert.equal(reqifModality('bogus'), 'undefined');
  });

  it('places a requirement under its longest-prefix class id', () => {
    assert.equal(requirementClassOf('/req/a/b', ['/req/a']), '/req/a');
    assert.equal(
      requirementClassOf('/req/a/b/c', ['/req/a', '/req/a/b']),
      '/req/a/b',
    );
    assert.equal(requirementClassOf('/req/other/x', ['/req/a']), null);
    // No partial-segment match: /req/ab is not under /req/a.
    assert.equal(requirementClassOf('/req/ab/x', ['/req/a']), null);
  });

  it('emits well-formed XML (parsed back) with the ReqIF 1.0 (20110401) namespace', () => {
    const { xml } = exportPackageReqif(buildFixturePackage(), {
      now: FIXTURE_NOW,
    });
    const root = parseXml(xml);
    assert.equal(root.tag, 'REQ-IF');
    assert.equal(
      root.attrs['xmlns'],
      'http://www.omg.org/spec/ReqIF/20110401/reqif.xsd',
    );
    const header = findAll(root, 'REQ-IF-HEADER')[0];
    assert.equal(textOf(child(header, 'REQ-IF-VERSION')!), '1.0');
  });

  it('projects each requirement’s obligation into obj.modality', () => {
    const { xml } = exportPackageReqif(buildFixturePackage(), {
      now: FIXTURE_NOW,
    });
    const modality = modalityByUniqueId(parseXml(xml));
    assert.equal(modality.get('/req/scope/alpha'), 'requirement');
    assert.equal(modality.get('/req/scope/beta'), 'recommendation');
    assert.equal(modality.get('/req/scope/gamma'), 'permission');
    assert.equal(modality.get('/req/orphan'), 'requirement');
    // The conformance test is not a provision of obligation — undefined.
    assert.equal(modality.get('/conf/scope-tests/alpha-check'), 'undefined');
  });

  it('nests document, classes, requirements, and tests in the specification hierarchy', () => {
    const { xml } = exportPackageReqif(buildFixturePackage(), {
      now: FIXTURE_NOW,
    });
    assert.deepEqual(hierarchyTree(parseXml(xml)), [
      { ref: 'primmel-doc-test-pkg', children: [] },
      {
        ref: 'primmel-so-req-scope',
        children: [
          { ref: 'primmel-so-req-scope-alpha', children: [] },
          { ref: 'primmel-so-req-scope-beta', children: [] },
          { ref: 'primmel-so-req-scope-gamma', children: [] },
        ],
      },
      { ref: 'primmel-so-req-other', children: [] },
      { ref: 'primmel-so-req-orphan', children: [] },
      {
        ref: 'primmel-hdr-conformance-tests',
        children: [
          { ref: 'primmel-so-conf-scope-tests-alpha-check', children: [] },
        ],
      },
    ]);
  });

  it('projects dependencies, bindings, and targets into spec-relations; unexported refs drop, never dangle', () => {
    const result = exportPackageReqif(buildFixturePackage(), {
      now: FIXTURE_NOW,
    });
    const root = parseXml(result.xml);
    assert.deepEqual(relationsOf(root), [
      {
        kind: 'depends-on',
        source: 'primmel-so-req-scope',
        target: 'primmel-so-req-other',
      },
      {
        kind: 'depends-on',
        source: 'primmel-so-req-scope-alpha',
        target: 'primmel-so-req-scope-beta',
      },
      {
        kind: 'binds',
        source: 'primmel-so-req-scope-alpha',
        target: 'primmel-so-req-scope-beta',
      },
      {
        kind: 'verifies',
        source: 'primmel-so-conf-scope-tests-alpha-check',
        target: 'primmel-so-req-scope-alpha',
      },
    ]);
    // /req/missing is not in the export: recorded as dropped, and no
    // relation references an identifier with no spec-object.
    assert.deepEqual(result.stats.droppedReferences, [
      '/req/scope/alpha -> /req/missing (depends-on)',
    ]);
    const objects = specObjectsById(root);
    for (const rel of relationsOf(root)) {
      assert.ok(objects.has(rel.source), `dangling source ${rel.source}`);
      assert.ok(objects.has(rel.target), `dangling target ${rel.target}`);
    }
  });

  it('carries clause provenance (doc + clause), inert guidance/verification text, and escapes special characters', () => {
    const { xml } = exportPackageReqif(buildFixturePackage(), {
      now: FIXTURE_NOW,
    });
    const root = parseXml(xml);
    const alpha = specObjectsById(root).get('primmel-so-req-scope-alpha')!;
    const values = specObjectValues(alpha);
    // Repeated source blocks join (deduped) into one citation.
    assert.equal(
      values.get('primmel-ads-provision-obj.clause-number'),
      '5.2; 5.2.1',
    );
    assert.equal(
      values.get('primmel-ads-provision-bib.di.document-identifier'),
      'urn:test:r:1:2021',
    );
    assert.equal(
      values.get('primmel-ads-provision-primmel.guidance'),
      'Frobnicate gently.',
    );
    assert.equal(
      values.get('primmel-ads-provision-primmel.verification-method'),
      'examination',
    );
    // The statement parses back to the raw text — & < > " were escaped.
    assert.equal(
      values.get('primmel-adx-provision-reqif.text'),
      'The widget shall frobnicate & pass <all> "checks".',
    );
  });

  it('states the one-way / survive-vs-lost doctrine in the exported header note', () => {
    const { xml } = exportPackageReqif(buildFixturePackage(), {
      now: FIXTURE_NOW,
    });
    assert.match(xml, /ONE-WAY PROJECTION/);
    assert.match(xml, /single source of\s+truth/);
    assert.match(xml, /NEVER merges/);
    assert.match(xml, /SURVIVES the projection/);
    assert.match(xml, /LOST in the projection/);
    assert.match(
      xml,
      /shall -> requirement, should -> recommendation,\s+may -> permission/,
    );
  });

  it('matches the golden fixture export byte-for-byte', () => {
    // The whole fixture document, pinned (fixtures/reqif-export-golden.reqif
    // was generated by this exporter from the helpers/reqif.ts fixture at
    // FIXTURE_NOW, then reviewed; regenerate it the same way when the
    // projection intentionally changes).
    const { xml } = exportPackageReqif(buildFixturePackage(), {
      now: FIXTURE_NOW,
    });
    const golden = readFileSync(
      join(__dirname, 'fixtures', 'reqif-export-golden.reqif'),
      'utf8',
    );
    assert.equal(xml, golden);
  });

  // ── review task-27b fix legs (the counterexample package) ──

  it('sanitizes "--" in interpolated values for the XML comment (review Important 1)', () => {
    assert.equal(xmlCommentSafe('a -- b'), 'a — b');
    assert.equal(xmlCommentSafe('a --- b'), 'a — b');
    assert.equal(xmlCommentSafe('a - b'), 'a - b');
    const { xml } = exportPackageReqif(buildCounterexamplePackage(), {
      now: FIXTURE_NOW,
    });
    // The leading comment carries no "--" outside its delimiters…
    const comment = xml.slice(xml.indexOf('<!--') + 4, xml.indexOf('-->'));
    assert.equal(comment.includes('--'), false);
    assert.match(comment, /R 99 — the dashy package/);
    // …and the document still parses back.
    assert.equal(parseXml(xml).tag, 'REQ-IF');
  });

  it('records a binds ref to an unexported /-id as dropped; subject paths stay silent (review Minor 1)', () => {
    const result = exportPackageReqif(buildCounterexamplePackage(), {
      now: FIXTURE_NOW,
    });
    // binds_to { /req/not-exported sample.x }: the `/`-addressed ref is
    // recorded, the subject-chain path is not (it is part of the LOST
    // machine-checkable bindings, not a dropped reference).
    assert.deepEqual(result.stats.droppedReferences, [
      '/req/one -> /req/not-exported (binds)',
    ]);
    const objects = specObjectsById(parseXml(result.xml));
    for (const rel of relationsOf(parseXml(result.xml))) {
      assert.ok(objects.has(rel.source));
      assert.ok(objects.has(rel.target));
    }
  });

  it('counts unknown obligation spellings — modality undefined, never promoted (review Minor 2)', () => {
    const result = exportPackageReqif(buildCounterexamplePackage(), {
      now: FIXTURE_NOW,
    });
    assert.equal(result.stats.unknownObligations, 1);
    assert.match(result.xml, /1 unknown obligation \(modality undefined\)/);
    const modality = modalityByUniqueId(parseXml(result.xml));
    assert.equal(modality.get('/req/one'), 'undefined'); // SHALL
    assert.equal(modality.get('/req/two'), 'permission'); // may
  });

  it(
    'exports the real R 60 package (counts, structure, relation integrity)',
    { skip: R60_SKIP },
    () => {
      const result = exportPackageReqif(R60, { now: FIXTURE_NOW });
      assert.deepEqual(
        {
          ...result.stats,
          droppedReferences: result.stats.droppedReferences.length,
        },
        {
          documents: 1,
          requirementClasses: 14,
          requirements: 180,
          conformanceTests: 62,
          specRelations: 128,
          droppedReferences: 0,
          unknownObligations: 0,
        },
      );
      const root = parseXml(result.xml);
      const objects = specObjectsById(root);
      // 1 document + 14 class headings + 180 requirements + 62 tests
      // + the synthetic tests heading.
      assert.equal(objects.size, 258);
      // Every spec-object appears exactly once in the hierarchy.
      const flat: string[] = [];
      const walk = (nodes: HierarchyTree[]): void => {
        for (const n of nodes) {
          flat.push(n.ref);
          walk(n.children);
        }
      };
      walk(hierarchyTree(root));
      assert.equal(flat.length, objects.size);
      assert.deepEqual(new Set(flat), new Set(objects.keys()));
      // No dangling relation endpoints.
      for (const rel of relationsOf(root)) {
        assert.ok(objects.has(rel.source), `dangling source ${rel.source}`);
        assert.ok(objects.has(rel.target), `dangling target ${rel.target}`);
      }
      // The one should-obligation requirement projects as a recommendation;
      // a known verifies relation targets its requirement.
      const modality = modalityByUniqueId(root);
      assert.equal(
        modality.get('/req/technical/non-mandatory-info'),
        'recommendation',
      );
      assert.equal(modality.get('/req/metrological/mpe'), 'requirement');
      assert.ok(
        relationsOf(root).some(
          r =>
            r.kind === 'verifies' &&
            r.target === 'primmel-so-req-technical-mandatory-markings',
        ),
      );
    },
  );
});
