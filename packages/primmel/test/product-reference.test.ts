// ─────────────────────────────────────────────────────────────────────
// Product reference packages (Primmel v3, TODO.roadmap/36 — doctrine
// ch. 15, the model supply chain). Covers:
//   - the `kind product_reference` manifest + the supply-chain facets
//     (manufacturer, product, maps_to) and the `uses { <id>@<edition> }`
//     abstract-import version pins — parse + dump round-trip;
//   - the composer's reference-only edge: an abstract import is located
//     and id-checked but NEVER content-merged or traversed;
//   - the linter rules
//       C81 product-maps-resolves
//       C82 product-unmapped-promises
//       C83 abstract-import-pinned
//   - the C24 import-not-mapping exemption: mode-1 consumption of a
//     product reference package IS a mapping (doctrine §15.3);
//   - componentIds: the subject anatomy members (design parameters,
//     attributes, characteristics, behaviors, endpoint + promise ids)
//     are legal mapping endpoints.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  dumpPackage,
  parsePackage,
} from '../src/ser-des/config/packageManifest';
import { loadPackageWithIssues } from '../src/ser-des/package';
import { checkPackage } from '../src/check';
import type { PackageManifest } from '../src/types/Package';

// ── fixture helpers ──────────────────────────────────────────────────

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
  packages: Record<string, { manifest: string; files?: Record<string, string> }>,
): { parent: string; dir: (id: string) => string } {
  const parent = mkdtempSync(join(tmpdir(), 'primmel-supply-chain-'));
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
  description "ACME's LC-500 load cell — the product reference model, mapped aspect-by-aspect to R 60 (doctrine ch. 15)."
}`;

// A minimal lint-clean product model: one subject with a promised
// envelope, the R 60 aliases it cites, and the map_profile that makes
// the conformance claim computable.
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

behavior creep {
  kind temporal
  stimulus force
  response "Change in output with time under constant load."
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
      creep_c6 {
        target creep
        statement "Creep stays within the class C6 envelope over the 30-minute test."
        verified_by { oiml-r60#/req/metrological/creep }
      }
    }
  }
  has {
    attributes { indication : mass test_dependent ref_load : mass test_dependent }
    characteristics { error_hold e = ocl{self.indication - self.ref_load} }
  }
  does {
    behavior creep
  }
}

requirement oiml-r60#/req/metrological/mpe {
  name "alias: R 60 maximum permissible errors"
  statement "Local alias of the Recommendation's MPE requirement (the implementation declares local copies of the reference elements it maps to — C21)."
  verification { method examination description "Verified in the Recommendation's own evaluation program." }
}

requirement oiml-r60#/req/metrological/creep {
  name "alias: R 60 creep requirement"
  statement "Local alias of the Recommendation's creep requirement."
  verification { method examination description "Verified in the Recommendation's own evaluation program." }
}

map_profile oiml-r60 {
  description "LC-500 → R 60: the manufacturer's conformance claim, made computable."
  mapping {
    mpe_within -> oiml-r60#/req/metrological/mpe {
      description "The class-limited error promise answers the MPE requirement."
      justification "Same quantity, same clause definition."
    }
    creep_c6 -> oiml-r60#/req/metrological/creep {
      description "The creep promise answers the creep requirement."
      justification "The characteristic quantifies the behavior the test exercises."
    }
    e_max -> oiml-r60#/req/metrological/mpe {
      description "Our E_max is R 60's E_max."
      justification "Same quantity, same clause definition (doctrine §15.2)."
    }
  }
}
`;

const QUARRY_MANIFEST = `package {
  id quarry-belt-scale
  version "1.0.0"
  uses { acme-lc500@2021 }
  description "The quarry's weighing operations — consumes the LC-500 product model as an abstract import (pinned edition)."
}`;

const QUARRY_MODEL = `
quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg }
  unit kg { symbol "kg" kind mass factor 1 }
  kind dimensionless { si_unit "1" }
  unit dimensionless { label "dimensionless" kind dimensionless }
}

role ia_officer {
  label "inspection authority officer"
}

subject QuarryBeltScale {
  is {
    metadata { name "Quarry belt-scale installation" }
    design_parameters { capacity : "400 kg" }
    promises {
      capacity_within_emax {
        target capacity_hold
        level range { min 0 max 500 unit kg }
        statement "The rated capacity stays within the cell's E_max envelope (as-certified reference content, pinned edition 2021)."
        verified_by { /req/ops/design-review }
      }
    }
  }
  has {
    attributes { throughput : mass test_dependent }
    characteristics { capacity_hold c_cap = ocl{self.throughput} }
  }
}

requirement /req/ops/design-review {
  name "Design review against the product reference model"
  statement "The installation is designed against the LC-500's promised envelope (capacity within E_max) — validated at design time over the pinned abstract import."
  verification { method examination description "Design-time review of the installation model against the imported product reference content." }
}

process batch_weighing { name "Batch weighing" }

process acme-lc500#mpe_within { name "alias: ACME class-C6 error promise" }
process acme-lc500#e_max { name "alias: ACME E_max design parameter" }

map_profile acme-lc500 {
  description "The quarry's usage mapped to the LC-500's promised aspects — coverage applies to the import (doctrine §15.3)."
  mapping {
    batch_weighing -> acme-lc500#mpe_within {
      description "The batch process runs within the cell's certified MPE envelope."
      justification "The operation consumes the as-certified accuracy promise."
    }
    capacity_within_emax -> acme-lc500#e_max {
      description "The scale's capacity is within the cell's E_max."
      justification "Design-time integration against the promised envelope (§15.3)."
    }
  }
}

monitor batch_watch {
  over { QuarryBeltScale }
  triggers { every 1h }
  evaluate { requirements { /req/ops/design-review } promises all }
  emit { evidence -> workspace verdicts -> verdict_log }
  escalate { on fail { flag_certificate } }
}
`;

function makeSupplyChain(): { parent: string; dir: (id: string) => string } {
  return makeRepo({
    'oiml-r60': { manifest: R60_STUB },
    'acme-lc500': {
      manifest: ACME_MANIFEST,
      files: { 'model/lc500.prl': ACME_MODEL },
    },
    'quarry-belt-scale': {
      manifest: QUARRY_MANIFEST,
      files: { 'model/ops.prl': QUARRY_MODEL },
    },
  });
}

const issues = (dir: string, options?: Parameters<typeof checkPackage>[1]) =>
  checkPackage(dir, options).filter(i => !i.known);

// ── manifest: kind + supply-chain facets + uses pins ─────────────────

describe('product_reference manifest — parse + dump', () => {
  it('parses kind, manufacturer, product, maps_to and a pinned uses entry', () => {
    const ctx: { packageManifest: PackageManifest | null } = {
      packageManifest: null,
    };
    parsePackage(ACME_MANIFEST)(ctx as never);
    const m = ctx.packageManifest!;
    assert.equal(m.kind, 'product_reference');
    assert.equal(m.manufacturer, 'ACME Weighing GmbH');
    assert.equal(m.product, 'LC-500');
    assert.deepEqual(m.mapsTo, ['oiml-r60']);

    const ctx2: { packageManifest: PackageManifest | null } = {
      packageManifest: null,
    };
    parsePackage(QUARRY_MANIFEST)(ctx2 as never);
    const q = ctx2.packageManifest!;
    assert.deepEqual(q.uses, ['acme-lc500']);
    assert.deepEqual(q.usePins, { 'acme-lc500': '2021' });
  });

  it('round-trips through dumpPackage byte-stable (pins re-attached)', () => {
    for (const src of [ACME_MANIFEST, QUARRY_MANIFEST]) {
      const ctx: { packageManifest: PackageManifest | null } = {
        packageManifest: null,
      };
      parsePackage(src)(ctx as never);
      const dumped = dumpPackage(ctx.packageManifest!);
      const ctx2: { packageManifest: PackageManifest | null } = {
        packageManifest: null,
      };
      parsePackage(dumped)(ctx2 as never);
      assert.deepEqual(ctx2.packageManifest, ctx.packageManifest);
      assert.equal(dumped, dumpPackage(ctx2.packageManifest!));
    }
  });

  it('malformed version pins are parse errors naming the form', () => {
    for (const bad of ['acme-lc500@', '@2021', 'acme-lc500@20@21']) {
      assert.throws(
        () => parsePackage(`package { id m uses { ${bad} } }`),
        /malformed uses entry.*<package-id>@<edition>/,
      );
    }
  });
});

// ── the composer's reference-only edge ───────────────────────────────

describe('abstract import — reference-only composition', () => {
  it('locates and id-checks the product package but never merges it', () => {
    const repo = makeSupplyChain();
    const locator = (id: string) =>
      ['acme-lc500', 'oiml-r60', 'quarry-belt-scale'].includes(id)
        ? repo.dir(id)
        : undefined;
    const { standard, issues: loadIssues, composition } =
      loadPackageWithIssues(repo.dir('quarry-belt-scale'), {
        resolvePackage: locator,
      });
    assert.deepEqual(
      loadIssues.filter(i => i.severity === 'error'),
      [],
      'no composition errors',
    );
    // The product package is NOT in the merge order …
    assert.deepEqual(composition?.order, ['quarry-belt-scale']);
    // … and none of its content landed in the composed model.
    assert.equal(
      standard.subjects?.some(s => s.id === 'LC500'),
      false,
      'the LC500 subject is cited, never included',
    );
    assert.equal(
      standard.requirements?.some(r => r.id.startsWith('oiml-r60#')),
      false,
      'the product-side aliases are not included either',
    );
    // The consumer's own content loads fine.
    assert.ok(standard.subjects?.some(s => s.id === 'QuarryBeltScale'));
  });
});

// ── C81 product-maps-resolves ────────────────────────────────────────

describe('C81 product-maps-resolves', () => {
  it('stays silent on the well-formed product package', () => {
    const repo = makeSupplyChain();
    assert.deepEqual(
      issues(repo.dir('acme-lc500')).filter(i => i.check === 'C81'),
      [],
    );
  });

  it('requires manufacturer, product designation and maps_to', () => {
    const repo = makeRepo({
      'oiml-r60': { manifest: R60_STUB },
      'acme-lc500': {
        manifest:
          'package { id acme-lc500 kind product_reference version "2021" }',
        files: { 'model/m.prl': ACME_MODEL },
      },
    });
    const c81 = issues(repo.dir('acme-lc500')).filter(i => i.check === 'C81');
    assert.ok(c81.some(i => i.message.includes('manufacturer')));
    assert.ok(c81.some(i => i.message.includes('product designation')));
    assert.ok(c81.some(i => i.message.includes('maps_to')));
    assert.equal(c81.every(i => i.severity === 'error'), true);
  });

  it('flags a maps_to entry that resolves to no package', () => {
    const repo = makeRepo({
      'acme-lc500': {
        manifest: ACME_MANIFEST, // maps_to { oiml-r60 }, no sibling r60
        files: { 'model/m.prl': ACME_MODEL },
      },
    });
    const c81 = issues(repo.dir('acme-lc500')).filter(i => i.check === 'C81');
    assert.ok(
      c81.some(
        i =>
          i.message.includes('maps_to "oiml-r60"') &&
          i.message.includes('does not resolve'),
      ),
    );
  });

  it('flags a maps_to entry that is itself a product reference package', () => {
    const repo = makeRepo({
      'other-product': {
        manifest:
          'package { id other-product kind product_reference manufacturer "X" product "Y" maps_to { oiml-r60 } }',
      },
      'oiml-r60': { manifest: R60_STUB },
      'acme-lc500': {
        manifest: ACME_MANIFEST.replace(
          'maps_to { oiml-r60 }',
          'maps_to { oiml-r60 other-product }',
        ),
        files: { 'model/m.prl': ACME_MODEL },
      },
    });
    const c81 = issues(repo.dir('acme-lc500')).filter(i => i.check === 'C81');
    assert.ok(
      c81.some(
        i =>
          i.message.includes('maps_to "other-product"') &&
          i.message.includes('never to another product'),
      ),
    );
    // … and the entry has no map_profile either — both legs fire.
    assert.ok(
      c81.some(
        i =>
          i.message.includes('maps_to "other-product"') &&
          i.message.includes('never maps to'),
      ),
    );
  });

  it('flags a map_profile the manifest does not declare in maps_to', () => {
    const repo = makeRepo({
      'oiml-r60': { manifest: R60_STUB },
      'acme-lc500': {
        manifest: ACME_MANIFEST,
        files: {
          'model/m.prl':
            ACME_MODEL +
            '\nmap_profile oiml-r91 { mapping { e_max -> oiml-r91#x } }\n',
        },
      },
    });
    const c81 = issues(repo.dir('acme-lc500')).filter(i => i.check === 'C81');
    assert.ok(
      c81.some(
        i =>
          i.message.includes('map_profile oiml-r91') &&
          i.message.includes('does not declare'),
      ),
    );
  });
});

// ── C82 product-unmapped-promises ────────────────────────────────────

describe('C82 product-unmapped-promises', () => {
  it('warns on a promise no mapping sources (a brochure claim)', () => {
    const repo = makeRepo({
      'oiml-r60': { manifest: R60_STUB },
      'acme-lc500': {
        manifest: ACME_MANIFEST,
        files: {
          'model/m.prl': ACME_MODEL.replace(
            '      creep_c6 {\n        target creep',
            '      creep_c6 {\n        target creep',
          ).replace(
            '    creep_c6 -> oiml-r60#/req/metrological/creep {',
            '    e_max2_missing -> oiml-r60#/req/metrological/creep {',
          ),
        },
      },
    });
    const c82 = issues(repo.dir('acme-lc500')).filter(i => i.check === 'C82');
    assert.equal(c82.length, 1);
    assert.equal(c82[0].severity, 'warning');
    assert.ok(c82[0].message.includes('promise "creep_c6"'));
    assert.ok(c82[0].message.includes('product-unmapped-promises'));
  });

  it('stays silent when every block-form promise is mapped', () => {
    const repo = makeSupplyChain();
    assert.deepEqual(
      issues(repo.dir('acme-lc500')).filter(i => i.check === 'C82'),
      [],
    );
  });

  it('ignores statement-only shorthand promises and non-product packages', () => {
    const repo = makeRepo({
      'oiml-r60': { manifest: R60_STUB },
      'acme-lc500': {
        manifest: ACME_MANIFEST,
        files: {
          'model/m.prl': ACME_MODEL.replace(
            '    }\n  }\n  has {',
            '      "a prose claim, unmappable by id"\n    }\n  }\n  has {',
          ),
        },
      },
      // A non-product package with unmapped promises: C82 does not apply.
      'plain-pkg': {
        manifest: 'package { id plain-pkg version "1" }',
        files: {
          'model/m.prl':
            'subject S { is { promises { unattainable { target nothing statement "x" verified_by { } } } } }',
        },
      },
    });
    const c82acme = issues(repo.dir('acme-lc500')).filter(
      i => i.check === 'C82',
    );
    assert.deepEqual(c82acme, []);
    const c82plain = issues(repo.dir('plain-pkg')).filter(
      i => i.check === 'C82',
    );
    assert.deepEqual(c82plain, []);
  });
});

// ── C83 abstract-import-pinned ───────────────────────────────────────

describe('C83 abstract-import-pinned', () => {
  it('stays silent on the pinned abstract import', () => {
    const repo = makeSupplyChain();
    assert.deepEqual(
      issues(repo.dir('quarry-belt-scale')).filter(i => i.check === 'C83'),
      [],
    );
  });

  it('errors on an unpinned import of a product reference package', () => {
    const repo = makeRepo({
      'oiml-r60': { manifest: R60_STUB },
      'acme-lc500': {
        manifest: ACME_MANIFEST,
        files: { 'model/m.prl': ACME_MODEL },
      },
      'quarry-belt-scale': {
        manifest: QUARRY_MANIFEST.replace(
          'uses { acme-lc500@2021 }',
          'uses { acme-lc500 }',
        ),
        files: { 'model/ops.prl': QUARRY_MODEL },
      },
    });
    const c83 = issues(repo.dir('quarry-belt-scale')).filter(
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
        files: { 'model/m.prl': ACME_MODEL },
      },
      'quarry-belt-scale': {
        manifest: QUARRY_MANIFEST.replace(
          'uses { acme-lc500@2021 }',
          'uses { acme-lc500@2017 }',
        ),
        files: { 'model/ops.prl': QUARRY_MODEL },
      },
    });
    const c83 = issues(repo.dir('quarry-belt-scale')).filter(
      i => i.check === 'C83',
    );
    assert.equal(c83.length, 1);
    assert.ok(c83[0].message.includes('"2017"'));
    assert.ok(c83[0].message.includes('edition register'));
  });

  it('leaves unpinned edges to non-product packages alone', () => {
    const repo = makeRepo({
      'toy-core': { manifest: 'package { id toy-core version "1" }' },
      'toy-rec': {
        manifest: 'package { id toy-rec version "1" uses { toy-core } }',
      },
    });
    assert.deepEqual(
      issues(repo.dir('toy-rec')).filter(i => i.check === 'C83'),
      [],
    );
  });
});

// ── C24 exemption + componentIds ─────────────────────────────────────

describe('C24 import-not-mapping — the product_reference exemption', () => {
  it('stays silent when the mapped namespace is an abstract import', () => {
    const repo = makeSupplyChain();
    assert.deepEqual(
      issues(repo.dir('quarry-belt-scale')).filter(i => i.check === 'C24'),
      [],
    );
  });

  it('still errors when the mapped namespace is an ordinary import', () => {
    const repo = makeRepo({
      'toy-core': { manifest: 'package { id toy-core version "1" }' },
      'toy-rec': {
        manifest: 'package { id toy-rec version "1" uses { toy-core } }',
        files: {
          'model/m.prl': `
            process OpA { name "A" }
            process toy-core#P { name "alias" }
            map_profile toy-core { mapping { OpA -> toy-core#P { description "d" } } }
          `,
        },
      },
    });
    const c24 = issues(repo.dir('toy-rec')).filter(i => i.check === 'C24');
    assert.equal(c24.length, 1);
    assert.ok(c24[0].message.includes('import-not-mapping'));
  });
});

describe('componentIds — subject anatomy members are mapping endpoints', () => {
  it('a design parameter, a characteristic and a promise id are legal sources', () => {
    const repo = makeSupplyChain();
    // The ACME model maps mpe_within (promise), creep_c6 (promise) and
    // e_max (design parameter) — C21 must stay silent on all of them.
    assert.deepEqual(
      issues(repo.dir('acme-lc500')).filter(i => i.check === 'C21'),
      [],
    );
    // The quarry maps capacity_within_emax (its own promise id).
    assert.deepEqual(
      issues(repo.dir('quarry-belt-scale')).filter(i => i.check === 'C21'),
      [],
    );
  });
});

// ── the whole supply chain is lint-clean at every level ──────────────

describe('the supply-chain pilot lints clean', () => {
  it('zero errors and zero warnings at default and --strict --audit', () => {
    const repo = makeSupplyChain();
    for (const id of ['acme-lc500', 'quarry-belt-scale']) {
      for (const options of [
        {},
        { strictness: 'audit' as const, strict: true },
      ]) {
        const found = issues(repo.dir(id), options);
        assert.deepEqual(
          found.map(i => `[${i.check}] ${i.severity}: ${i.message}`),
          [],
          `${id} at ${JSON.stringify(options)}`,
        );
      }
    }
  });
});
