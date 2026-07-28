// ─────────────────────────────────────────────────────────────────────
// The probe-channel provenance facet on conformance-test variables
// (Primmel v3, smart TODO.v2/01 TCD-2 —
// analysis/twin-certification-design.md Q2). A measured reference
// variable declares the physical-side channel its reading arrives by —
// the three-source vocabulary:
//   reference_instrument   a traceable reference, cited by
//                          equipment-register id (PREFERRED);
//   observer_attestation   a verification officer reads the physical
//                          display into the evidence form — admitted with
//                          the DECLARED traceability limitation
//                          ("twin ≡ display, not twin ≡ mass" — declared
//                          data, never a comment; controller decision 3);
//   sim_ground_truth       the acceptance environment only, never a
//                          production channel.
// Covers:
//   - the `provenance { channel … ref … observed_at … limitation "…" }`
//     facet — parse + dump round-trip (codec symmetry, TODO.refactor/16);
//   - the linter rule C99 variable-provenance-channel: the channel
//     vocabulary, the ref citation, the observed_at binding resolving to
//     a declared variable of the same test, the attestation limitation
//     (required iff observer_attestation), and the measured-source legs;
//   - the corpus-clean leg: the shipped packages show zero C99 issues
//     (additive silence — the facet is new, nobody carries it yet).
// The ref's RESOLUTION against the equipment/personnel/sim registers is
// the smart-side linker's crosswalk (R45) — the kernel is register-free.
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
import { load, dump } from '../src/ser-des/index.js';
import { checkPackage } from '../src/check';

// ── fixture helpers (the certification-program.test.ts idiom) ────────

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

const MANIFEST =
  'package { id probe-pkg version "2027" editions { 2027 } }';

/** A minimal program-shaped package: one requirement + one probe test. */
function probePackage(variables: string): Record<string, string> {
  return {
    'specification/requirements/probe.prl': `
requirement_class /req/probe {
  title "Probe requirements"
  name "Probe requirements"
}

requirement /req/probe/fidelity {
  name "Served equals reference"
  statement "The served value matches the reference reading at every probe point."
  obligation shall
}
`,
    'specification/conformance/probe.prl': `
conformance_class /conf/probe {
  title "Probe conformance tests"
  name "Probe conformance determination"
  target /req/probe
  subject "probe"
}

conformance_test /conf/probe/schedule {
  name "Probe schedule"
  type Testing
  kind performance
  targets { /req/probe/fidelity }
  variables {
    variable observed_at { type number unit "s" source measured description "The reference observation timestamp." }
    variable served_at { type number unit "s" source measured description "The served reading's own timestamp." }
${variables}
  }
}
`,
  };
}

function c99Issues(dir: string) {
  return checkPackage(dir).filter(i => i.check === 'C99');
}

// ── the codec leg ────────────────────────────────────────────────────

describe('the provenance facet — parse + dump round-trip', () => {
  it('parses the full provenance block on a variable', () => {
    const model = load(`conformance_test Probe {
  name "Probe"
  type Testing
  variables {
    variable reference_indication { type number unit "kg" source measured provenance { channel reference_instrument ref "mtl_f_001" observed_at observed_at } description "The physical-side reading." }
    variable observed_at { type number unit "s" source measured description "The observation timestamp." }
  }
}`);

    const ct = model.conformanceTests[0];
    assert.equal(ct.variables.length, 2);
    const v = ct.variables[0];
    assert.deepEqual(v.provenance, {
      channel: 'reference_instrument',
      ref: 'mtl_f_001',
      observedAt: 'observed_at',
      limitation: '',
    });
    // A variable without the facet carries null, never a partial shape.
    assert.equal(ct.variables[1].provenance, null);
  });

  it('parses the attestation channel with its declared limitation', () => {
    const model = load(`conformance_test Probe {
  name "Probe"
  variables {
    variable reference_state { type string source measured provenance { channel observer_attestation ref "p_weber" observed_at observed_at limitation "Attestation-only evidence proves twin ≡ display, not twin ≡ mass." } description "The observed state." }
  }
}`);

    assert.deepEqual(model.conformanceTests[0].variables[0].provenance, {
      channel: 'observer_attestation',
      ref: 'p_weber',
      observedAt: 'observed_at',
      limitation: 'Attestation-only evidence proves twin ≡ display, not twin ≡ mass.',
    });
  });

  it('round-trips through dump (codec symmetry)', () => {
    const model = load(`conformance_test Probe {
  name "Probe"
  type Testing
  variables {
    variable reference_indication { type number unit "kg" source measured provenance { channel sim_ground_truth ref "sim_lc500_twin" observed_at observed_at } description "The physical-side reading." }
    variable reference_state { type string source measured provenance { channel observer_attestation ref "p_weber" observed_at observed_at limitation "twin ≡ display, not twin ≡ mass" } description "The observed state." }
    variable observed_at { type number unit "s" source measured description "The observation timestamp." }
  }
}`);

    const dumped = dump(model);
    assert.ok(
      dumped.includes(
        'provenance { channel sim_ground_truth ref "sim_lc500_twin" observed_at observed_at }',
      ),
    );
    assert.ok(
      dumped.includes(
        'provenance { channel observer_attestation ref "p_weber" observed_at observed_at limitation "twin ≡ display, not twin ≡ mass" }',
      ),
    );
    const reloaded = load(dumped);
    assert.deepEqual(
      reloaded.conformanceTests[0].variables,
      model.conformanceTests[0].variables,
    );
    // The second dump is byte-identical — the codec is a fixpoint.
    assert.equal(dump(reloaded), dumped);
  });
});

// ── C99 variable-provenance-channel ──────────────────────────────────

describe('C99 variable-provenance-channel', () => {
  it('a complete declaration is silent', () => {
    const parent = mkdtempSync(join(tmpdir(), 'primmel-provenance-'));
    const dir = writePackage(
      parent,
      'probe-pkg',
      MANIFEST,
      probePackage(
        '    variable reference_indication { type number unit "kg" source measured provenance { channel reference_instrument ref "mtl_f_001" observed_at observed_at } description "The physical-side reading." }',
      ),
    );
    assert.deepEqual(c99Issues(dir), []);
  });

  it('an unknown channel is an error', () => {
    const parent = mkdtempSync(join(tmpdir(), 'primmel-provenance-'));
    const dir = writePackage(
      parent,
      'probe-pkg',
      MANIFEST,
      probePackage(
        '    variable reference_indication { type number unit "kg" source measured provenance { channel tea_leaves ref "mtl_f_001" observed_at observed_at } description "x" }',
      ),
    );
    const issues = c99Issues(dir);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'error');
    assert.match(issues[0].message, /channel "tea_leaves"/);
    assert.match(issues[0].message, /variable-provenance-channel/);
  });

  it('a missing ref citation is an error — the citation is the substance', () => {
    const parent = mkdtempSync(join(tmpdir(), 'primmel-provenance-'));
    const dir = writePackage(
      parent,
      'probe-pkg',
      MANIFEST,
      probePackage(
        '    variable reference_indication { type number unit "kg" source measured provenance { channel reference_instrument observed_at observed_at } description "x" }',
      ),
    );
    const issues = c99Issues(dir);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'error');
    assert.match(issues[0].message, /cites no ref/);
  });

  it('a missing or dangling observed_at binding is an error', () => {
    const parent = mkdtempSync(join(tmpdir(), 'primmel-provenance-'));
    const missing = writePackage(
      parent,
      'probe-missing',
      'package { id probe-missing version "2027" editions { 2027 } }',
      probePackage(
        '    variable reference_indication { type number unit "kg" source measured provenance { channel reference_instrument ref "mtl_f_001" } description "x" }',
      ),
    );
    let issues = c99Issues(missing);
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /declares no observed_at binding/);

    const dangling = writePackage(
      parent,
      'probe-dangling',
      'package { id probe-dangling version "2027" editions { 2027 } }',
      probePackage(
        '    variable reference_indication { type number unit "kg" source measured provenance { channel reference_instrument ref "mtl_f_001" observed_at tea_time } description "x" }',
      ),
    );
    issues = c99Issues(dangling);
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /names no declared variable/);
  });

  it('observer_attestation without the DECLARED limitation is an error — never a comment', () => {
    const parent = mkdtempSync(join(tmpdir(), 'primmel-provenance-'));
    const dir = writePackage(
      parent,
      'probe-pkg',
      MANIFEST,
      probePackage(
        '    variable reference_state { type string source measured provenance { channel observer_attestation ref "p_weber" observed_at observed_at } description "x" }',
      ),
    );
    const issues = c99Issues(dir);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'error');
    assert.match(issues[0].message, /without its traceability limitation/);
    assert.match(issues[0].message, /twin ≡ display/);
  });

  it('a limitation on a non-attestation channel is a warning', () => {
    const parent = mkdtempSync(join(tmpdir(), 'primmel-provenance-'));
    const dir = writePackage(
      parent,
      'probe-pkg',
      MANIFEST,
      probePackage(
        '    variable reference_indication { type number unit "kg" source measured provenance { channel reference_instrument ref "mtl_f_001" observed_at observed_at limitation "misplaced" } description "x" }',
      ),
    );
    const issues = c99Issues(dir);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'warning');
    assert.match(issues[0].message, /rides the observer_attestation channel/);
  });

  it('provenance on a non-measured variable is a warning', () => {
    const parent = mkdtempSync(join(tmpdir(), 'primmel-provenance-'));
    const dir = writePackage(
      parent,
      'probe-pkg',
      MANIFEST,
      probePackage(
        '    variable pair_skew { type number unit "s" source derived derivation "ocl{abs(served_at - observed_at)}" provenance { channel reference_instrument ref "mtl_f_001" observed_at observed_at } description "x" }',
      ),
    );
    const issues = c99Issues(dir);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'warning');
    assert.match(issues[0].message, /source derived/);
  });
});

// ── corpus-clean leg (additive silence — the facet is new) ───────────

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
    `variable-provenance.test.ts: skipping the corpus-clean spec — ${CORPUS_SKIP}`,
  );
}

describe('corpus-clean leg (additive/OCP — the shipped packages)', () => {
  it(
    'shows zero C99 issues across the corpus',
    { skip: CORPUS_SKIP },
    () => {
      const dirs = readdirSync(CORPUS)
        .map(d => join(CORPUS, d))
        .filter(d => existsSync(join(d, 'package.primmel')))
        .sort();
      assert.ok(dirs.length > 0, 'corpus directories found');
      for (const dir of dirs) {
        assert.deepEqual(
          c99Issues(dir).map(i => i.message),
          [],
          `C99 issues in ${dir}`,
        );
      }
    },
  );
});
