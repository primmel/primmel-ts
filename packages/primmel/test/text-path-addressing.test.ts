// ─────────────────────────────────────────────────────────────────────
// Nested-prose `text` addressing (smart gap-close E13,
// analysis/architecture-gaps-2026-07.md): the `text` construct's
// address grows from `<element-id>.<field>` to
// `<element-id>.<path…>.<field>` so prose NESTED inside an element — a
// form/subform sub-field's label, a requirement parameter's
// description, a subject slot's label, a limit's notes — can carry
// alternate spellings. The id stays ONE bare token (dots are ordinary
// token characters); parsing is unchanged, and linter rule C89 owns the
// address grammar:
//
//   - the addressed element is the LONGEST dot-boundary prefix of the
//     address registered in the (composed) package — element ids may
//     themselves carry dots (r144-3/sec-3.4);
//   - an intermediate segment names a nested structure (an own
//     property whose value is an object or a list);
//   - a list item addresses by its DECLARED KEY (a field/parameter
//     name, a step's order, a subject's slot) — never a positional
//     index: a reorder never silently re-points an address, a rename
//     breaks it loudly (the hygiene finding that made E13 live);
//   - the terminal segment is a prose field (the C89 vocabulary) the
//     addressed structure CARRIES — a slot the parser fills only when
//     authored is addressable exactly then (there is nothing to
//     alternate where no default value lives).
//
// The fixtures are the corpus shapes (oiml-r60 + oiml-r144): the
// drift-test's doubly-nested `items { object fields { … } }`, the
// load-test-row subform, the MPE requirement's param/subject/limit
// notes, and the R 60 test sequence (whose steps carry no prose today —
// the near-term shape rejects loudly until the construct grows one).
// Covers the parse/merge/fixpoint legs, the C89 positive and negative
// legs, resolution against a `uses`-composed model, and the
// corpus-clean leg: the 23 shipped packages ship no `text` blocks, so
// the leg asserts additive silence (zero errors, zero C89 issues).
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
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { loadPackage } from '../src/ser-des/package';
import { checkPackage } from '../src/check';
import { CORPUS, CORPUS_AVAILABLE, CORPUS_SKIP } from './helpers/corpus';

// The corpus resolution (env-first, repo-relative default, loud skip) has
// one home — test/helpers/corpus.ts (TODO.v2/13 item 3c).
if (!CORPUS_AVAILABLE) {
  console.log(
    `text-path-addressing.test.ts: skipping the corpus-clean spec — ${CORPUS_SKIP}`,
  );
}

// The corpus shapes recoded as fixtures. The drift-test form nests
// `items { object fields { … } }` twice (oiml-r144 drift-test.prl); the
// requirement carries the param description, the subject-slot label,
// and the limit notes (oiml-r60 metrological/electronic.prl).
const FORMS = `
form r60-3/drift-test {
  name "Drift test"
  description "Drift over the 7-day period"
  field drift_series : array {
    description "One series per CGM (smallest and largest volume fractions)"
    items { object fields {
      field cgm_reference : number {
        unit "ppm"
        required true
      }
      field daily_measurements : array {
        description "Measurements at least every 24 h over the 7-day period"
        items { object fields {
          field day : integer {
            label "Day"
            required true
          }
          field error : number {
            unit "ppm"
          }
        } }
      }
    } }
  }
}

subform load-test-row {
  type object
  description "One row of a load-test table"
  field test_load : number {
    label "Test load"
    description "Applied test load at this measurement point."
    unit "g, kg, or t"
  }
  field runs : array {
    label "Runs"
    items { object fields {
      field indication : number {
        label "Indication"
        unit "counts"
      }
    } }
  }
}

form r144-3/sec-3.4 {
  name "Section 3.4"
  description "A dotted form id"
  field channel : string {
    label "Channel"
  }
}
`;

const REQUIREMENTS = `
requirement /req/metrological/mpe-tier {
  name "MPE tiers"
  statement "The maximum permissible error is expressed as factor × p_LC × v."
  parameters {
    param accuracy_class: enum { description "Determines the load breakpoints (in v units) for the three MPE tiers." enum_values { A B C D } }
  }
  subjects {
    subject 1 { entity_id "dimensions.p_LC" label "Apportioning factor" }
  }
}

requirement /req/electronic/disturbances {
  name "Disturbances"
  statement "The fault shall satisfy the conditions in section 5.7.1.1."
  limit {
    expression "ocl{abs(fault) <= 1}"
    notes "Significant-fault limit is one verification interval (1 v, R 60-1, 5.7.1.1 NOTE)."
  }
}
`;

const SEQUENCE = `
test_sequence mdlo-creep-dr {
  name "MDLO → Creep → DR sequence"
  description "The three performance tests must run in this order on the same sample."
  step 1 { test "/conf/metrological-tests/mdlo" role baseline }
  step 2 { test "/conf/metrological-tests/creep" role follow_up depends_on 1 }
}
`;

const TABLE = `
table mpe_tiers {
  description "MPE per load tier"
  columns {
    load: string
    mpe: string
  }
  data {
    "low" "1 v"
    "high" "2 v"
  }
}
`;

const MODEL = FORMS + REQUIREMENTS + SEQUENCE + TABLE;

function makeTmpPackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-text-path-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'model.prl'), body);
  return dir;
}

const c89 = (dir: string) => checkPackage(dir).filter(i => i.check === 'C89');

describe('text path addressing — parse/merge/fixpoint (E13)', () => {
  it('parses a path id as one bare token', () => {
    const s = load(`
      text r60-3/load-test.fields.runs.fields.indication.label {
        spell fra-Latn "Indication"
      }
    `);
    assert.equal(s.texts.length, 1);
    assert.equal(
      s.texts[0].id,
      'r60-3/load-test.fields.runs.fields.indication.label',
    );
    assert.deepEqual(s.texts[0].entries, [
      { spelling: 'fra-Latn', value: 'Indication' },
    ]);
  });

  it('merges split text blocks for one nested path into one content set', () => {
    // Alternate spellings of one nested field may be split across files
    // (a package's l10n files) — the merge keys on the full address.
    const s = load(`
      text form-a.fields.x.label { spell fra-Latn "Un" }
      text form-a.fields.x.label { spell deu-Latn "Eins" }
      text form-a.fields.y.label { spell fra-Latn "Deux" }
    `);
    assert.equal(s.texts.length, 2);
    assert.equal(s.texts[0].entries.length, 2);
    assert.equal(s.texts[1].entries.length, 1);
  });

  it('round-trips a package with nested text blocks byte-clean (fixpoint)', () => {
    const src =
      MODEL +
      `
text r60-3/drift-test.fields.drift_series.fields.daily_measurements.fields.day.label {
  spell fra-Latn "Jour"
}
text /req/electronic/disturbances.limit.notes {
  spell fra-Latn "La limite de défaut significatif est un intervalle de vérification (1 v)."
}
`;
    const dumped = dump(load(src));
    assert.ok(
      dumped.includes(
        'text r60-3/drift-test.fields.drift_series.fields.daily_measurements.fields.day.label {',
      ),
      `expected the nested address bare in the dump, got:\n${dumped}`,
    );
    const m1 = load(src);
    const m2 = load(dumped);
    assert.deepEqual(m2.texts, m1.texts);
    assert.equal(dump(m2), dumped);
  });

  it('round-trips a DANGLING address byte-clean (the codec never judges — C89 does)', () => {
    // Total-parser doctrine: an unresolvable path is linter garbage, not
    // a parse error — the dump re-emits it and the re-parse reproduces
    // the model exactly.
    const src = `text no-such-element.fields.x.label {
  spell fra-Latn "x"
}
`;
    const dumped = dump(load(src));
    assert.deepEqual(load(dumped).texts, load(src).texts);
    assert.equal(dump(load(dumped)), dumped);
  });
});

describe('text path addressing — C89 positive legs (the corpus shapes)', () => {
  it('resolves the corpus shapes (ONE batched build — TODO.v2/13 item 3d)', () => {
    // The legs below used to build + check a fresh tmp package each (~236 s
    // for the file); they batch into ONE package now — a failure still
    // names its shape: every C89 message carries the text address. The
    // shapes: the doubly-nested drift form (oiml-r144), the load-test-row
    // subform, the true_label/false_label/examples vocabulary, the MPE
    // requirement's param/subject/limit notes, and the DOTTED element id
    // (r144-3/sec-3.4 — the last-dot split would mis-address it).
    const issues = c89(
      makeTmpPackage(
        MODEL +
          `
form verdict-form {
  name "Verdict form"
  field pass : boolean {
    true_label "Pass"
    false_label "Fail"
    examples "Pass at every point"
  }
}
text r60-3/drift-test.fields.drift_series.description {
  spell fra-Latn "Une série par CGM"
}
text r60-3/drift-test.fields.drift_series.fields.daily_measurements.description {
  spell fra-Latn "Mesures au moins toutes les 24 h"
}
text r60-3/drift-test.fields.drift_series.fields.daily_measurements.fields.day.label {
  spell fra-Latn "Jour"
}
text load-test-row.fields.test_load.label {
  spell fra-Latn "Charge d'essai"
}
text load-test-row.fields.runs.fields.indication.label {
  spell fra-Latn "Indication"
}
text verdict-form.fields.pass.true_label {
  spell fra-Latn "Réussi"
}
text verdict-form.fields.pass.false_label {
  spell fra-Latn "Échoué"
}
text verdict-form.fields.pass.examples {
  spell fra-Latn "Réussi à tous les points"
}
text /req/metrological/mpe-tier.parameters.accuracy_class.description {
  spell fra-Latn "Détermine les points de basculement (en unités v) des trois étages d'emp."
}
text /req/metrological/mpe-tier.subjects.1.label {
  spell fra-Latn "Facteur de répartition"
}
text /req/electronic/disturbances.limit.notes {
  spell fra-Latn "La limite de défaut significatif est un intervalle de vérification (1 v)."
}
text r144-3/sec-3.4.description {
  spell fra-Latn "Un identifiant de formulaire pointé"
}
text r144-3/sec-3.4.fields.channel.label {
  spell fra-Latn "Voie"
}
`,
      ),
    );
    assert.deepEqual(
      issues,
      [],
      `expected the 13 corpus-shape addresses to resolve, got: ${issues.map(i => i.message).join('\n')}`,
    );
  });

  it('resolves a nested address against a uses-composed model', () => {
    // C89 runs on the COMPOSED standard (checkPackage) — a rec package's
    // l10n files address the foundation package's nested prose.
    const coreDir = mkdtempSync(join(tmpdir(), 'primmel-tp-core-'));
    writeFileSync(
      join(coreDir, 'package.primmel'),
      'package { id toy-core kind core }',
    );
    mkdirSync(join(coreDir, 'specification'));
    writeFileSync(join(coreDir, 'specification', 'forms.prl'), MODEL);

    const recDir = mkdtempSync(join(tmpdir(), 'primmel-tp-rec-'));
    writeFileSync(
      join(recDir, 'package.primmel'),
      'package { id toy-rec kind rec uses { toy-core } }',
    );
    mkdirSync(join(recDir, 'model'));
    writeFileSync(
      join(recDir, 'model', 'fra.prl'),
      `
text r60-3/drift-test.fields.drift_series.fields.daily_measurements.fields.day.label {
  spell fra-Latn "Jour"
}
`,
    );

    const dirs = new Map([
      ['toy-core', coreDir],
      ['toy-rec', recDir],
    ]);
    const issues = checkPackage(recDir, {
      resolvePackage: (id: string) => dirs.get(id),
    }).filter(i => i.check === 'C89');
    assert.deepEqual(
      issues,
      [],
      `expected the composed-model nested address to resolve, got: ${issues.map(i => i.message).join('\n')}`,
    );
    // and the composed model carries the content set under the path id
    const composed = loadPackage(recDir, {
      resolvePackage: (id: string) => dirs.get(id),
    });
    assert.equal(
      composed.texts.find(
        t =>
          t.id ===
          'r60-3/drift-test.fields.drift_series.fields.daily_measurements.fields.day.label',
      )?.entries.length,
      1,
    );
  });
});

describe('text path addressing — C89 negative legs', () => {
  it('flags the near-term shapes (ONE batched build — TODO.v2/13 item 3d)', () => {
    // The legs below used to build + check a fresh tmp package each; they
    // batch into ONE package now (a failure still names its shape: every
    // C89 message carries the text address, so the assertions key on it).
    // The shapes, address → expected message:
    //   - a dangling path segment (no item keyed by that name) — a list
    //     item addresses by its DECLARED key, never a positional index;
    //   - a terminal non-prose field, nested and step-keyed (the step
    //     resolves by its declared ORDER — and `test` is machine content,
    //     never spelling-coded, doctrine §10.7);
    //   - a prose terminal the addressed structure does not carry (test-
    //     sequence steps ship no prose today — the near-term shape
    //     rejects loudly until the construct grows the slot);
    //   - an ambiguous key (two items of one list share the name);
    //   - a descent into a scalar (a prose string is not a structure);
    //   - a terminal whose parent is a list (the item key is missing);
    //   - a keyless list item (table cells are data, never prose);
    //   - an empty path segment;
    //   - an address whose element is not in the package (the message
    //     lists every tried prefix — item 3a).
    const dup = `
form f-dup {
  name "Dup"
  field readings : array {
    items { object fields {
      field value : number { label "Value" }
      field value : string { label "Other value" }
    } }
  }
}
`;
    const addresses: [address: string, pattern: RegExp][] = [
      [
        'r60-3/drift-test.fields.no_such_series.description',
        /no item keyed "no_such_series".*declared key/,
      ],
      [
        'r60-3/drift-test.fields.drift_series.fields.daily_measurements.fields.error.unit',
        /"unit" is not a prose field/,
      ],
      ['mdlo-creep-dr.steps.1.test', /"test" is not a prose field/],
      [
        'mdlo-creep-dr.steps.1.description',
        /carries no prose field "description"/,
      ],
      [
        'r60-3/drift-test.fields.drift_series.fields.daily_measurements.fields.error.description',
        /carries no prose field "description"/,
      ],
      [
        'f-dup.fields.readings.fields.value.label',
        /"value" keys 2 items.*ambiguous/,
      ],
      [
        'r60-3/drift-test.fields.drift_series.description.note',
        /has no nested structure "description"/,
      ],
      [
        'r60-3/drift-test.fields.drift_series.fields.label',
        /is a list.*by its key/,
      ],
      ['mpe_tiers.data.1.description', /no item keyed "1"/],
      ['r60-3/drift-test..label', /empty path segment/],
      [
        '/req/nope.fields.x.label',
        /no element "\/req\/nope\.fields\.x" in the package — every dot-boundary prefix was tried \("\/req\/nope\.fields\.x", "\/req\/nope\.fields", "\/req\/nope"\)/,
      ],
    ];
    const body =
      MODEL +
      dup +
      addresses
        .map(([addr]) => `\ntext ${addr} {\n  spell fra-Latn "x"\n}\n`)
        .join('');
    const issues = c89(makeTmpPackage(body));
    assert.equal(
      issues.length,
      addresses.length,
      `expected exactly one C89 issue per bad address, got: ${issues.map(i => i.message).join('\n')}`,
    );
    for (const [addr, pattern] of addresses) {
      const message = issues.find(i =>
        i.message.startsWith(`text "${addr}":`),
      )?.message;
      assert.ok(
        message !== undefined && pattern.test(message),
        `expected one C89 issue on ${addr} matching ${pattern}, got: ${message ?? '(none)'}`,
      );
    }
  });
});

describe('corpus-clean leg (additive/OCP — the 23 shipped packages)', () => {
  it(
    'shows zero errors and zero C89 issues across the corpus',
    { skip: CORPUS_SKIP },
    () => {
      const dirs = readdirSync(CORPUS)
        .map(d => join(CORPUS, d))
        .filter(d => existsSync(join(d, 'package.primmel')))
        .sort();
      assert.equal(
        dirs.length,
        28,
        `expected the 28-package corpus at ${CORPUS} (acme-cgm-system + oiml-integrated-ref joined since the 26 pin)`,
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
          issues.filter(i => i.check === 'C89'),
          [],
          `${dir}: a corpus without text blocks must show no C89 issues (additive silence)`,
        );
      }
    },
  );
});
