// ─────────────────────────────────────────────────────────────────────
// Certification program packages (Primmel v3, smart TODO.v2/01 —
// analysis/twin-certification-design.md Q4). A fourth publisher with the
// product_reference shape ("Three publishers, one relation… nobody
// re-models anybody"): the scheme operator's program is related to recs
// (maps_to — the requirement vocabulary it certifies against) and
// product packages (pinned abstract imports, C83's edition-pin
// discipline) by mapping only — composed into nothing. Covers:
//   - the `kind certification_program` manifest + the program facets
//     (maps_to, scheme_type) and pinned `uses { <id>@<edition> }`
//     abstract imports — parse + dump round-trip;
//   - the linter rules
//       C97 program-maps-resolves
//       C98 program-surveillance-required
//   - the C83 pinned-import discipline applying to the program's
//     product imports exactly as for product_reference consumers;
//   - the C24 import-not-mapping exemption for the program's map_profile
//     to its pinned product import;
//   - the corpus-clean leg: the 23 shipped packages show zero errors and
//     zero C97/C98 issues (additive silence — no shipped package is a
//     certification_program).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  dumpPackage,
  parsePackage,
} from '../src/ser-des/config/packageManifest';
import { checkPackage } from '../src/check';
import type { PackageManifest } from '../src/types/Package';

// ── fixture helpers (the product-reference.test.ts idiom) ────────────

/** Write one package dir (manifest + content files) under `parent`. */
function writePackage(
  parent: string,
  id: string,
  manifest: string,
  files: Record<string, string> = {},
): string {
  const dir = join(parent, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.primmel'), manifest);
  for (const [rel, content] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return dir;
}

/** A parent dir holding the sibling set the supply-chain rules scan. */
function makeRepo(
  packages: Record<
    string,
    { manifest: string; files?: Record<string, string> }
  >,
): { parent: string; dir: (id: string) => string } {
  const parent = mkdtempSync(join(tmpdir(), 'primmel-cert-program-'));
  for (const [id, p] of Object.entries(packages)) {
    writePackage(parent, id, p.manifest, p.files ?? {});
  }
  return { parent, dir: id => join(parent, id) };
}

const R60_STUB = 'package { id oiml-r60 version "2021" editions { 2021 } }';

const ACME_MANIFEST = `package {
  id acme-lc500
  kind product_reference
  manufacturer "ACME Weighing GmbH"
  product "LC-500"
  version "2021"
  editions { 2021 }
  status current
  maps_to { oiml-r60 }
  description "ACME's LC-500 load cell — the product reference model (the twin declaration the program certifies)."
}`;

// The product twin declaration, as minimal as the program's pinned
// import needs it: one promised envelope the program's admission maps to.
const ACME_MODEL = `
quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg }
  unit kg { symbol "kg" kind mass factor 1 }
  kind dimensionless { si_unit "1" }
  unit dimensionless { label "dimensionless" kind dimensionless }
}

attribute_definition indication {
  quantity_kind mass
  unit kg
  scope sample
}

subject LC500 {
  is {
    metadata { name "LC-500 load cell model" }
    design_parameters { e_max : "500 kg" }
    promises {
      mpe_within {
        target error_hold
        level symbolic C6
        statement "Holds accuracy class C6 across the rated range."
        verified_by { oiml-r60#/req/metrological/mpe }
      }
    }
  }
  has {
    attributes { indication : mass test_dependent ref_load : mass test_dependent }
    characteristics { error_hold e = ocl{self.indication - self.ref_load} }
  }
}

requirement oiml-r60#/req/metrological/mpe {
  name "alias: R 60 maximum permissible errors"
  statement "Local alias of the Recommendation's MPE requirement."
  verification { method examination description "Verified in the Recommendation's own evaluation program." }
}

map_profile oiml-r60 {
  description "LC-500 → R 60: the manufacturer's conformance claim."
  mapping {
    mpe_within -> oiml-r60#/req/metrological/mpe {
      description "The class-limited error promise answers the MPE requirement."
      justification "Same quantity, same clause definition."
    }
  }
}
`;

const TWINCERT_MANIFEST = `package {
  id oiml-twin-cert
  kind certification_program
  scheme_type type_5
  version "2026"
  editions { 2026 }
  status current
  maps_to { oiml-r60 }
  uses { acme-lc500@2021 }
  description "The OIML digital-twin certification program — per-unit twin-fidelity evaluation with type test plus surveillance (ISO/IEC 17067 type 5, the design Q4)."
}`;

// A minimal lint-clean certification program: the twin subject under
// certification with its fidelity promise, the program requirement, the
// admit/surveil processes (surveil classified against the ISO/IEC 17000
// surveillance archetype — register-free here, C58 stays silent), the
// surveillance monitor (the continuous claim), and the map_profile to
// the pinned product import (C24-exempt).
const TWINCERT_MODEL = `
quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg }
  unit kg { symbol "kg" kind mass factor 1 }
  kind dimensionless { si_unit "1" }
  unit dimensionless { label "dimensionless" kind dimensionless }
}

subject TwinUnderCertification {
  is {
    metadata { name "Digital twin under certification" }
    design_parameters { fidelity_band : "0.1 kg" }
    promises {
      faithful_indication {
        target indication_delta
        level symbolic C6
        statement "The served indication stays within the certification band of the reference reading at every probe point."
        verified_by { /req/twin-fidelity/indication-band }
      }
    }
  }
  has {
    attributes { served : mass test_dependent ref_reading : mass test_dependent }
    characteristics { indication_delta d = ocl{self.served - self.ref_reading} }
  }
}

requirement /req/twin-fidelity/indication-band {
  name "Twin-fidelity indication band"
  statement "The twin's served indication stays within the certification band of the reference instrument's reading at every probe point."
  verification { method examination description "Probe evaluation over the served/reference channel pair." }
}

process admit { name "Admission to the program" }

process surveil {
  name "Surveillance of certified twins"
  activity_kind { surveillance }
}

process acme-lc500#mpe_within { name "alias: ACME class-C6 error promise" }

map_profile acme-lc500 {
  description "The program's admission mapped to the product twin declaration it certifies — coverage applies to the pinned import (doctrine §15.3)."
  mapping {
    admit -> acme-lc500#mpe_within {
      description "Admission prerequisites the instrument model's certified accuracy envelope (a valid type certificate)."
      justification "The twin certificate stands alone from type evaluation but prerequisites it (the design Q4)."
    }
  }
}

monitor fidelity_watch {
  over { TwinUnderCertification }
  triggers { every 1h }
  evaluate { requirements { /req/twin-fidelity/indication-band } promises all }
  emit { evidence -> workspace verdicts -> verdict_log }
  escalate { on fail { flag_certificate } }
}
`;

function makeProgramChain(): { parent: string; dir: (id: string) => string } {
  return makeRepo({
    'oiml-r60': { manifest: R60_STUB },
    'acme-lc500': {
      manifest: ACME_MANIFEST,
      files: { 'model/lc500.prl': ACME_MODEL },
    },
    'oiml-twin-cert': {
      manifest: TWINCERT_MANIFEST,
      files: { 'model/program.prl': TWINCERT_MODEL },
    },
  });
}

const issues = (dir: string, options?: Parameters<typeof checkPackage>[1]) =>
  checkPackage(dir, options).filter(i => !i.known);

// ── manifest: kind + program facets + uses pins ──────────────────────

describe('certification_program manifest — parse + dump', () => {
  it('parses kind, scheme_type, maps_to and a pinned uses entry', () => {
    const ctx: { packageManifest: PackageManifest | null } = {
      packageManifest: null,
    };
    parsePackage(TWINCERT_MANIFEST)(ctx as never);
    const m = ctx.packageManifest!;
    assert.equal(m.kind, 'certification_program');
    assert.equal(m.schemeType, 'type_5');
    assert.deepEqual(m.mapsTo, ['oiml-r60']);
    assert.deepEqual(m.uses, ['acme-lc500']);
    assert.deepEqual(m.usePins, { 'acme-lc500': '2021' });
  });

  it('round-trips through dumpPackage byte-stable (pins re-attached)', () => {
    const ctx: { packageManifest: PackageManifest | null } = {
      packageManifest: null,
    };
    parsePackage(TWINCERT_MANIFEST)(ctx as never);
    const dumped = dumpPackage(ctx.packageManifest!);
    const ctx2: { packageManifest: PackageManifest | null } = {
      packageManifest: null,
    };
    parsePackage(dumped)(ctx2 as never);
    assert.deepEqual(ctx2.packageManifest, ctx.packageManifest);
    assert.equal(dumped, dumpPackage(ctx2.packageManifest!));
  });
});

// ── C97 program-maps-resolves ────────────────────────────────────────

describe('C97 program-maps-resolves', () => {
  it('stays silent on the well-formed program package', () => {
    const repo = makeProgramChain();
    assert.deepEqual(
      issues(repo.dir('oiml-twin-cert')).filter(i => i.check === 'C97'),
      [],
    );
  });

  it('requires the maps_to register (a program that maps to nothing certifies nothing)', () => {
    const repo = makeRepo({
      'oiml-r60': { manifest: R60_STUB },
      'acme-lc500': {
        manifest: ACME_MANIFEST,
        files: { 'model/lc500.prl': ACME_MODEL },
      },
      'oiml-twin-cert': {
        manifest: TWINCERT_MANIFEST.replace('  maps_to { oiml-r60 }\n', ''),
        files: { 'model/program.prl': TWINCERT_MODEL },
      },
    });
    const c97 = issues(repo.dir('oiml-twin-cert')).filter(
      i => i.check === 'C97',
    );
    assert.equal(c97.length, 1);
    assert.equal(c97[0].severity, 'error');
    assert.ok(c97[0].message.includes('maps_to'));
    assert.ok(c97[0].message.includes('certifies nothing'));
  });

  it('flags a maps_to entry that resolves to no package', () => {
    const repo = makeRepo({
      'acme-lc500': {
        manifest: ACME_MANIFEST,
        files: { 'model/lc500.prl': ACME_MODEL },
      },
      'oiml-twin-cert': {
        manifest: TWINCERT_MANIFEST, // maps_to { oiml-r60 }, no sibling r60
        files: { 'model/program.prl': TWINCERT_MODEL },
      },
    });
    const c97 = issues(repo.dir('oiml-twin-cert')).filter(
      i => i.check === 'C97',
    );
    assert.ok(
      c97.some(
        i =>
          i.message.includes('maps_to "oiml-r60"') &&
          i.message.includes('does not resolve'),
      ),
    );
  });

  it('flags a maps_to entry that is itself a certification program', () => {
    const repo = makeRepo({
      'oiml-r60': { manifest: R60_STUB },
      'acme-lc500': {
        manifest: ACME_MANIFEST,
        files: { 'model/lc500.prl': ACME_MODEL },
      },
      'other-program': {
        manifest:
          'package { id other-program kind certification_program scheme_type type_5 maps_to { oiml-r60 } }',
      },
      'oiml-twin-cert': {
        manifest: TWINCERT_MANIFEST.replace(
          'maps_to { oiml-r60 }',
          'maps_to { oiml-r60 other-program }',
        ),
        files: { 'model/program.prl': TWINCERT_MODEL },
      },
    });
    const c97 = issues(repo.dir('oiml-twin-cert')).filter(
      i => i.check === 'C97',
    );
    assert.ok(
      c97.some(
        i =>
          i.message.includes('maps_to "other-program"') &&
          i.message.includes('never to another program'),
      ),
    );
  });

  it('flags a maps_to entry that is a product reference package (pinned imports, never maps_to)', () => {
    const repo = makeRepo({
      'oiml-r60': { manifest: R60_STUB },
      'acme-lc500': {
        manifest: ACME_MANIFEST,
        files: { 'model/lc500.prl': ACME_MODEL },
      },
      'oiml-twin-cert': {
        manifest: TWINCERT_MANIFEST.replace(
          'maps_to { oiml-r60 }',
          'maps_to { oiml-r60 acme-lc500 }',
        ),
        files: { 'model/program.prl': TWINCERT_MODEL },
      },
    });
    const c97 = issues(repo.dir('oiml-twin-cert')).filter(
      i => i.check === 'C97',
    );
    assert.ok(
      c97.some(
        i =>
          i.message.includes('maps_to "acme-lc500"') &&
          i.message.includes('pinned abstract imports'),
      ),
    );
  });
});

// ── C98 program-surveillance-required ────────────────────────────────

describe('C98 program-surveillance-required', () => {
  it('warns on type_1a declared alongside a monitor (the continuous claim)', () => {
    const repo = makeRepo({
      'oiml-r60': { manifest: R60_STUB },
      'acme-lc500': {
        manifest: ACME_MANIFEST,
        files: { 'model/lc500.prl': ACME_MODEL },
      },
      'oiml-twin-cert': {
        manifest: TWINCERT_MANIFEST.replace('type_5', 'type_1a'),
        files: { 'model/program.prl': TWINCERT_MODEL },
      },
    });
    const c98 = issues(repo.dir('oiml-twin-cert')).filter(
      i => i.check === 'C98',
    );
    assert.equal(c98.length, 1);
    assert.equal(c98[0].severity, 'warning');
    assert.ok(c98[0].message.includes('scheme_type "type_1a"'));
    assert.ok(c98[0].message.includes('monitor'));
    assert.ok(c98[0].message.includes('structurally'));
    assert.ok(c98[0].message.includes('type_5'));
    assert.ok(c98[0].message.includes('program-surveillance-required'));
  });

  it('warns on type_1b declared alongside a surveillance-classified process', () => {
    const repo = makeRepo({
      'oiml-r60': { manifest: R60_STUB },
      'acme-lc500': {
        manifest: ACME_MANIFEST,
        files: { 'model/lc500.prl': ACME_MODEL },
      },
      'oiml-twin-cert': {
        manifest: TWINCERT_MANIFEST.replace('type_5', 'type_1b'),
        files: {
          // No monitor — the surveillance claim is the surveil process's
          // activity_kind classification alone.
          'model/program.prl': TWINCERT_MODEL.replace(
            /\nmonitor fidelity_watch \{[\s\S]*?\n\}\n/,
            '\n',
          ),
        },
      },
    });
    const c98 = issues(repo.dir('oiml-twin-cert')).filter(
      i => i.check === 'C98',
    );
    assert.equal(c98.length, 1);
    assert.ok(c98[0].message.includes('scheme_type "type_1b"'));
    assert.ok(c98[0].message.includes('surveillance-classified process'));
    assert.ok(c98[0].message.includes('surveil'));
  });

  it('stays silent on type_5 with surveillance machinery (the well-formed program)', () => {
    const repo = makeProgramChain();
    assert.deepEqual(
      issues(repo.dir('oiml-twin-cert')).filter(i => i.check === 'C98'),
      [],
    );
  });

  it('stays silent on type_1a without surveillance machinery', () => {
    const repo = makeRepo({
      'oiml-r60': { manifest: R60_STUB },
      'oiml-twin-cert': {
        manifest: TWINCERT_MANIFEST.replace('type_5', 'type_1a').replace(
          '  uses { acme-lc500@2021 }\n',
          '',
        ),
        files: {
          'model/program.prl':
            'process admit { name "Admission to the program" }\n',
        },
      },
    });
    assert.deepEqual(
      issues(repo.dir('oiml-twin-cert')).filter(i => i.check === 'C98'),
      [],
    );
  });

  it('is kind-scoped: a non-program package with type_1a and a monitor is untouched', () => {
    const repo = makeRepo({
      'oiml-r60': { manifest: R60_STUB },
      'plain-pkg': {
        manifest:
          'package { id plain-pkg version "1" scheme_type type_1a maps_to { oiml-r60 } }',
        files: {
          'model/m.prl': `
quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg }
  unit kg { symbol "kg" kind mass factor 1 }
  kind dimensionless { si_unit "1" }
  unit dimensionless { label "dimensionless" kind dimensionless }
}

subject S {
  is {
    metadata { name "S" }
    promises {
      p1 {
        target c1
        level symbolic C6
        statement "x"
        verified_by { /req/r1 }
      }
    }
  }
  has {
    attributes { a1 : mass test_dependent }
    characteristics { c1 c = ocl{self.a1} }
  }
}

requirement /req/r1 {
  name "r1"
  statement "x"
  verification { method examination description "x" }
}

monitor w {
  over { S }
  triggers { every 1h }
  evaluate { requirements { /req/r1 } promises all }
  emit { evidence -> workspace verdicts -> verdict_log }
  escalate { on fail { flag_certificate } }
}
`,
        },
      },
    });
    assert.deepEqual(
      issues(repo.dir('plain-pkg')).filter(i => i.check === 'C98'),
      [],
    );
  });
});

// ── C83 abstract-import-pinned — the program's product imports ───────

describe('C83 abstract-import-pinned (the program leg)', () => {
  it('stays silent on the pinned abstract import', () => {
    const repo = makeProgramChain();
    assert.deepEqual(
      issues(repo.dir('oiml-twin-cert')).filter(i => i.check === 'C83'),
      [],
    );
  });

  it('errors on an unpinned import of a product reference package', () => {
    const repo = makeRepo({
      'oiml-r60': { manifest: R60_STUB },
      'acme-lc500': {
        manifest: ACME_MANIFEST,
        files: { 'model/lc500.prl': ACME_MODEL },
      },
      'oiml-twin-cert': {
        manifest: TWINCERT_MANIFEST.replace(
          'uses { acme-lc500@2021 }',
          'uses { acme-lc500 }',
        ),
        files: { 'model/program.prl': TWINCERT_MODEL },
      },
    });
    const c83 = issues(repo.dir('oiml-twin-cert')).filter(
      i => i.check === 'C83',
    );
    assert.equal(c83.length, 1);
    assert.equal(c83[0].severity, 'error');
    assert.ok(c83[0].message.includes('without a version pin'));
    assert.ok(c83[0].message.includes('abstract-import-pinned'));
  });

  it('errors on a pin outside the product package edition register', () => {
    const repo = makeRepo({
      'oiml-r60': { manifest: R60_STUB },
      'acme-lc500': {
        manifest: ACME_MANIFEST,
        files: { 'model/lc500.prl': ACME_MODEL },
      },
      'oiml-twin-cert': {
        manifest: TWINCERT_MANIFEST.replace(
          'uses { acme-lc500@2021 }',
          'uses { acme-lc500@2017 }',
        ),
        files: { 'model/program.prl': TWINCERT_MODEL },
      },
    });
    const c83 = issues(repo.dir('oiml-twin-cert')).filter(
      i => i.check === 'C83',
    );
    assert.equal(c83.length, 1);
    assert.ok(c83[0].message.includes('"2017"'));
    assert.ok(c83[0].message.includes('edition register'));
  });
});

// ── C24 import-not-mapping — the program's map to its pinned import ──

describe('C24 import-not-mapping — the program leg', () => {
  it('stays silent when the mapped namespace is the pinned product import', () => {
    const repo = makeProgramChain();
    assert.deepEqual(
      issues(repo.dir('oiml-twin-cert')).filter(i => i.check === 'C24'),
      [],
    );
  });
});

// ── the whole program chain is lint-clean at every level ─────────────

describe('the certification-program chain lints clean', () => {
  it('zero errors and zero warnings at default and --strict --audit', () => {
    const repo = makeProgramChain();
    for (const options of [
      {},
      { strictness: 'audit' as const, strict: true },
    ]) {
      const found = issues(repo.dir('oiml-twin-cert'), options);
      assert.deepEqual(
        found.map(i => `[${i.check}] ${i.severity}: ${i.message}`),
        [],
        `oiml-twin-cert at ${JSON.stringify(options)}`,
      );
    }
  });
});

// ── corpus-clean leg (additive silence — no shipped package is a
// certification_program) ─────────────────────────────────────────────

// The real corpus lives in the sibling smart repo checkout, which CI and
// fresh clones do not have — the corpus-clean spec then SKIPs gracefully.
// Set PRIMMEL_PACKAGES to a primmel-packages directory to enable it.
const CORPUS =
  process.env.PRIMMEL_PACKAGES ??
  '/Users/mulgogi/src/oimlsmart/smart/primmel-packages';
const CORPUS_AVAILABLE = existsSync(CORPUS);
const CORPUS_SKIP: string | false = CORPUS_AVAILABLE
  ? false
  : `no primmel-packages corpus at ${CORPUS} — set PRIMMEL_PACKAGES to enable the corpus-clean leg`;
if (!CORPUS_AVAILABLE) {
  console.log(
    `certification-program.test.ts: skipping the corpus-clean spec — ${CORPUS_SKIP}`,
  );
}

const PROGRAM_RULES = ['C97', 'C98'];

describe('corpus-clean leg (additive/OCP — the 23 shipped packages)', () => {
  it(
    'shows zero errors and zero program-rule issues across the corpus',
    { skip: CORPUS_SKIP },
    () => {
      const dirs = readdirSync(CORPUS)
        .map(d => join(CORPUS, d))
        .filter(d => existsSync(join(d, 'package.primmel')))
        .sort();
      assert.equal(
        dirs.length,
        25,
        `expected the 25-package corpus at ${CORPUS}`,
      );
      for (const dir of dirs) {
        const found = checkPackage(dir);
        const errors = found.filter(i => i.severity === 'error' && !i.known);
        assert.deepEqual(
          errors,
          [],
          `${dir}: expected zero errors, got: ${errors.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
        );
        assert.deepEqual(
          found.filter(i => PROGRAM_RULES.includes(i.check)),
          [],
          `${dir}: a package that is no certification_program must show no program-rule issues`,
        );
      }
    },
  );
});
