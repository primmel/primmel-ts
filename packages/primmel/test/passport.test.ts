// ─────────────────────────────────────────────────────────────────────
// The `passport` construct (Primmel v3, TODO.roadmap/35 — doctrine
// ch. 14 §14.6, ch. 15 §15.6, grammar sketch §15.8): the model-native
// Digital Product Passport. Covers the parse (all facet shapes, incl.
// the sketch's `identifier` + comma/semicolon spellings), the round-trip
// fixpoint, the linter rules
//   C86 passport-content-resolves
//   C87 passport-access-leak
//   C88 passport-upi-scheme
// the passport-supply-chain fixture (acme-lc500 + the oiml-r60 sibling
// stub) validated end-to-end (parse, lint-clean, round-trip), and the
// corpus-clean leg: the 19 shipped packages show zero errors and zero
// passport-rule issues (additive/OCP — packages without a passport are
// untouched).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump, loadPackageWithIssues } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const FIXTURE_REPO = join(__dirname, 'fixtures', 'passport-supply-chain');
const FIXTURE_DIR = join(FIXTURE_REPO, 'acme-lc500');

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
    `passport.test.ts: skipping the corpus-clean spec — ${CORPUS_SKIP}`,
  );
}

// The LC-500 support declarations (the passport's resolution domains):
// one subject with a promised envelope, a design parameter, served
// aspects (the twin endpoint), an artifact definition, and a monitor.
const SUPPORT = `
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

state_machine lc_operational {
  kind operational
  initial off
  states { off ready fault }
  transition off -> ready action power_on
}

behavior creep {
  kind temporal
}

behavior self_test {
  kind procedural
}

subject LC500 {
  is {
    metadata { name "LC-500 load cell model" }
    design_parameters { e_max : "500 kg" }
    endpoint lc500_api {
      operation get_indication {
        kind query
        serves indication
        payload { quantity_kind mass unit kg timestamp true }
      }
      operation watch_state {
        kind subscribe
        serves state, environmental_context
        payload { quantity_kind state unit dimensionless timestamp true }
      }
      access {
        public { get_indication }
        registered { watch_state }
      }
      profile rest_json
    }
    promises {
      mpe_within {
        target error_hold
        level symbolic C6
        statement "Holds accuracy class C6 across the rated range."
      }
    }
    artifacts { type_evaluation_dossier }
  }
  has {
    state lc_operational
    attributes { indication : mass test_dependent ref_load : mass test_dependent }
    characteristics { error_hold e = ocl{self.indication - self.ref_load} }
    serve sample.test_context.indication via get_indication { fresh_within 5s }
    serve sample.state via watch_state { fresh_within 1s }
  }
  does {
    behavior creep
    behavior self_test
  }
}

artifact_definition type_evaluation_dossier {
  name "Type evaluation dossier"
  content_contract {
    fields {
      certificate_number : string
      verdict_record : structure
    }
  }
  produced_when per_measurement
}

monitor fleet_watch {
  over { LC500 }
  triggers { every 1h on signal artifact_arrived on change state }
  evaluate { requirements applicable_to(this.classification) promises all }
  emit { evidence -> workspace verdicts -> verdict_log }
  escalate { on fail { flag_certificate open_service_case } on invalid { open_service_case } }
}
`;

const CLEAN_PASSPORT = `
passport lc500_passport {
  upi { pattern upi:acme:lc500 level model }
  carrier { kind qr payload "https://passport.acme.example/passport/upi:acme:lc500.json" }
  public { identity composition promises_as_verified }
  authority { live_compliance_status artifacts.type_evaluation_dossier }
}
`;

function makeTmpPackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-passport-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'passport.prl'), body);
  return dir;
}

const PASSPORT_RULES = ['C86', 'C87', 'C88'];

function passportIssues(dir: string) {
  return checkPackage(dir).filter(i => PASSPORT_RULES.includes(i.check));
}

describe('passport — parse (TODO.roadmap/35)', () => {
  it('parses the full passport block', () => {
    const m = load(SUPPORT + CLEAN_PASSPORT);
    assert.equal(m.passports.length, 1);
    const p = m.passports[0];
    assert.equal(p.id, 'lc500_passport');
    assert.deepEqual(p.upi, { pattern: 'upi:acme:lc500', level: 'model' });
    assert.deepEqual(p.carriers, [
      {
        kind: 'qr',
        payload: 'https://passport.acme.example/passport/upi:acme:lc500.json',
      },
    ]);
    assert.deepEqual(p.entries, [
      { access: 'public', contentClass: 'identity', ref: '' },
      { access: 'public', contentClass: 'composition', ref: '' },
      { access: 'public', contentClass: 'promises_as_verified', ref: '' },
      { access: 'authority', contentClass: 'live_compliance_status', ref: '' },
      {
        access: 'authority',
        contentClass: 'artifacts',
        ref: 'type_evaluation_dossier',
      },
    ]);
  });

  it('parses the §15.8 sketch spelling (identifier + commas) — the pattern lands, the level stays absent', () => {
    const sketch = `
passport lc500_passport {
  identifier upi:acme:lc500
  public   { identity, composition, promises_as_verified }
  authority { live_compliance_status }
}
`;
    const m = load(SUPPORT + sketch);
    const p = m.passports[0];
    assert.deepEqual(p.upi, { pattern: 'upi:acme:lc500', level: '' });
    assert.deepEqual(
      p.entries.map(e => `${e.access}:${e.contentClass}`),
      [
        'public:identity',
        'public:composition',
        'public:promises_as_verified',
        'authority:live_compliance_status',
      ],
    );
  });

  it('splits a qualified entry on the FIRST dot (the ref may be an attribute path)', () => {
    const m = load(
      SUPPORT +
        `
passport dotted {
  upi { pattern upi:acme:lc500 level item }
  restricted { composition.sample.test_context.indication }
}
`,
    );
    assert.deepEqual(m.passports[0].entries, [
      {
        access: 'restricted',
        contentClass: 'composition',
        ref: 'sample.test_context.indication',
      },
    ]);
  });

  it('parses the bare single-entry access form, a second carrier, and references', () => {
    const m = load(
      SUPPORT +
        `
passport multi {
  upi { pattern upi:acme:lc500:{serial} level item }
  carrier { kind qr payload "https://passport.acme.example/p.json" }
  carrier { kind rfid payload "https://passport.acme.example/p.json" }
  public identity
  reference { ref-1 ref-2 }
}
`,
    );
    const p = m.passports[0];
    assert.equal(p.upi.pattern, 'upi:acme:lc500:{serial}');
    assert.equal(p.upi.level, 'item');
    assert.equal(p.carriers.length, 2);
    assert.equal(p.carriers[1].kind, 'rfid');
    assert.deepEqual(p.entries, [
      { access: 'public', contentClass: 'identity', ref: '' },
    ]);
    assert.deepEqual(p.referenceIds, ['ref-1', 'ref-2']);
  });

  it('FAILS CLOSED on an unknown access class (a typo is a parse-time error, never silently served)', () => {
    // The smart leg's projection engine relies on this: a misspelled
    // access class must not parse into entries no class serves (a leak
    // could hide behind the typo — task-35 review, Minor 4).
    assert.throws(
      () =>
        load(
          SUPPORT +
            `
passport typo {
  upi { pattern upi:acme:lc500 level model }
  restriced { composition.internal_materials }
}
`,
        ),
      /unknown access class "restriced".*public \| restricted \| authority/,
    );
    // A typo'd known FACET with a block value fails closed the same way
    // (`up { … }` for `upi { … }`).
    assert.throws(
      () => load('passport typo2 {\n  up { pattern x level model }\n}\n'),
      /unknown access class "up"/,
    );
    // Unknown NON-block keywords stay ignored (forward compatibility for
    // scalar facets) — and C88 still catches the missing UPI.
    const m = load(
      'passport future {\n  modes abstract\n  public { identity }\n}\n',
    );
    assert.equal(m.passports.length, 1);
    assert.equal(m.passports[0].upi.pattern, '');
  });

  it('round-trips the whole package losslessly (fixpoint)', () => {
    const m1 = load(SUPPORT + CLEAN_PASSPORT);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.passports, m1.passports);
    assert.equal(dump(m2), dumped);
  });

  it('NORMALIZES a non-canonically-ordered source (the dump regroups; deepEqual then holds — task-35 review)', () => {
    // The round-trip guarantee is the CANONICAL fixpoint: the dump
    // groups entries by access class in canonical order (public,
    // restricted, authority), so a source declaring `authority` before
    // `public` re-loads with entries REGROUPED — `deepEqual(m2, m1)`
    // holds only for canonically-ordered declarations (like the fixture
    // and every leg above). Semantically harmless: C86/C87 treat entries
    // as sets. This pins the normalization: the first dump reorders,
    // every dump after is a fixpoint.
    const shuffled = `
passport order {
  upi { pattern upi:acme:lc500 level model }
  authority { live_compliance_status }
  public { identity promises_as_verified.mpe_within }
  restricted { composition.error_hold }
}
`;
    const m1 = load(SUPPORT + shuffled);
    const dumped1 = dump(m1);
    // The dump emits the canonical access order regardless of source order.
    assert.ok(
      dumped1.indexOf('public {') < dumped1.indexOf('restricted {') &&
        dumped1.indexOf('restricted {') < dumped1.indexOf('authority {'),
      `expected canonical access order in the dump, got:\n${dumped1}`,
    );
    const m2 = load(dumped1);
    // Regrouped: public entries first — the content is identical, the
    // order is canonical (so deepEqual(m2, m1) would NOT hold here).
    assert.deepEqual(
      m2.passports[0].entries.map(e => e.access),
      ['public', 'public', 'restricted', 'authority'],
    );
    assert.deepEqual(
      new Set(
        m2.passports[0].entries.map(
          e => `${e.access}:${e.contentClass}.${e.ref}`,
        ),
      ),
      new Set(
        m1.passports[0].entries.map(
          e => `${e.access}:${e.contentClass}.${e.ref}`,
        ),
      ),
      'the regrouping preserves the entry SET exactly',
    );
    // After the first normalization the dump is a fixpoint.
    const dumped2 = dump(m2);
    assert.equal(dumped2, dumped1);
    const m3 = load(dumped2);
    assert.deepEqual(m3.passports, m2.passports);
  });

  it('stays total on a malformed passport (the linter judges, not the parser)', () => {
    const m = load('passport broken {\n  public { identity }\n}\n');
    assert.equal(m.passports.length, 1);
    assert.equal(m.passports[0].upi.pattern, '');
    assert.equal(m.passports[0].upi.level, '');
  });
});

describe('passport lint rules (C86–C88)', () => {
  it('stays silent on a clean passport declaration', () => {
    const issues = passportIssues(makeTmpPackage(SUPPORT + CLEAN_PASSPORT));
    assert.deepEqual(
      issues,
      [],
      `expected no passport issues, got: ${issues.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
    );
  });

  it('C86 fires on an unknown content class', () => {
    const issues = passportIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_PASSPORT.replace('identity composition', 'identity telemetry'),
      ),
    ).filter(i => i.check === 'C86');
    assert.ok(
      issues.some(
        i =>
          i.message.includes('"telemetry"') &&
          i.message.includes('unknown content class'),
      ),
      `expected an unknown-class C86, got: ${issues.map(i => i.message).join('\n')}`,
    );
  });

  it('C86 fires on qualified refs that do not resolve — per content-class domain', () => {
    const ghostPromise = passportIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_PASSPORT.replace(
            'promises_as_verified }',
            'promises_as_verified.ghost_promise }',
          ),
      ),
    ).filter(i => i.check === 'C86');
    assert.ok(
      ghostPromise.some(i =>
        i.message.includes('promises_as_verified.ghost_promise'),
      ),
    );

    const ghostComposition = passportIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_PASSPORT.replace(' composition ', ' composition.ghost_slot '),
      ),
    ).filter(i => i.check === 'C86');
    assert.ok(
      ghostComposition.some(i => i.message.includes('composition.ghost_slot')),
    );

    const ghostArtifact = passportIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_PASSPORT.replace(
            'artifacts.type_evaluation_dossier',
            'artifacts.ghost_dossier',
          ),
      ),
    ).filter(i => i.check === 'C86');
    assert.ok(
      ghostArtifact.some(i => i.message.includes('artifacts.ghost_dossier')),
    );

    const ghostLive = passportIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_PASSPORT.replace(
            'live_compliance_status artifacts',
            'live_compliance_status.ghost_monitor artifacts',
          ),
      ),
    ).filter(i => i.check === 'C86');
    assert.ok(
      ghostLive.some(i =>
        i.message.includes('live_compliance_status.ghost_monitor'),
      ),
    );

    const ghostIdentity = passportIssues(
      makeTmpPackage(
        SUPPORT + CLEAN_PASSPORT.replace(' identity ', ' identity.GhostModel '),
      ),
    ).filter(i => i.check === 'C86');
    assert.ok(
      ghostIdentity.some(i => i.message.includes('identity.GhostModel')),
    );
  });

  it('C86 resolves qualified refs against the real domains (positive legs)', () => {
    const resolved = `
passport qualified {
  upi { pattern upi:acme:lc500 level model }
  public { identity.LC500 composition.e_max composition.sample.test_context.indication promises_as_verified.mpe_within }
  restricted { composition.error_hold }
  authority { live_compliance_status.fleet_watch live_compliance_status.mpe_within artifacts.type_evaluation_dossier }
}
`;
    const issues = passportIssues(makeTmpPackage(SUPPORT + resolved));
    assert.deepEqual(
      issues,
      [],
      `expected the qualified refs to resolve, got: ${issues.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
    );
  });

  it('C86 does not judge sustainability refs (the forward class — no kernel domain yet)', () => {
    const issues = passportIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_PASSPORT.replace(
            ' composition ',
            ' sustainability.recycled_content ',
          ),
      ),
    ).filter(i => i.check === 'C86');
    assert.deepEqual(issues, []);
  });

  it('C86 resolves a composition ref against the is.structure branch (task-35 review leg)', () => {
    // The composition domain's structure branch: `structure { … }`
    // entries are designed-composition slots (SubjectIs.structure).
    const structured = SUPPORT.replace(
      '    design_parameters { e_max : "500 kg" }',
      '    design_parameters { e_max : "500 kg" }\n    structure { load_button }',
    );
    const resolved = `
passport structured {
  upi { pattern upi:acme:lc500 level model }
  public { identity composition.load_button }
}
`;
    const issues = passportIssues(makeTmpPackage(structured + resolved)).filter(
      i => i.check === 'C86',
    );
    assert.deepEqual(
      issues,
      [],
      `expected composition.load_button to resolve via is.structure, got: ${issues.map(i => i.message).join('\n')}`,
    );
  });

  it('C86 resolves an artifacts ref present only via the subject is.artifacts union (task-35 review leg)', () => {
    // The artifacts domain is the UNION artifactDefinition ids ∪
    // subjects' is.artifacts — so a ref whose id rides only the
    // subject slot still resolves. (Such a package is NOT lint-clean —
    // C46 requires is.artifacts entries to name declared definitions —
    // but C86 must not pile a false passport error onto the unlinted
    // mid-authoring state; the assertion filters to C86.)
    const noDef = SUPPORT.replace(
      '    artifacts { type_evaluation_dossier }',
      '    artifacts { extra_record }',
    ).replace(
      /artifact_definition type_evaluation_dossier \{[\s\S]*?\n}\n/,
      '',
    );
    const resolved = `
passport unioned {
  upi { pattern upi:acme:lc500 level model }
  authority { artifacts.extra_record }
}
`;
    const issues = passportIssues(makeTmpPackage(noDef + resolved)).filter(
      i => i.check === 'C86',
    );
    assert.deepEqual(
      issues,
      [],
      `expected artifacts.extra_record to resolve via the is.artifacts union, got: ${issues.map(i => i.message).join('\n')}`,
    );
  });

  it('C87 fires when a restricted/authority entry is reachable from public — exact or covered by a bare class', () => {
    const exact = passportIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_PASSPORT.replace(
            'authority { live_compliance_status artifacts.type_evaluation_dossier }',
            'authority { live_compliance_status } restricted { promises_as_verified }',
          ),
      ),
    ).filter(i => i.check === 'C87');
    assert.ok(
      exact.some(
        i =>
          i.message.includes('"promises_as_verified"') &&
          i.message.includes('marked restricted'),
      ),
      `expected the exact-entry leak, got: ${exact.map(i => i.message).join('\n')}`,
    );

    // The leak shape: a qualified entry marked restricted while the bare
    // class sits in public — the public class swallows the restriction.
    const covered = passportIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_PASSPORT.replace(
            'authority { live_compliance_status artifacts.type_evaluation_dossier }',
            'restricted { composition.internal_materials }',
          ),
      ),
    ).filter(i => i.check === 'C87');
    assert.ok(
      covered.some(i => i.message.includes('"composition.internal_materials"')),
      `expected the covering bare-class leak, got: ${covered.map(i => i.message).join('\n')}`,
    );
  });

  it('C87 does not fire on the authored narrowing (a restricted class with one ref made public)', () => {
    const narrowing = `
passport narrowed {
  upi { pattern upi:acme:lc500 level model }
  public { identity artifacts.type_evaluation_dossier }
  restricted { artifacts }
}
`;
    const issues = passportIssues(makeTmpPackage(SUPPORT + narrowing)).filter(
      i => i.check === 'C87',
    );
    assert.deepEqual(
      issues,
      [],
      `expected no leak on the narrowing, got: ${issues.map(i => i.message).join('\n')}`,
    );
  });

  it('C88 fires on a missing pattern, a missing level, an unknown level — and on the sketch spelling', () => {
    const noPattern = passportIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_PASSPORT.replace(
            'upi { pattern upi:acme:lc500 level model }',
            'upi { level model }',
          ),
      ),
    ).filter(i => i.check === 'C88');
    assert.ok(noPattern.some(i => i.message.includes('no UPI pattern')));

    const noLevel = passportIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_PASSPORT.replace(
            'upi { pattern upi:acme:lc500 level model }',
            'upi { pattern upi:acme:lc500 }',
          ),
      ),
    ).filter(i => i.check === 'C88');
    assert.ok(noLevel.some(i => i.message.includes('declares no level')));

    const badLevel = passportIssues(
      makeTmpPackage(
        SUPPORT + CLEAN_PASSPORT.replace('level model', 'level series'),
      ),
    ).filter(i => i.check === 'C88');
    assert.ok(badLevel.some(i => i.message.includes('"series"')));

    // The §15.8 sketch spelling — `identifier` carries no level.
    const sketch = passportIssues(
      makeTmpPackage(
        SUPPORT +
          `
passport sketchy {
  identifier upi:acme:lc500
  public { identity }
}
`,
      ),
    ).filter(i => i.check === 'C88');
    assert.ok(sketch.some(i => i.message.includes('declares no level')));
  });

  it('passports are additive: a package without one shows no passport issues', () => {
    const issues = passportIssues(makeTmpPackage(SUPPORT));
    assert.deepEqual(issues, []);
  });
});

describe('lc500_passport fixture (doctrine §14.6/§15.6/§15.8) — end-to-end', () => {
  it('parses with zero load issues', () => {
    const { issues } = loadPackageWithIssues(FIXTURE_DIR);
    assert.deepEqual(issues, []);
  });

  it('is lint-clean (zero errors; zero passport-family issues)', () => {
    const issues = checkPackage(FIXTURE_DIR);
    const errors = issues.filter(i => i.severity === 'error');
    assert.deepEqual(
      errors,
      [],
      `expected a lint-clean fixture, got: ${errors.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
    );
    assert.deepEqual(passportIssues(FIXTURE_DIR), []);
  });

  it('declares the §15.8 lc500_passport (UPI at model level, QR carrier, the two access classes)', () => {
    const { standard } = loadPackageWithIssues(FIXTURE_DIR);
    const p = standard.passports.find(x => x.id === 'lc500_passport')!;
    assert.deepEqual(p.upi, { pattern: 'upi:acme:lc500', level: 'model' });
    assert.equal(p.carriers.length, 1);
    assert.equal(p.carriers[0].kind, 'qr');
    assert.ok(
      p.carriers[0].payload.includes('/passport/upi:acme:lc500'),
      'the carrier payload is the passport endpoint URL',
    );
    assert.deepEqual(
      p.entries.filter(e => e.access === 'public').map(e => e.contentClass),
      ['identity', 'composition', 'promises_as_verified'],
    );
    assert.deepEqual(
      p.entries.filter(e => e.access === 'authority').map(e => e.contentClass),
      ['live_compliance_status', 'artifacts'],
    );
  });

  it('round-trips (load → dump → load → deepEqual; stable second dump)', () => {
    const src = readFileSync(join(FIXTURE_DIR, 'model', 'lc500.prl'), 'utf8');
    const m1 = load(src);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.passports, m1.passports);
    assert.equal(dump(m2), dumped);
  });
});

describe('corpus-clean leg (additive/OCP — the 19 shipped packages)', () => {
  it(
    'shows zero errors and zero passport-rule issues across the corpus',
    { skip: CORPUS_SKIP },
    () => {
      const dirs = readdirSync(CORPUS)
        .map(d => join(CORPUS, d))
        .filter(d => existsSync(join(d, 'package.primmel')))
        .sort();
      assert.equal(
        dirs.length,
        19,
        `expected the 19-package corpus at ${CORPUS}`,
      );
      for (const dir of dirs) {
        const issues = checkPackage(dir);
        const errors = issues.filter(i => i.severity === 'error' && !i.known);
        assert.deepEqual(
          errors,
          [],
          `${dir}: expected zero errors, got: ${errors.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
        );
        assert.deepEqual(
          issues.filter(i => PASSPORT_RULES.includes(i.check)),
          [],
          `${dir}: a package without a passport must show no passport-rule issues`,
        );
      }
    },
  );
});
