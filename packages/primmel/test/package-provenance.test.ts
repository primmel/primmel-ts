// ─────────────────────────────────────────────────────────────────────
// Per-file provenance of the package load (loadPackageWithProvenance).
//
// The merge itself is untouched: a provenance load must produce a
// byte-identical Standard and identical issues, and every top-level
// construct must attribute to the file it was parsed from, including
// the `uses` composition case (an imported construct names ITS file,
// never the importer's).
// ─────────────────────────────────────────────────────────────────────

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { dump } from '../src/ser-des/index';
import {
  groupBySourceFile,
  loadPackage,
  loadPackageWithIssues,
  loadPackageWithProvenance,
} from '../src/ser-des/package';

let root: string;
let recDir: string;
let coreDir: string;

before(() => {
  root = mkdtempSync(join(tmpdir(), 'primmel-prov-'));

  // The importing package: content spread over the convention dirs, a
  // root-level file, and an include of a non-convention directory.
  recDir = join(root, 'rec');
  mkdirSync(join(recDir, 'model'), { recursive: true });
  mkdirSync(join(recDir, 'specification'), { recursive: true });
  mkdirSync(join(recDir, 'shared'), { recursive: true });

  writeFileSync(
    join(recDir, 'package.primmel'),
    `package {
  id test-rec
  title "Provenance test rec"
  version "2026"
  baseUrn "urn:example:rec:2026"
  uses { test-core }
}`,
  );
  writeFileSync(
    join(recDir, 'model', 'attributes.prl'),
    `attribute_definition e_max {
  symbol "E_max"
  origin design-fixed
  scope model
}`,
  );
  writeFileSync(
    join(recDir, 'model', 'with-include.prl'),
    `include "../shared/defs.prl"`,
  );
  writeFileSync(
    join(recDir, 'shared', 'defs.prl'),
    `attribute_definition e_min {
  symbol "E_min"
  origin design-fixed
  scope model
}`,
  );
  writeFileSync(
    join(recDir, 'specification', 'requirements.prl'),
    `requirement /req/metrological/mpe {
  name "Maximum permissible error"
  binds_to { model.parameters.mpe }
  limit { expression "ocl{abs(e_l) <= mpe}" uses { mpe } }
}`,
  );
  writeFileSync(
    join(recDir, 'terminology.prl'),
    `term load-cell {
  label "load cell"
  definition "measuring transducer for load"
}
term kilogram {
  label "kilogram"
  definition "overlay definition"
  overlay true
}`,
  );

  // The imported package.
  coreDir = join(root, 'core');
  mkdirSync(join(coreDir, 'model'), { recursive: true });
  writeFileSync(
    join(coreDir, 'package.primmel'),
    `package {
  id test-core
  title "Provenance test core"
  version "2026"
  baseUrn "urn:example:core:2026"
}`,
  );
  writeFileSync(
    join(coreDir, 'model', 'quantities.prl'),
    `attribute_definition mass {
  symbol "m"
  origin design-fixed
  scope model
}`,
  );
  writeFileSync(
    join(coreDir, 'vocabulary.prl'),
    `term kilogram {
  label "kilogram"
  definition "base definition"
}`,
  );
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

const resolvePackage = (id: string): string | undefined =>
  id === 'test-core' ? coreDir : undefined;

describe('loadPackageWithProvenance (single package)', () => {
  // Load without the locator so only this directory merges.
  const result = () => loadPackageWithProvenance(recDir);

  it('attributes every top-level construct to its source file', () => {
    const { provenance } = result();
    const attrs = provenance.constructs.attributeDefinitions;
    assert.ok(attrs['e_max'].file.endsWith(join('model', 'attributes.prl')));
    assert.equal(attrs['e_max'].package, 'test-rec');
    assert.ok(
      provenance.constructs.requirements['/req/metrological/mpe'].file.endsWith(
        join('specification', 'requirements.prl'),
      ),
    );
    assert.ok(
      provenance.constructs.terms['load-cell'].file.endsWith('terminology.prl'),
      'root-level .prl file',
    );
    assert.ok(
      provenance.manifest?.endsWith('package.primmel'),
      'manifest path recorded',
    );
  });

  it('records file-local spans covering keyword through payload', () => {
    const { provenance } = result();
    const source = provenance.constructs.requirements['/req/metrological/mpe'];
    const text = readFileSync(source.file, 'utf8');
    const slice = text.slice(source.span.start.offset, source.span.end.offset);
    assert.ok(slice.startsWith('requirement'), 'span starts at the keyword');
    assert.ok(slice.endsWith('}'), 'span ends after the payload block');
    const line = text.split('\n')[source.span.start.line - 1];
    assert.ok(
      line.slice(source.span.start.col - 1).startsWith('requirement'),
      'line/col agree with the offset',
    );
  });

  it('merges byte-identical to a plain loadPackage', () => {
    const plain = loadPackage(recDir);
    const withIssues = loadPackageWithIssues(recDir);
    const withProv = result();
    assert.deepEqual(withProv.standard, plain);
    assert.deepEqual(withProv.issues, withIssues.issues);
    assert.equal(dump(withProv.standard), dump(plain));
  });

  it('attributes included constructs to the INCLUDING file', () => {
    const { provenance } = result();
    const source = provenance.constructs.attributeDefinitions['e_min'];
    assert.ok(
      source.file.endsWith(join('model', 'with-include.prl')),
      'the include is inlined; the unit the merge reads is the includer',
    );
  });
});

describe('loadPackageWithProvenance (uses composition)', () => {
  const result = () => loadPackageWithProvenance(recDir, { resolvePackage });

  it('names the DECLARING package and file, never the importer', () => {
    const { provenance, composition } = result();
    assert.deepEqual(composition?.order, ['test-core', 'test-rec']);

    const mass = provenance.constructs.attributeDefinitions['mass'];
    assert.equal(mass.package, 'test-core');
    assert.ok(mass.file.startsWith(coreDir));
    assert.ok(mass.file.endsWith(join('model', 'quantities.prl')));

    const own = provenance.constructs.requirements['/req/metrological/mpe'];
    assert.equal(own.package, 'test-rec');
    assert.ok(own.file.startsWith(recDir));
  });

  it('an overlay term attributes to the OVERLAYING package', () => {
    const { standard, provenance } = result();
    const term = provenance.constructs.terms['kilogram'];
    assert.equal(term.package, 'test-rec');
    assert.ok(term.file.endsWith('terminology.prl'));
    assert.equal(
      standard.terms.find(t => t.id === 'kilogram')?.definition,
      'overlay definition',
      'the merged model carries the overlay, so must the provenance',
    );
  });

  it('merges byte-identical to a plain composed loadPackage', () => {
    const plain = loadPackage(recDir, { resolvePackage });
    const withProv = result();
    assert.deepEqual(withProv.standard, plain);
    assert.equal(dump(withProv.standard), dump(plain));
  });
});

describe('groupBySourceFile (the package-aware save partition)', () => {
  it('partitions refs by source file and reports the unknown', () => {
    const { provenance } = loadPackageWithProvenance(recDir);
    const groups = groupBySourceFile(provenance, [
      { field: 'attributeDefinitions', id: 'e_max' },
      { field: 'terms', id: 'load-cell' },
      { field: 'terms', id: 'kilogram' },
      { field: 'requirements', id: '/req/metrological/mpe' },
      { field: 'terms', id: 'authored-after-load' },
    ]);
    assert.equal(groups.byFile.size, 3);
    const terminology = [...groups.byFile.entries()].find(([f]) =>
      f.endsWith('terminology.prl'),
    )?.[1];
    assert.deepEqual(
      terminology?.map(r => r.id),
      ['load-cell', 'kilogram'],
      'input order kept within a file group',
    );
    assert.deepEqual(groups.unassigned, [
      { field: 'terms', id: 'authored-after-load' },
    ]);
  });
});

describe('loadPackageWithProvenance (manifestless directory)', () => {
  it('still reports files, with the package field absent', () => {
    const bare = join(root, 'bare');
    mkdirSync(join(bare, 'model'), { recursive: true });
    writeFileSync(
      join(bare, 'model', 'a.prl'),
      `attribute_definition q {
  symbol "Q"
  origin design-fixed
  scope model
}`,
    );
    const { provenance } = loadPackageWithProvenance(bare);
    const source = provenance.constructs.attributeDefinitions['q'];
    assert.ok(source.file.endsWith(join('model', 'a.prl')));
    assert.equal(source.package, undefined);
    assert.equal(provenance.manifest, undefined);
  });
});
