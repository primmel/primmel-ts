// ─────────────────────────────────────────────────────────────────────
// W2 package convention + loader (Primmel v2, gap G8).
// ─────────────────────────────────────────────────────────────────────

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  loadPackage,
  loadPackageWithIssues,
  packageFiles,
} from '../src/ser-des/package';
import { parsePackage } from '../src/ser-des/config/packageManifest';

let dir: string;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'primmel-pkg-'));

  writeFileSync(
    join(dir, 'package.primmel'),
    `package {
  id oiml-r60
  title "OIML R 60 — Metrological regulation for load cells"
  version "2021"
  editions { 2021 2017 2000 }
  baseUrn "urn:oiml:pub:r:60:2021"
  extends oiml-core
  description "Load cell Recommendation package"
  source { collection "sources/r060/collection.yml" parts { 1 2 3 a } }
}`,
  );

  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'model', 'instrument.prl'),
    `instrument LoadCell {
  extends MeasuringInstrumentModel
  definition "Measuring transducer for load."
}`,
  );
  writeFileSync(
    join(dir, 'model', 'attributes.prl'),
    `attribute_definition e_max {
  symbol "E_max"
  origin design-fixed
  scope model
}`,
  );

  mkdirSync(join(dir, 'entities'));
  writeFileSync(
    join(dir, 'entities', 'instrument.prl'),
    `class MeasuringInstrumentModel#data {
  store { measuringInstrumentModels }
  id: string [1..1] { modality SHALL }
  family_id: reference(MeasuringInstrumentModelFamily#data) [1..1] { on_delete restrict }
}`,
  );

  mkdirSync(join(dir, 'specification'));
  writeFileSync(
    join(dir, 'specification', 'requirements.prl'),
    `requirement /req/metrological/mpe {
  name "Maximum permissible error"
  binds_to { model.parameters.mpe }
  limit { expression "ocl{abs(e_l) <= mpe}" uses { mpe } }
}`,
  );

  // Cross-file reference: a form in execution/ references the attribute in model/
  mkdirSync(join(dir, 'execution'));
  writeFileSync(
    join(dir, 'execution', 'forms.prl'),
    `form F1 {
  name "F"
  field emax : number { bind model.parameters.e_max }
}`,
  );

  writeFileSync(
    join(dir, 'terminology.prl'),
    `term load-cell {
  label "load cell"
  definition "measuring transducer for load"
  vocab_ref { register viml-2022 clause "4.06" }
}`,
  );
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('W2 package convention + loader', () => {
  it('parses the manifest', () => {
    const ctx: { packageManifest: any } = { packageManifest: null };
    parsePackage(`package { id oiml-r60 title "R 60" extends oiml-core }`)(
      ctx as any,
    );
    assert.equal(ctx.packageManifest.id, 'oiml-r60');
    assert.equal(ctx.packageManifest.extends, 'oiml-core');
  });

  it('enumerates package files: manifest first, content sorted', () => {
    const files = packageFiles(dir);
    assert.equal(files[0].role, 'manifest');
    assert.ok(files[0].path.endsWith('package.primmel'));
    const content = files.filter(f => f.role === 'content').map(f => f.path);
    assert.deepEqual(content, [...content].sort());
    assert.ok(content.some(p => p.endsWith('model/instrument.prl')));
    assert.ok(
      content.some(p => p.endsWith('terminology.prl')),
      'root-level .prl included',
    );
  });

  it('loadPackage merges all layers into one Standard with the manifest attached', () => {
    const m = loadPackage(dir);
    assert.equal(m.packageManifest?.id, 'oiml-r60');
    assert.equal(
      m.packageManifest?.title,
      'OIML R 60 — Metrological regulation for load cells',
    );
    assert.deepEqual(m.packageManifest?.editions, ['2021', '2017', '2000']);
    assert.equal(m.packageManifest?.baseUrn, 'urn:oiml:pub:r:60:2021');
    assert.equal(m.packageManifest?.extends, 'oiml-core');
    assert.deepEqual(m.packageManifest?.source, {
      collection: 'sources/r060/collection.yml',
      parts: ['1', '2', '3', 'a'],
    });
    assert.ok(m.instruments.some(i => i.id === 'LoadCell'));
    assert.ok(m.attributeDefinitions.some(a => a.id === 'e_max'));
    assert.ok(
      m.dataclasses.some(c => c.id === 'MeasuringInstrumentModel#data'),
    );
    assert.ok(m.requirements.some(r => r.id === '/req/metrological/mpe'));
    assert.ok(m.forms.some(f => f.id === 'F1'));
    assert.ok(m.terms.some(t => t.id === 'load-cell'));
  });

  it('detects duplicate ids ACROSS files', () => {
    writeFileSync(
      join(dir, 'model', 'dup.prl'),
      `attribute_definition e_max { symbol "DUPE" }`,
    );
    const { issues } = loadPackageWithIssues(dir);
    assert.ok(
      issues.some(i => String(i.message ?? i).includes('e_max')),
      `expected a duplicate-id issue for e_max, got: ${JSON.stringify(issues)}`,
    );
    rmSync(join(dir, 'model', 'dup.prl'));
  });
});
