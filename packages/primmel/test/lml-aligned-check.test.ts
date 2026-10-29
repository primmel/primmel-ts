// ─────────────────────────────────────────────────────────────────────
// The LML-aligned substrate's checker rules (TODO.lang-gaps; the spec's
// validation contract, language-v3 §16). The five constructs (mapping /
// string_format / namespace / datum / check) carry their declared data;
// the checker does the discipline:
//   C158 prose-quarantine
//   C159 urn-only-refs
//   C160 signature-closure
//   C161 check-surface          (the boolean-spelling fold — see
//                               boolean-fold.test.ts for the parse side)
//   C162 namespace-coherence
//   C163 change-levels         (catalog only — runs over `primmel diff
//                               --exit-code`, the existing diff classifier)
//   C164 wire-mapping-coverage
//   C165 math-symbols-declared (catalog only — RESERVED, the calculation
//                               math plane)
//   C166 math-parses           (catalog only — RESERVED, the calculation
//                               math plane)
//   C167 qualified-unit-reference
//   C189 datum-render-notation (the render-notation leg re-homed from
//                               the formerly mislabeled C161 row)
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkLmlAligned, checkPackage, type CheckIssue } from '../src/check';
import { checkRule } from '../src/check-rules';
import { formFoldChecks } from '../src/ser-des/config/check-fold';

/** Load a model and run the LML-aligned rules over it. */
function check(model: string): CheckIssue[] {
  return checkLmlAligned(load(model));
}

/** `<id> <severity>` lines — the assertion surface for rule firing. */
function fired(model: string): string[] {
  return check(model).map(i => `${i.check} ${i.severity}`);
}

describe('C158 prose-quarantine', () => {
  it('a clause citation in a description is an error — the ref belongs in a urn', () => {
    assert.deepEqual(
      check(`
        datum d1 : number {
          label "D1"
          description { see clause-3 of the source document }
        }
      `),
      [
        {
          check: 'C158',
          severity: 'error',
          message:
            'datum d1: the description cites a clause — a reference in prose belongs in a urn reference, not the quarantined free text (prose-quarantine)',
        },
      ],
    );
  });

  it('a § citation is caught too', () => {
    const got = check(`
      datum d1 : number {
        description { per §4 the reading is maximum }
      }
    `);
    assert.equal(got.length, 1);
    assert.equal(got[0]!.check, 'C158');
    assert.equal(got[0]!.severity, 'error');
  });

  it('the unfinished-prose TODO.roadmap marker warns', () => {
    const got = check(`
      datum d1 : number {
        description { TODO.roadmap: fill in the provenance }
      }
    `);
    assert.equal(got.length, 1);
    assert.equal(got[0]!.check, 'C158');
    assert.equal(got[0]!.severity, 'warning');
  });

  it('plain prose stays legal; a label with an empty description is the fine form', () => {
    assert.deepEqual(
      fired(`
        datum fine : number {
          label "Fine"
          description { a plain reading of the instrument panel }
        }
        datum minimal : string {
          label "Minimal"
        }
      `),
      [],
    );
  });
});

describe('C159 urn-only-refs', () => {
  it('a mapping namespace naming no declared namespace block is an error', () => {
    const got = check(`
      mapping xml Order {
        element "order"
        namespace GhostNs
      }
    `);
    assert.equal(got.length, 1);
    assert.equal(got[0]!.check, 'C159');
    assert.equal(got[0]!.severity, 'error');
    assert.match(got[0]!.message, /mapping xml:Order/);
    assert.match(got[0]!.message, /"GhostNs"/);
  });

  it('a declared namespace resolves silently', () => {
    assert.deepEqual(
      fired(`
        namespace OrderNs {
          uri "https://example.com/orders"
          prefix "ord"
        }
        mapping xml Order {
          element "order"
          namespace OrderNs
        }
      `),
      [],
    );
  });
});

describe('C160 signature-closure', () => {
  it('an input naming no declared datum or symbol is an error', () => {
    const got = check(`
      symbol c_k { label "k" }
      check c1 {
        inputs { c_k phantom }
        expression "c_k * phantom"
        operator >
        threshold 1
      }
    `);
    assert.equal(got.length, 1);
    assert.equal(got[0]!.check, 'C160');
    assert.equal(got[0]!.severity, 'error');
    assert.match(got[0]!.message, /input "phantom"/);
  });

  it('inputs naming declared datums and symbols resolve silently', () => {
    assert.deepEqual(
      fired(`
        datum temperature : number {
          label "T"
        }
        symbol c_k { label "k" }
        check hot {
          inputs { temperature c_k }
          expression "temperature"
          operator >
          threshold c_k
        }
      `),
      [],
    );
  });
});

describe('C161 check-surface (the fold completeness walk)', () => {
  it('a spelling whose folded check never materialized is an error', () => {
    // The parsers fold at parse (ser-des/config/check-fold.ts); this leg
    // guards Standards built by hand or by an older parser — the walks'
    // expectation is the same derivation the parsers registered by. The
    // pass_fail surface refuses at parse now, so the owner rides in on
    // the type (the hand-built/older-parser shape the walk exists for).
    const standard = load(`
      form temperature_test {
        name "Temperature test"
      }
    `);
    standard.forms[0]!.passFail = {
      criteria: 'The reading stays within the MPE.',
      passIf: 'ocl{within_mpe}',
      derivations: [],
    };
    standard.checks = standard.checks.filter(c => !c.folds);
    const got = checkLmlAligned(standard);
    assert.equal(got.length, 1);
    assert.equal(got[0]!.check, 'C161');
    assert.equal(got[0]!.severity, 'error');
    assert.match(got[0]!.message, /form:temperature_test:pass_fail/);
  });

  it('a hand-built owner whose fold materialized — the walk stays silent', () => {
    const standard = load(`
      form temperature_test {
        name "Temperature test"
      }
      requirement /req/mpe {
        name "MPE"
        limit {
          expression "ocl{abs(e) <= mpe}"
          uses { e mpe }
        }
      }
    `);
    standard.forms[0]!.passFail = {
      criteria: 'The reading stays within the MPE.',
      passIf: 'ocl{within_mpe}',
      derivations: [],
    };
    // the parse of an older kernel (or the hand-builder) registered the
    // fold — materialize it the same way the parsers do
    for (const fold of formFoldChecks(standard.forms[0]!)) {
      standard.checks.push(fold);
    }
    assert.deepEqual(
      checkLmlAligned(standard).filter(i => i.check === 'C161'),
      [],
    );
  });
});

describe('C189 datum-render-notation', () => {
  it('a render hint with an unknown notation is an error', () => {
    // The parser silently DROPS an unknown notation token, so a parsed
    // model never carries one — this leg guards programmatically built
    // Standards and pins the closed vocabulary against renderer growth.
    // (Re-homed from the C161 id: the row predates the spec's C161
    // check-surface rule — the boolean fold owns that id now.)
    const standard = load(`
      datum d1 : number {
        render latex "T"
      }
    `);
    standard.datums[0]!.renders.push({
      notation: 'mathjax' as never,
      text: 'x',
    });
    const got = checkLmlAligned(standard);
    assert.equal(got.length, 1);
    assert.equal(got[0]!.check, 'C189');
    assert.equal(got[0]!.severity, 'error');
    assert.match(got[0]!.message, /"mathjax"/);
  });

  it('the declared notations stay legal', () => {
    assert.deepEqual(
      fired(`
        datum d1 : number {
          render asciimath "T"
          render latex "T"
          render unicodemath "T"
          render mathml "T"
          render omml "T"
        }
      `),
      [],
    );
  });
});

describe('C162 namespace-coherence', () => {
  it('a metadata namespace naming no declared namespace block is an error', () => {
    const got = check(`
      metadata {
        title "T"
        schema "MMEL 0.1"
        edition "1"
        author "A"
        namespace Wrong
        shortname ""
      }
      namespace Good {
        uri "https://example.com/good"
        prefix "g"
      }
    `);
    assert.equal(got.length, 1);
    assert.equal(got[0]!.check, 'C162');
    assert.equal(got[0]!.severity, 'error');
    assert.match(got[0]!.message, /"Wrong"/);
  });

  it('the matching metadata namespace stays silent', () => {
    assert.deepEqual(
      fired(`
        metadata {
          title "T"
          schema "MMEL 0.1"
          edition "1"
          author "A"
          namespace Good
          shortname ""
        }
        namespace Good {
          uri "https://example.com/good"
          prefix "g"
        }
      `),
      [],
    );
  });

  it('no declared namespaces means nothing to name — the MMEL-era estate stays silent', () => {
    assert.deepEqual(
      fired(`
        metadata {
          title "T"
          schema "MMEL 0.1"
          edition "1"
          author "A"
          namespace T
          shortname ""
        }
      `),
      [],
    );
  });
});

describe('C164 wire-mapping-coverage', () => {
  it('a mapping whose class is no declared dataclass is an error', () => {
    const got = check(`
      class Order#data {
        attribute a, string { definition { A } }
      }
      mapping yaml Ghost {
        map "id" a
      }
    `);
    assert.equal(got.length, 1);
    assert.equal(got[0]!.check, 'C164');
    assert.equal(got[0]!.severity, 'error');
    assert.match(got[0]!.message, /"Ghost"/);
  });

  it('the authored class name matches — bare for a plain class, #data-stripped for a registerable one', () => {
    assert.deepEqual(
      fired(`
        class Ceramic {
          field location, string { definition { loc } }
        }
        class Order#data {
          attribute a, string { definition { A } }
        }
        mapping xml Ceramic {
          element "ceramic"
        }
        mapping yaml Order {
          map "a" a
        }
      `),
      [],
    );
  });

  it('no dataclasses declared means no class to miss — the mapping stays unchecked', () => {
    assert.deepEqual(
      fired(`
        mapping xml Orphan {
          element "orphan"
        }
      `),
      [],
    );
  });
});

describe('C167 qualified-unit-reference', () => {
  it('a bare unit and a bare quantity_kind are errors', () => {
    const got = check(`
      datum reading : number {
        unit kelvin
        quantity_kind temperature
        label "Reading"
      }
    `);
    assert.deepEqual(
      got.map(i => [i.check, i.severity] as const),
      [
        ['C167', 'error'],
        ['C167', 'error'],
      ],
    );
    assert.match(got[0]!.message, /unit "kelvin" is bare/);
    assert.match(got[1]!.message, /quantity_kind "temperature" is bare/);
  });

  it('the qualified si:/unitsdb: form stays legal; absent facets stay silent', () => {
    assert.deepEqual(
      fired(`
        datum reading : number {
          unit si:kelvin
          quantity_kind si:temperature
          label "Reading"
        }
        datum note : string {
          label "Note"
        }
      `),
      [],
    );
  });
});

describe('the catalog entries (C158–C167, C189)', () => {
  it('every rule resolves with its name, family, severity, and level', () => {
    const expected: Array<
      [string, string, string, 'error' | 'warning', 'normal' | 'audit']
    > = [
      ['C158', 'prose-quarantine', 'base', 'error', 'normal'],
      ['C159', 'urn-only-refs', 'base', 'error', 'normal'],
      ['C160', 'signature-closure', 'base', 'error', 'normal'],
      ['C161', 'check-surface', 'base', 'error', 'normal'],
      ['C162', 'namespace-coherence', 'base', 'error', 'normal'],
      ['C163', 'change-levels', 'base', 'error', 'normal'],
      ['C164', 'wire-mapping-coverage', 'base', 'error', 'normal'],
      ['C165', 'math-symbols-declared', 'quantities', 'warning', 'normal'],
      ['C166', 'math-parses', 'quantities', 'warning', 'normal'],
      ['C167', 'qualified-unit-reference', 'quantities', 'error', 'normal'],
      ['C189', 'datum-render-notation', 'base', 'error', 'normal'],
    ];
    for (const [id, name, family, severity, level] of expected) {
      const r = checkRule(id);
      assert.ok(r, `${id} missing from the catalog`);
      assert.equal(r!.name, name, id);
      assert.equal(r!.family, family, id);
      assert.equal(r!.severity, severity, id);
      assert.equal(r!.level, level, id);
    }
  });

  it('the catalog-only rules emit nothing here — registered, not faked', () => {
    // C163 runs over `primmel diff --exit-code`; C165/C166 await the
    // calculation math plane. A model exercising the LML constructs
    // must NOT grow issues under their ids.
    const got = check(`
      namespace OrderNs {
        uri "https://example.com/orders"
        prefix "ord"
      }
      class Order#data {
        attribute a, string { definition { A } }
      }
      mapping xml Order {
        element "order"
        namespace OrderNs
      }
      datum reading : number {
        unit si:kelvin
        quantity_kind si:temperature
        label "Reading"
      }
      check hot {
        inputs { reading }
        expression "reading"
        operator >
        threshold 100
      }
    `);
    assert.deepEqual(got, []);
  });
});

describe('the LML-aligned rules through checkPackage', () => {
  const NEW_RULE_IDS = ['C158', 'C159', 'C160', 'C161', 'C162', 'C164', 'C167'];

  function pkg(model: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'primmel-lml-'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'package.primmel'),
      'package { id p version "1" editions { 1 } baseUrn "urn:p:1" description "d" }',
    );
    writeFileSync(join(dir, 'model.prl'), model);
    return dir;
  }

  it('a bare unit fires C167 through the full entry point', () => {
    const dir = pkg(`
      datum reading : number {
        unit kelvin
        quantity_kind si:temperature
        label "Reading"
      }
    `);
    try {
      const got = checkPackage(dir).filter(i => NEW_RULE_IDS.includes(i.check));
      assert.equal(got.length, 1);
      assert.equal(got[0]!.check, 'C167');
      assert.equal(got[0]!.severity, 'error');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a clean LML-aligned model stays silent on every new rule', () => {
    const dir = pkg(`
      namespace OrderNs {
        uri "https://example.com/orders"
        prefix "ord"
      }
      class Order#data {
        attribute a, string { definition { A } }
      }
      mapping xml Order {
        element "order"
        namespace OrderNs
      }
      datum reading : number {
        unit si:kelvin
        quantity_kind si:temperature
        label "Reading"
        description { the panel reading at reference conditions }
      }
      check hot {
        inputs { reading }
        expression "reading"
        operator >
        threshold 373.15
      }
    `);
    try {
      const got = checkPackage(dir).filter(i => NEW_RULE_IDS.includes(i.check));
      assert.deepEqual(
        got,
        [],
        `expected no LML-aligned issues, got: ${got
          .map(i => `[${i.check}] ${i.message}`)
          .join('\n')}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// The datum unification's table-columns rung (wave 04 PR 3,
// TODO.lang-gaps/04, spec [[datum-unification]] via primmel/spec#87).
// DOCUMENT-ONLY for the column: the doctrine's carrier enumeration has
// FOUR carriers (attribute_definition / identity_slot /
// has_parameters / form field) and the table column is not one —
// "a table column types the column and states the cells — both
// reference the substrate, never re-declare it". The typed column
// entry is the substrate's PROJECTION: {name, type, unit} IS the
// datum's {id, type, unit} value core, with no plane extras of its
// own, so there is no second spelling to cohere (no C191 surface) and
// no bare-id member to resolve (no C190 surface) — no grammar change,
// no C-row, no checker2 mirror. The rung exposed the substrate's head
// type dropping silently at parse; the capture fix above makes the
// projection's type axis real, and this block pins it: the projection,
// the clean column↔datum coexistence (no invented leg), the fixpoint.
// ─────────────────────────────────────────────────────────────────────

describe("the datum unification's table-columns rung (wave 04 PR 3)", () => {
  const SRC = `datum load_min : number {
  unit si:metre
  label "Minimum load"
}
table tiers {
  title "Tiers"
  columns {
    accuracy_class: string
    load_min: number "m"
  }
  data {
    "A" "0.5"
  }
}
`;

  function pkg(): string {
    const dir = mkdtempSync(join(tmpdir(), 'primmel-datum-col-'));
    writeFileSync(
      join(dir, 'package.primmel'),
      'package { id p version "1" editions { 1 } baseUrn "urn:p:1" description "d" }',
    );
    writeFileSync(join(dir, 'model.prl'), SRC);
    return dir;
  }

  it('the typed column entry is the datum value core (the projection)', () => {
    const m = load(SRC);
    const d = m.datums.find(x => x.id === 'load_min')!;
    const c = m.tables[0]!.columnDefs!.find(x => x.name === 'load_min')!;
    assert.equal(c.name, d.id);
    // The type axis is real on BOTH spellings: the datum's authored
    // head type captures (the PR 3 capture fix), the column's type
    // token is the same value-type vocabulary.
    assert.equal(d.type, 'number');
    assert.equal(c.type, d.type);
    // The unit axis is present on both spellings (the column's is the
    // display string, the datum's the registry reference — C167).
    assert.ok(c.unit);
    assert.ok(d.unit);
  });

  it('the column↔datum coexistence checks clean (no invented leg)', () => {
    const dir = pkg();
    try {
      assert.deepEqual(checkPackage(dir), []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the combined model round-trips (authored spelling emitted)', () => {
    const m1 = load(SRC);
    const dumped = dump(m1);
    // The datum dump re-emits the authored head type; the columns block
    // re-emits the authored name/type/unit spellings.
    assert.ok(dumped.includes('datum load_min : number {'));
    assert.ok(dumped.includes('load_min: number "m"'));
    const m2 = load(dumped);
    assert.deepEqual(m2.datums, m1.datums);
    assert.deepEqual(m2.tables, m1.tables);
    assert.equal(dump(m2), dumped);
  });
});
