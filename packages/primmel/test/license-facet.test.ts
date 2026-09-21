// ─────────────────────────────────────────────────────────────────────
// License facet tests (smart TODO.external-refs/04; the entitlement
// facet + catalog): the package manifest's license_key / license_holder
// pair parses and dumps on the manifest — the entitlement catalog key
// the platform's license gate reads, and the content's copyright owner —
// and the linter rules C144–C146 validate them: the catalog-key shape,
// at most one license_key per package, and the holder required with the
// key. A package without the facets is public content: byte-unchanged
// loads and dumps.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  dumpPackage,
  parsePackage,
} from '../src/ser-des/config/packageManifest';
import { readPackageManifest } from '../src/ser-des/package';
import { checkPackage } from '../src/check';
import type { PackageManifest } from '../src/types/Package';

function manifestDir(body: string): string {
  // Each fixture gets its OWN parent dir: sibling-manifest scans read
  // the parent's subdirectories, so fixtures must not see each other.
  const parent = mkdtempSync(join(tmpdir(), 'primmel-license-'));
  const dir = join(parent, 'pkg');
  mkdirSync(dir);
  writeFileSync(join(dir, 'package.primmel'), body);
  return dir;
}

const LICENSED_MANIFEST = `package {
  id iec-60068-2-30
  kind core
  license_key "std:iec-60068-2-30"
  license_holder "IEC"
  title "IEC 60068-2-30"
  version "2005"
  baseUrn "urn:iec:std:60068-2-30:2005"
  description "Environmental testing package"
}`;

const PLAIN_MANIFEST = `package {
  id oiml-r60
  kind rec
  title "OIML R 60:2021"
  version "2021"
  baseUrn "urn:oiml:pub:r:60:2021"
  description "Load cell Recommendation package"
}`;

const licenseIssues = (dir: string) =>
  checkPackage(dir).filter(i => ['C144', 'C145', 'C146'].includes(i.check));

describe('license facets — parse', () => {
  it('parses license_key and license_holder into the manifest', () => {
    const m = readPackageManifest(manifestDir(LICENSED_MANIFEST));
    assert.equal(m.licenseKey, 'std:iec-60068-2-30');
    assert.equal(m.licenseHolder, 'IEC');
    assert.equal(m.licenseKeyDuplicates, undefined);
  });

  it('parses the camelCase alias forms (the scheme_type precedent)', () => {
    const m = readPackageManifest(
      manifestDir(`package {
  id p
  licenseKey "std:iec-60068-2-30"
  licenseHolder "IEC"
}`),
    );
    assert.equal(m.licenseKey, 'std:iec-60068-2-30');
    assert.equal(m.licenseHolder, 'IEC');
  });

  it('records the overwritten earlier declarations (the last wins)', () => {
    const m = readPackageManifest(
      manifestDir(`package {
  id p
  license_key "std:first-declared"
  license_key "std:iec-60068-2-30"
  license_holder "IEC"
}`),
    );
    assert.equal(m.licenseKey, 'std:iec-60068-2-30');
    assert.deepEqual(m.licenseKeyDuplicates, ['std:first-declared']);
  });

  it('a package without the facets carries neither field', () => {
    const m = readPackageManifest(manifestDir(PLAIN_MANIFEST));
    assert.equal(m.licenseKey, undefined);
    assert.equal(m.licenseHolder, undefined);
  });
});

describe('license facets — dump', () => {
  const reread = (text: string): PackageManifest => {
    const ctx = { packageManifest: null as PackageManifest | null };
    parsePackage(text)(ctx as never);
    return ctx.packageManifest as PackageManifest;
  };

  it('dumps the canonical quoted facet pair (after scheme_type)', () => {
    const m = readPackageManifest(
      manifestDir(`package {
  id p
  kind certification_program
  scheme_type type_5
  license_key "std:iec-60068-2-30"
  license_holder "IEC"
}`),
    );
    const out = dumpPackage(m);
    assert.match(out, / {2}license_key "std:iec-60068-2-30"\n/);
    assert.match(out, / {2}license_holder "IEC"\n/);
    // The emission site sits directly under the scheme_type line, the
    // sibling manifest facet.
    const schemeAt = out.indexOf('scheme_type');
    const keyAt = out.indexOf('license_key');
    const holderAt = out.indexOf('license_holder');
    assert.ok(0 < schemeAt && schemeAt < keyAt && keyAt < holderAt);
  });

  it('dump-fixpoints: parse → dump → parse → dump is byte-stable', () => {
    const once = dumpPackage(
      readPackageManifest(manifestDir(LICENSED_MANIFEST)),
    );
    const twice = dumpPackage(reread(once));
    assert.equal(twice, once);
    assert.match(once, /license_key "std:iec-60068-2-30"/);
    assert.match(once, /license_holder "IEC"/);
  });

  it('a package without the facets dumps byte-unchanged (no license lines)', () => {
    const once = dumpPackage(readPackageManifest(manifestDir(PLAIN_MANIFEST)));
    const twice = dumpPackage(reread(once));
    assert.equal(twice, once);
    assert.ok(!once.includes('license'));
    // The exact pre-facet dump — the facet pair must not perturb
    // unlicensed packages on the first load→dump cycle.
    assert.equal(
      once,
      `package {
  id oiml-r60
  kind rec
  title "OIML R 60:2021"
  version "2021"
  baseUrn "urn:oiml:pub:r:60:2021"
  description "Load cell Recommendation package"
}
`,
    );
  });

  it('the dump emits one license_key line even when the load saw duplicates', () => {
    const dup = `package {
  id p
  license_key "std:first-declared"
  license_key "std:iec-60068-2-30"
  license_holder "IEC"
}`;
    const once = dumpPackage(readPackageManifest(manifestDir(dup)));
    assert.equal(once.match(/license_key/g)?.length, 1);
    assert.match(once, /license_key "std:iec-60068-2-30"/);
  });
});

describe('license facets — the linter (C144–C146)', () => {
  it('a licensed package with both facets checks clean', () => {
    assert.deepEqual(licenseIssues(manifestDir(LICENSED_MANIFEST)), []);
  });

  it('C144: an uppercase key errors', () => {
    const dir = manifestDir(
      LICENSED_MANIFEST.replace('std:iec-60068-2-30', 'std:IEC-60068-2-30'),
    );
    const c144 = licenseIssues(dir).filter(i => i.check === 'C144');
    assert.equal(c144.length, 1);
    assert.equal(c144[0].severity, 'error');
    assert.match(
      c144[0].message,
      /license_key "std:IEC-60068-2-30" is not a catalog key/,
    );
    assert.match(c144[0].message, /license-key-shape/);
  });

  it('C144: a key with a space errors', () => {
    const dir = manifestDir(
      LICENSED_MANIFEST.replace('std:iec-60068-2-30', 'std:iec 60068 2 30'),
    );
    const c144 = licenseIssues(dir).filter(i => i.check === 'C144');
    assert.equal(c144.length, 1);
    assert.match(c144[0].message, /license-key-shape/);
  });

  it('C144: a key without the std: prefix errors', () => {
    const dir = manifestDir(
      LICENSED_MANIFEST.replace('std:iec-60068-2-30', 'iec-60068-2-30'),
    );
    const c144 = licenseIssues(dir).filter(i => i.check === 'C144');
    assert.equal(c144.length, 1);
    assert.match(c144[0].message, /license-key-shape/);
  });

  it('C145: a duplicate license_key errors; the last declaration wins the value', () => {
    const dir = manifestDir(`package {
  id p
  license_key "std:first-declared"
  license_key "std:iec-60068-2-30"
  license_holder "IEC"
}`);
    const c145 = licenseIssues(dir).filter(i => i.check === 'C145');
    assert.equal(c145.length, 1);
    assert.equal(c145[0].severity, 'error');
    assert.match(
      c145[0].message,
      /license_key declared again \("std:first-declared" before "std:iec-60068-2-30"\)/,
    );
    assert.match(c145[0].message, /license-key-unique/);
    assert.deepEqual(
      licenseIssues(dir).filter(i => i.check === 'C144'),
      [],
    );
  });

  it('C146: license_key without license_holder errors', () => {
    const bare = LICENSED_MANIFEST.replace('  license_holder "IEC"\n', '');
    const dir = manifestDir(bare);
    const c146 = licenseIssues(dir).filter(i => i.check === 'C146');
    assert.equal(c146.length, 1);
    assert.equal(c146[0].severity, 'error');
    assert.match(
      c146[0].message,
      /license_key "std:iec-60068-2-30" without a license_holder/,
    );
    assert.match(c146[0].message, /license-holder-required/);
  });

  it('a license_holder without a license_key stays legal (attribution, not a claim)', () => {
    const dir = manifestDir(`package {
  id p
  license_holder "IEC"
}`);
    assert.deepEqual(licenseIssues(dir), []);
  });
});
