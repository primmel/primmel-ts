// ─────────────────────────────────────────────────────────────────────
// Mapping construct serialization tests (TODO.roadmap/04):
//   - the in-model `map_profile` (v2 syntax kept; v3 per-pair metadata);
//   - the standalone `.prm` JSON (v2 MMEL_MAP read-compatible);
//   - the bridges between the two serializations;
//   - the pilot: platform workflow → PD-05 sketch, with the coverage
//     report computed over it.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import { load, dump, loadFile } from '../src/ser-des/index';
import {
  loadPrm,
  dumpPrm,
  prmToMapProfiles,
  mapProfilesToPrm,
} from '../src/ser-des/prm';
import { collectMappings, computeCoverage } from '../src/mapping-coverage';

const PILOT = join(__dirname, 'fixtures', 'mapping-pilot');

describe('map_profile — v2 serialization stays compatible', () => {
  it('parses the v2 arrow form with bare and qualified targets', () => {
    const s = load(`
      map_profile StdS {
        description "Mappings into Standard S"
        mapping {
          OpA -> StdS#Process5
          OpB -> Process3
        }
      }
    `);
    const mp = s.mapProfiles[0];
    assert.equal(mp.namespace, 'StdS');
    assert.equal(mp.description, 'Mappings into Standard S');
    assert.deepEqual(mp.mappings.OpA, [
      {
        target: 'StdS#Process5',
        description: '',
        justification: '',
        coverage: '',
      },
    ]);
    assert.deepEqual(mp.mappings.OpB, [
      { target: 'Process3', description: '', justification: '', coverage: '' },
    ]);
  });

  it('dumps metadata-free pairs in the v2 form (byte-stable)', () => {
    const block = `map_profile StdS {
  mapping {
    OpA -> StdS#Process5
    OpB -> Process3
  }
}
`;
    const out = dump(load(block));
    assert.ok(
      out.endsWith(block),
      `dump should end with the v2-verbatim block, got:\n${out}`,
    );
    // and the v2 form re-parses to the identical model
    assert.deepEqual(load(out).mapProfiles[0], load(block).mapProfiles[0]);
  });

  it('keeps several targets per source (write once, comply twice)', () => {
    const s = load(`
      map_profile StdS {
        mapping {
          OpA -> StdS#Process5
          OpA -> StdS#Process3
        }
      }
    `);
    assert.equal(s.mapProfiles[0].mappings.OpA.length, 2);
  });

  it('tolerates the v2 compact arrow (spaces optional around ->)', () => {
    const compact = load(`
      map_profile StdS {
        mapping {
          OpA->StdS#Process5
          OpB ->StdS#Process3
          OpC-> StdS#Process4
        }
      }
    `).mapProfiles[0];
    assert.deepEqual(compact.mappings.OpA, [
      {
        target: 'StdS#Process5',
        description: '',
        justification: '',
        coverage: '',
      },
    ]);
    assert.equal(compact.mappings.OpB[0].target, 'StdS#Process3');
    assert.equal(compact.mappings.OpC[0].target, 'StdS#Process4');
    // …identical to the spaced form, metadata blocks included.
    const spaced = load(`
      map_profile StdS {
        mapping {
          OpA -> StdS#Process5 { coverage full }
        }
      }
    `).mapProfiles[0];
    const compactMeta = load(`
      map_profile StdS {
        mapping {
          OpA->StdS#Process5 { coverage full }
        }
      }
    `).mapProfiles[0];
    assert.deepEqual(compactMeta.mappings, spaced.mappings);
  });

  it('still rejects genuinely malformed mapping lines', () => {
    assert.throws(
      () => load('map_profile StdS { mapping { OpA => StdS#Process5 } }'),
      /Expecting "->" after mapping source "OpA"/,
    );
    assert.throws(
      () => load('map_profile StdS { mapping { OpA StdS#Process5 } }'),
      /Expecting "->" after mapping source "OpA"/,
    );
  });
});

describe('map_profile — v3 per-pair metadata', () => {
  const V3 = `map_profile StdS {
  description "Mappings into Standard S"
  mapping {
    OpA -> StdS#Process5 { description "Batch logging fulfils the record requirement." justification "The roaster writes the record on completion." coverage full }
    OpB -> StdS#Process3
  }
}
`;

  it('parses description, justification and the coverage assertion', () => {
    const mp = load(V3).mapProfiles[0];
    assert.deepEqual(mp.mappings.OpA, [
      {
        target: 'StdS#Process5',
        description: 'Batch logging fulfils the record requirement.',
        justification: 'The roaster writes the record on completion.',
        coverage: 'full',
      },
    ]);
    assert.deepEqual(mp.mappings.OpB, [
      {
        target: 'StdS#Process3',
        description: '',
        justification: '',
        coverage: '',
      },
    ]);
  });

  it('round-trips losslessly (parse → dump → parse, identical model)', () => {
    const first = load(V3).mapProfiles[0];
    const second = load(dump(load(V3))).mapProfiles[0];
    assert.deepEqual(second, first);
  });

  it('escapes quotes and backslashes in pair metadata', () => {
    const s = load(`
      map_profile StdS {
        mapping {
          OpA -> StdS#Process5 { description "writes \\"batch\\" logs \\\\ nightly" }
        }
      }
    `);
    const pair = s.mapProfiles[0].mappings.OpA[0];
    assert.equal(pair.description, 'writes "batch" logs \\ nightly');
    const again = load(dump(s)).mapProfiles[0].mappings.OpA[0];
    assert.deepEqual(again, pair);
  });

  it('rejects an unknown coverage level at parse time', () => {
    assert.throws(
      () =>
        load(`map_profile StdS {
  mapping { OpA -> StdS#Process5 { coverage total } }
}`),
      /Unknown coverage level "total"/,
    );
  });
});

describe('.prm — the standalone JSON serialization', () => {
  it('reads the v2 MMEL_MAP seed form (bare targets, empty metadata)', () => {
    const prm = loadPrm(`{
      "@context": "https://bsi-ribose-smart.org",
      "@type": "MMEL_MAP",
      "id": "acme",
      "mapSet": {
        "BS13485": {
          "id": "BS13485",
          "mappings": {
            "Process5": { "Improvement": { "description": "", "justification": "" } }
          }
        }
      }
    }`);
    assert.equal(prm.type, 'MMEL_MAP');
    assert.equal(prm.context, 'https://bsi-ribose-smart.org');
    assert.deepEqual(prm.mapSet.BS13485.mappings.Process5.Improvement, {
      description: '',
      justification: '',
      coverage: '',
    });
  });

  it('round-trips as a fixed point (load → dump → load, identical model)', () => {
    const v2 = `{
  "@context": "https://bsi-ribose-smart.org",
  "@type": "MMEL_MAP",
  "id": "acme",
  "mapSet": {
    "BS13485": {
      "id": "BS13485",
      "mappings": {
        "Process5": {
          "Improvement": { "description": "", "justification": "" },
          "FeedbackProcess": { "description": "d", "justification": "j" }
        }
      }
    }
  }
}`;
    const once = loadPrm(dumpPrm(loadPrm(v2)));
    const twice = loadPrm(dumpPrm(once));
    assert.deepEqual(twice, once);
    // The authored v2 @type survives the round trip verbatim.
    assert.equal(once.type, 'MMEL_MAP');
  });

  it('carries the v3 coverage assertion per pair', () => {
    const prm = loadPrm(`{
      "@type": "Primmel_MAP",
      "id": "x",
      "mapSet": {
        "StdS": {
          "id": "StdS",
          "mappings": {
            "OpA": { "StdS#Process5": { "description": "d", "justification": "j", "coverage": "full" } }
          }
        }
      }
    }`);
    assert.equal(
      prm.mapSet.StdS.mappings.OpA['StdS#Process5'].coverage,
      'full',
    );
    // and the assertion survives the dump round trip
    const again = loadPrm(dumpPrm(prm));
    assert.deepEqual(again, prm);
  });

  it('rejects a foreign @type and a bad coverage level', () => {
    assert.throws(
      () => loadPrm(`{ "@type": "SomethingElse", "mapSet": {} }`),
      /@type/,
    );
    assert.throws(
      () =>
        loadPrm(`{
          "@type": "Primmel_MAP",
          "mapSet": { "S": { "mappings": { "A": { "B": { "coverage": "total" } } } } }
        }`),
      /coverage/,
    );
    assert.throws(() => loadPrm('not json'), /invalid JSON/);
  });

  it('bridges .prm ⇄ map profiles without loss', () => {
    const prm = loadPrm(
      readFileSync(join(PILOT, 'platform-to-pd05.prm'), 'utf8'),
    );
    const profiles = prmToMapProfiles(prm);
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].namespace, 'PD05');
    assert.equal(
      profiles[0].mappings.ApplicationIntake[0].target,
      'PD05#ApplicationReview',
    );
    const back = mapProfilesToPrm(prm.id, profiles);
    // The mapSet content survives the bridge losslessly (@context is a
    // file-level concern and does not cross the bridge).
    assert.deepEqual(back.mapSet, prm.mapSet);
  });
});

describe('the pilot — platform workflow ⇒ PD-05 sketch', () => {
  it('computes the coverage report over the .prm sketch', () => {
    const platform = loadFile(join(PILOT, 'platform.prl'));
    const pd05 = loadFile(join(PILOT, 'pd05.prl'));
    const prm = loadPrm(
      readFileSync(join(PILOT, 'platform-to-pd05.prm'), 'utf8'),
    );
    const mappings = collectMappings(platform, { modelId: 'Platform', prm });
    assert.equal(mappings.length, 3);

    const report = computeCoverage(platform, pd05, mappings, 'PD05', {
      implementationId: 'Platform',
      referenceId: 'PD05',
    });
    const table = Object.fromEntries(
      report.components.map(c => [c.id, c.coverage]),
    );
    assert.deepEqual(table, {
      CertificationProcess: 'full', // aggregated — no direct mapping
      ApplicationReview: 'full',
      TypeEvaluation: 'full',
      CertificationDecision: 'full',
    });
    assert.deepEqual(report.summary, {
      full: 4,
      minimal: 0,
      partial: 0,
      none: 0,
    });
    assert.deepEqual(report.unmappedImplementation, ['Invoicing']);

    // Every child covered ⇒ the parent is full by aggregation (asserted
    // as a level), and closure PROPOSES a direct pair per child source —
    // flagged, never asserted.
    const closure = report.proposals.filter(p => p.kind === 'closure');
    assert.deepEqual(closure.map(p => p.source).sort(), [
      'ApplicationIntake',
      'CertificateIssuance',
      'TestExecution',
    ]);
    for (const p of closure) {
      assert.equal(p.target, 'PD05#CertificationProcess');
      assert.equal(p.asserted, false);
    }
  });
});
