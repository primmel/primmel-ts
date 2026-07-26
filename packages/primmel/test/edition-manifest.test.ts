// ─────────────────────────────────────────────────────────────────────
// Edition manifest tests (TODO.roadmap/28; doctrine ch. 13 §13.4/§13.7):
// the lifecycle fields (supersedes/replaces, validity windows, status)
// parse and dump on the package manifest — packaging, never subject
// models — and the linter rules C77–C80 validate them, including the
// INV-8 pin resolution against the edition register. Seeded invalid
// manifests included.
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

function manifestDir(body: string, content?: { name: string; text: string }[]): string {
  // Each fixture gets its OWN parent dir: the C79 sibling scan reads the
  // parent's subdirectories, so fixtures must not see each other.
  const parent = mkdtempSync(join(tmpdir(), 'primmel-ed-'));
  const dir = join(parent, 'pkg');
  mkdirSync(dir);
  writeFileSync(join(dir, 'package.primmel'), body);
  for (const c of content ?? []) {
    mkdirSync(join(dir, 'model'), { recursive: true });
    writeFileSync(join(dir, 'model', c.name), c.text);
  }
  return dir;
}

const VALID_MANIFEST = `package {
  id oiml-r60
  kind rec
  title "OIML R 60:2021"
  version "2021"
  editions { 2021 2017 2000 1996 }
  baseUrn "urn:oiml:pub:r:60:2021"
  supersedes urn:oiml:pub:r:60:2017
  validity { from 2021-01-01 }
  status current
  description "Load cell Recommendation package"
}`;

const SAMPLE_INSTANCE = `instance smp-1 {
  of LoadCell
  level sample
  definition_versions { LoadCell : "2021" }
}`;

describe('edition manifest — parse + dump round-trip', () => {
  it('parses supersedes/replaces/validity/status', () => {
    const m = readPackageManifest(manifestDir(VALID_MANIFEST));
    assert.deepEqual(m.supersedes, ['urn:oiml:pub:r:60:2017']);
    assert.deepEqual(m.validity, { from: '2021-01-01' });
    assert.equal(m.status, 'current');
  });

  it('parses the list form and the validity to-bound', () => {
    const m = readPackageManifest(
      manifestDir(`package {
  id p
  version "2"
  editions { 2 1 }
  baseUrn "urn:p:2"
  supersedes { urn:p:1 urn:p:0 }
  replaces { urn:q:9 }
  validity { from 2021-01-01 to 2026-12-31 }
  status superseded
  description "d"
}`),
    );
    assert.deepEqual(m.supersedes, ['urn:p:1', 'urn:p:0']);
    assert.deepEqual(m.replaces, ['urn:q:9']);
    assert.deepEqual(m.validity, { from: '2021-01-01', to: '2026-12-31' });
    assert.equal(m.status, 'superseded');
  });

  it('dump → parse round-trips the lifecycle fields', () => {
    const m = readPackageManifest(manifestDir(VALID_MANIFEST));
    const text = dumpPackage(m);
    assert.match(text, /supersedes \{ urn:oiml:pub:r:60:2017 \}/);
    assert.match(text, /validity \{ from 2021-01-01 \}/);
    assert.match(text, /status current/);
    const ctx = { packageManifest: null as PackageManifest | null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsePackage(text)(ctx as any);
    assert.deepEqual(ctx.packageManifest?.supersedes, m.supersedes);
    assert.deepEqual(ctx.packageManifest?.validity, m.validity);
    assert.equal(ctx.packageManifest?.status, m.status);
  });

  it('a manifest without lifecycle fields parses with them absent', () => {
    const m = readPackageManifest(
      manifestDir('package { id p version "1" editions { 1 } baseUrn "urn:p:1" description "d" }'),
    );
    assert.equal(m.supersedes, undefined);
    assert.equal(m.validity, undefined);
    assert.equal(m.status, undefined);
  });

  it('an unknown status token is a parse error (like kind)', () => {
    assert.throws(
      () =>
        readPackageManifest(
          manifestDir('package { id p version "1" editions { 1 } baseUrn "urn:p:1" status bogus description "d" }'),
        ),
      /Expected status current\|preview\|superseded\|withdrawn/,
    );
  });
});

describe('edition lifecycle lint — valid packages stay clean', () => {
  it('no C77–C80/C85 findings on the valid manifest', () => {
    const dir = manifestDir(VALID_MANIFEST, [
      { name: 'instances.prl', text: SAMPLE_INSTANCE },
    ]);
    const issues = checkPackage(dir).filter(i =>
      ['C77', 'C78', 'C79', 'C80', 'C85'].includes(i.check),
    );
    assert.deepEqual(issues, []);
  });
});

describe('edition lifecycle lint — seeded invalid manifests', () => {
  it('C77: status current but version is not the register’s newest', () => {
    const dir = manifestDir(`package {
  id p
  version "2017"
  editions { 2021 2017 }
  baseUrn "urn:p:2017"
  status current
  description "d"
}`);
    const c77 = checkPackage(dir).filter(i => i.check === 'C77');
    assert.equal(c77.length, 1);
    assert.equal(c77[0].severity, 'error');
    assert.match(c77[0].message, /not the edition register's newest entry \(2021\)/);
  });

  it('C85: a malformed baseUrn errors; a well-formed one stays clean (task-27c review Important 1)', () => {
    const bad = manifestDir(`package {
  id p
  version "1"
  editions { 1 }
  baseUrn "urn:bad urn"
  description "d"
}`);
    const c85bad = checkPackage(bad).filter(i => i.check === 'C85');
    assert.equal(c85bad.length, 1);
    assert.equal(c85bad[0].severity, 'error');
    assert.match(
      c85bad[0].message,
      /baseUrn "urn:bad urn" is not a well-formed IRI/,
    );
    const good = manifestDir(`package {
  id p
  version "1"
  editions { 1 }
  baseUrn "urn:oiml:pub:r:60:2021"
  description "d"
}`);
    assert.deepEqual(
      checkPackage(good).filter(i => i.check === 'C85'),
      [],
    );
    // No baseUrn at all: the field is optional in the manifest — silent.
    const absent = manifestDir(`package {
  id p
  version "1"
  editions { 1 }
  description "d"
}`);
    assert.deepEqual(
      checkPackage(absent).filter(i => i.check === 'C85'),
      [],
    );
  });

  it('C78: malformed window and a to before from', () => {
    const bad = manifestDir(`package {
  id p
  version "1"
  editions { 1 }
  baseUrn "urn:p:1"
  validity { from 2021-13-99 }
  description "d"
}`);
    const c78bad = checkPackage(bad).filter(i => i.check === 'C78');
    assert.equal(c78bad.length, 1);
    assert.match(c78bad[0].message, /not an ISO 8601 date\/datetime/);
    const inverted = manifestDir(`package {
  id p
  version "1"
  editions { 1 }
  baseUrn "urn:p:1"
  validity { from 2026-01-01 to 2021-01-01 }
  description "d"
}`);
    const c78inv = checkPackage(inverted).filter(i => i.check === 'C78');
    assert.equal(c78inv.length, 1);
    assert.match(c78inv[0].message, /before from/);
  });

  it('C78: window bounds compare as INSTANTS, not lexicographically', () => {
    // The review's L2 case: a mixed date/datetime pair at the SAME moment
    // (from 2021-01-01T00:00:00Z, to 2021-01-01) must NOT false-positive —
    // string order says '2021-01-01' < '2021-01-01T00:00:00Z'.
    const sameInstant = manifestDir(`package {
  id p
  version "1"
  editions { 1 }
  baseUrn "urn:p:1"
  validity { from 2021-01-01T00:00:00Z to 2021-01-01 }
  description "d"
}`);
    assert.deepEqual(
      checkPackage(sameInstant).filter(i => i.check === 'C78'),
      [],
    );
    // A genuinely inverted mixed pair still fires.
    const inverted = manifestDir(`package {
  id p
  version "1"
  editions { 1 }
  baseUrn "urn:p:1"
  validity { from 2021-01-02 to 2021-01-01T12:00:00Z }
  description "d"
}`);
    const c78 = checkPackage(inverted).filter(i => i.check === 'C78');
    assert.equal(c78.length, 1);
    assert.match(c78[0].message, /before from/);
    // Zone offsets are honored: 12:00+02:00 is 10:00Z — before 11:00Z.
    const zoned = manifestDir(`package {
  id p
  version "1"
  editions { 1 }
  baseUrn "urn:p:1"
  validity { from 2021-01-01T11:00:00Z to 2021-01-01T12:00:00+02:00 }
  description "d"
}`);
    const c78z = checkPackage(zoned).filter(i => i.check === 'C78');
    assert.equal(c78z.length, 1);
    assert.match(c78z[0].message, /before from/);
  });

  it('C79: non-URN target, self-supersession, register incoherence', () => {
    const nonUrn = manifestDir(`package {
  id p
  version "2"
  editions { 2 1 }
  baseUrn "urn:p:2"
  supersedes r-60-2017
  description "d"
}`);
    const c79 = checkPackage(nonUrn).filter(i => i.check === 'C79');
    assert.equal(c79.length, 1);
    assert.match(c79[0].message, /is not a URN/);

    const self = manifestDir(`package {
  id p
  version "2"
  editions { 2 1 }
  baseUrn "urn:p:2"
  supersedes urn:p:2
  description "d"
}`);
    const c79self = checkPackage(self).filter(i => i.check === 'C79');
    assert.equal(c79self.length, 1);
    assert.match(c79self[0].message, /cannot supersedes itself|cannot supersede itself/);

    const incoherent = manifestDir(`package {
  id p
  version "2"
  editions { 2 1 }
  baseUrn "urn:p:2"
  supersedes urn:p:0
  description "d"
}`);
    const c79inc = checkPackage(incoherent).filter(i => i.check === 'C79');
    assert.equal(c79inc.length, 1);
    assert.equal(c79inc[0].severity, 'warning');
    assert.match(c79inc[0].message, /does not list 0/);
  });

  it('C79: the supersedes graph across sibling manifests is acyclic', () => {
    const parent = mkdtempSync(join(tmpdir(), 'primmel-ed-cycle-'));
    mkdirSync(join(parent, 'x'));
    mkdirSync(join(parent, 'y'));
    writeFileSync(
      join(parent, 'x', 'package.primmel'),
      'package { id x version "1" editions { 1 } baseUrn "urn:x:1" supersedes urn:y:1 description "d" }',
    );
    writeFileSync(
      join(parent, 'y', 'package.primmel'),
      'package { id y version "1" editions { 1 } baseUrn "urn:y:1" supersedes urn:x:1 description "d" }',
    );
    const c79 = checkPackage(join(parent, 'x')).filter(i => i.check === 'C79');
    assert.equal(c79.length, 1);
    assert.match(c79[0].message, /supersedes cycle: urn:x:1 → urn:y:1 → urn:x:1/);

    // …and a legal one-way chain across siblings is clean.
    const parent2 = mkdtempSync(join(tmpdir(), 'primmel-ed-chain-'));
    mkdirSync(join(parent2, 'x'));
    mkdirSync(join(parent2, 'y'));
    writeFileSync(
      join(parent2, 'x', 'package.primmel'),
      'package { id x version "2" editions { 2 1 } baseUrn "urn:x:2" supersedes urn:y:1 description "d" }',
    );
    writeFileSync(
      join(parent2, 'y', 'package.primmel'),
      'package { id y version "1" editions { 1 } baseUrn "urn:y:1" description "d" }',
    );
    const clean = checkPackage(join(parent2, 'x')).filter(i => i.check === 'C79');
    assert.deepEqual(clean, []);
  });

  it('C80 (INV-8): a pin naming no declared edition fails; a register pin passes', () => {
    const bad = manifestDir(VALID_MANIFEST, [
      {
        name: 'instances.prl',
        text: `instance smp-1 {
  of LoadCell
  level sample
  definition_versions { LoadCell : "1999" }
}`,
      },
    ]);
    const c80 = checkPackage(bad).filter(i => i.check === 'C80');
    assert.equal(c80.length, 1);
    assert.equal(c80[0].severity, 'error');
    assert.match(c80[0].message, /"1999" does not resolve against the edition register/);

    const good = manifestDir(VALID_MANIFEST, [
      {
        name: 'instances.prl',
        text: `instance smp-1 {
  of LoadCell
  level sample
  definition_versions { LoadCell : "2017" }
}`,
      },
    ]);
    const c80good = checkPackage(good).filter(i => i.check === 'C80');
    assert.deepEqual(c80good, []);
  });

  it('C80 is silent on a register-less package (C18 still requires pins)', () => {
    const dir = manifestDir(
      'package { id p description "d" }',
      [
        {
          name: 'instances.prl',
          text: `instance smp-1 {
  of LoadCell
  level sample
  definition_versions { LoadCell : "anything" }
}`,
        },
      ],
    );
    const c80 = checkPackage(dir).filter(i => i.check === 'C80');
    assert.deepEqual(c80, []);
  });
});
