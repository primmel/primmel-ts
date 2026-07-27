// ─────────────────────────────────────────────────────────────────────
// The `formulas_used` construct (smart gap-close E11,
// analysis/architecture-gaps-2026-07.md; the smart contract
// data/schemas/formulas-used.yaml + data/r60/specification/
// formulas-used.yaml): the per-test evaluation-formula trace of a
// Recommendation — the first-class replacement for the hand-authored
// supplemental YAML. The fixture is the REAL R 60 MDLO entry with its
// clause provenance. Covers the parse (all facet shapes, incl. the
// comma/semicolon noise spellings and the malformed missing-facets
// block), the round-trip fixpoint (incl. a malformed model), the
// linter rule
//   C94 formulas-used-shape
// the `uses` composition leg (the traces merge like the invariant and
// test-sequence collections — MERGE_FIELDS), the C89 text-addressing
// leg (text <test-ref>.description resolves against the construct),
// the parse-time duplicate-id uniqueness leg (the collection key IS
// the test reference), and the corpus-clean leg: the 19 shipped
// packages show zero errors and zero formulas-used-rule issues
// (additive/OCP — packages without a trace are untouched).
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
import { loadPackage, loadPackageWithIssues } from '../src/ser-des/package';
import { checkPackage } from '../src/check';

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
    `formulas-used.test.ts: skipping the corpus-clean spec — ${CORPUS_SKIP}`,
  );
}

// The real R 60 entry (data/r60/specification/formulas-used.yaml) recoded
// to the construct — the semantic contract's dogfood fixture. The block
// symbol IS the conformance-test reference (the `text /req/…` idiom).
const MDLO = `
formulas_used /conf/metrological-tests/measurement-error-repeatability-mdlo {
  name "MDLO evaluation formulas"
  description "The evaluation-level quantities of R 60-3, 2.1 the MDLO test derives from the indication output: the conversion factor f (2.1.2.4), the load cell error E_L (2.1.2), the repeatability error E_R (2.1.3), and the raw temperature effect on MDLO of one temperature step C_M (2.1.4 — the normalization to v_min per temperature increment lives exactly once in the mdlo_normalized VerdictQuantity)."
  formulas { conversion_factor_f e_l e_r c_m }
  source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1" }
}
`;

// A second trace (a different test) for the multi-entry legs.
const CREEP = `
formulas_used /conf/metrological-tests/creep {
  name "Creep evaluation formulas"
  description "The creep test's evaluation-level formulas."
  formulas { e_c }
  source { doc "urn:oiml:pub:r:60-3:2021" clause "2.2" }
}
`;

const CLEAN = MDLO + CREEP;

function makeTmpPackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-formulas-used-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'formulas-used.prl'), body);
  return dir;
}

const FORMULAS_USED_RULES = ['C94'];

function formulasUsedIssues(dir: string) {
  return checkPackage(dir).filter(i => FORMULAS_USED_RULES.includes(i.check));
}

describe('formulas_used — parse (smart gap-close E11)', () => {
  it('parses the full formulas-used block (the R 60 MDLO trace)', () => {
    const m = load(MDLO);
    assert.equal(m.formulasUsed.length, 1);
    const fu = m.formulasUsed[0];
    assert.equal(
      fu.id,
      '/conf/metrological-tests/measurement-error-repeatability-mdlo',
    );
    assert.equal(fu.name, 'MDLO evaluation formulas');
    assert.ok(
      fu.description.startsWith('The evaluation-level quantities of R 60-3'),
    );
    assert.deepEqual(fu.formulas, ['conversion_factor_f', 'e_l', 'e_r', 'c_m']);
    assert.deepEqual(fu.sourceRefs, [
      { doc: 'urn:oiml:pub:r:60-3:2021', clause: '2.1' },
    ]);
  });

  it('parses the comma/semicolon noise spellings and accumulates repeated formulas facets', () => {
    const m = load(`
formulas_used /conf/x {
  name "X"
  description "d"
  formulas { conversion_factor_f, e_l; e_r }
  formulas { c_m }
}
`);
    assert.deepEqual(m.formulasUsed[0].formulas, [
      'conversion_factor_f',
      'e_l',
      'e_r',
      'c_m',
    ]);
  });

  it('parses a single bare formulas entry', () => {
    const m = load(
      'formulas_used /conf/x {\n  name "X"\n  description "d"\n  formulas e_l\n}\n',
    );
    assert.deepEqual(m.formulasUsed[0].formulas, ['e_l']);
  });

  it('parses multiple source blocks in declared order', () => {
    const m = load(`
formulas_used /conf/x {
  name "X"
  description "d"
  formulas { e_l }
  source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1" }
  source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1.2.4" }
}
`);
    assert.deepEqual(m.formulasUsed[0].sourceRefs, [
      { doc: 'urn:oiml:pub:r:60-3:2021', clause: '2.1' },
      { doc: 'urn:oiml:pub:r:60-3:2021', clause: '2.1.2.4' },
    ]);
  });

  it('stays total on a malformed formulas_used (the linter judges, not the parser)', () => {
    const m = load('formulas_used /conf/broken {\n  name "B"\n}\n');
    assert.equal(m.formulasUsed.length, 1);
    const fu = m.formulasUsed[0];
    assert.equal(fu.name, 'B');
    assert.equal(fu.description, '');
    assert.deepEqual(fu.formulas, []);
    assert.deepEqual(fu.sourceRefs, []);
  });

  it('ignores unknown facets (forward compatibility) — C94 still catches the missing shape', () => {
    const m = load(
      'formulas_used /conf/future {\n  name "F" description "d" rationale "not yet a facet"\n  formulas { e_l }\n}\n',
    );
    const fu = m.formulasUsed[0];
    assert.equal(fu.name, 'F');
    assert.equal(fu.description, 'd');
    assert.deepEqual(fu.formulas, ['e_l']);
  });

  it('round-trips the whole model losslessly (fixpoint)', () => {
    const m1 = load(CLEAN);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.formulasUsed, m1.formulasUsed);
    assert.equal(dump(m2), dumped);
  });

  it('round-trips a MALFORMED model byte-clean (every facet missing)', () => {
    // The parser stays total on a facets-undeclared block; the dump must
    // re-emit the empty form so the re-parse reproduces the malformed
    // model exactly — the linter (C94), not the codec, owns the judgment.
    const malformed = 'formulas_used /conf/broken {\n}\n';
    const m1 = load(malformed);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.formulasUsed, m1.formulasUsed);
    assert.equal(dump(m2), dumped);
  });

  it('quotes the free strings on dump (the comment-character # hazard)', () => {
    // A description carrying the tokenizer's comment character must
    // re-parse exactly — free strings never go bare (the E9
    // source-quoting pin); doc/clause stay quoted too.
    const withHash = `
formulas_used /conf/hash {
  name "H"
  description "see docs/formulas.md#anchor for the rationale"
  formulas { e_l }
  source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1" }
}
`;
    const dumped = dump(load(withHash));
    assert.ok(
      dumped.includes(
        'description "see docs/formulas.md#anchor for the rationale"',
      ),
      `expected the description quoted in the dump, got:\n${dumped}`,
    );
    assert.ok(
      dumped.includes('source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1" }'),
      `expected the source doc/clause quoted in the dump, got:\n${dumped}`,
    );
    const m2 = load(dumped);
    assert.equal(
      m2.formulasUsed[0].description,
      'see docs/formulas.md#anchor for the rationale',
    );
  });

  it('emits the test reference BARE (the text /req/… idiom) — and a quoted spelling is a different id', () => {
    // The canonical surface syntax is the bare reference-shaped id: the
    // dump emits it bare and the re-parse lands on the same id. A quoted
    // spelling tokenizes differently, so it lands on a DIFFERENT id and
    // round-trips as its own entry — authors pick one spelling (the
    // corpus pins the bare one).
    const dumped = dump(load(MDLO));
    assert.ok(
      dumped.includes(
        'formulas_used /conf/metrological-tests/measurement-error-repeatability-mdlo {',
      ),
      `expected the bare test reference in the dump, got:\n${dumped}`,
    );
    const quoted = load(
      'formulas_used "/conf/x" {\n  name "X"\n  description "d"\n  formulas { e_l }\n}\n',
    );
    assert.equal(quoted.formulasUsed[0].id, '"/conf/x"');
    const requoted = dump(quoted);
    assert.ok(
      requoted.includes('formulas_used "/conf/x" {'),
      `expected the quoted spelling to round-trip as its own id, got:\n${requoted}`,
    );
    assert.equal(load(requoted).formulasUsed[0].id, '"/conf/x"');
  });
});

describe('formulas_used lint rule (C94)', () => {
  it('stays silent on clean formulas-used declarations', () => {
    const issues = formulasUsedIssues(makeTmpPackage(CLEAN));
    assert.deepEqual(
      issues,
      [],
      `expected no formulas-used issues, got: ${issues.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
    );
  });

  it('C94 fires on a missing name, description, or formulas list', () => {
    const noName = formulasUsedIssues(
      makeTmpPackage(MDLO.replace('  name "MDLO evaluation formulas"\n', '')),
    ).filter(i => i.check === 'C94');
    assert.ok(noName.some(i => i.message.includes('no name')));

    const noDescription = formulasUsedIssues(
      makeTmpPackage(
        MDLO.replace(/ {2}description "The evaluation-level[^"]*"\n/, ''),
      ),
    ).filter(i => i.check === 'C94');
    assert.ok(noDescription.some(i => i.message.includes('no description')));

    const noFormulas = formulasUsedIssues(
      makeTmpPackage(
        'formulas_used /conf/x {\n  name "X"\n  description "d"\n}\n',
      ),
    ).filter(i => i.check === 'C94');
    assert.ok(noFormulas.some(i => i.message.includes('no formulas')));

    const emptyBlock = formulasUsedIssues(
      makeTmpPackage(
        'formulas_used /conf/x {\n  name "X"\n  description "d"\n  formulas {}\n}\n',
      ),
    ).filter(i => i.check === 'C94');
    assert.ok(emptyBlock.some(i => i.message.includes('no formulas')));
  });

  it('C94 fires on a malformed formula identifier (the snake_case shape)', () => {
    const issues = formulasUsedIssues(
      makeTmpPackage(
        'formulas_used /conf/x {\n  name "X"\n  description "d"\n  formulas { e_l E_R 1c c-m }\n}\n',
      ),
    ).filter(i => i.check === 'C94');
    assert.ok(issues.some(i => i.message.includes('"E_R"')));
    assert.ok(issues.some(i => i.message.includes('"1c"')));
    assert.ok(issues.some(i => i.message.includes('"c-m"')));
    assert.ok(
      !issues.some(i => i.message.includes('"e_l"')),
      'the well-formed e_l must not be flagged',
    );
    assert.equal(issues.length, 3);
  });

  it('C94 fires on an empty test reference (the quoted-empty id spelling)', () => {
    const issues = formulasUsedIssues(
      makeTmpPackage(
        'formulas_used "" {\n  name "X"\n  description "d"\n  formulas { e_l }\n}\n',
      ),
    ).filter(i => i.check === 'C94');
    assert.ok(issues.some(i => i.message.includes('no test reference')));
  });

  it('C94 does NOT resolve formula ids (the smart-side linker R41 owns resolution)', () => {
    // A dangling formula identifier is well-formed syntax — the kernel
    // checks shape only, exactly like E9's C90/C91 vs R38 and E10's
    // C92/C93 vs R39 split.
    const issues = formulasUsedIssues(
      makeTmpPackage(
        'formulas_used /conf/x {\n  name "X"\n  description "d"\n  formulas { no_such_formula_anywhere }\n}\n',
      ),
    );
    assert.deepEqual(issues, []);
  });

  it('entry uniqueness per test is the parse-time duplicate-id rule (the key IS the test ref)', () => {
    const dir = makeTmpPackage(MDLO + MDLO);
    const { issues } = loadPackageWithIssues(dir);
    assert.ok(
      issues.some(
        i =>
          i.code === 'duplicate-id' &&
          i.message.includes(
            '/conf/metrological-tests/measurement-error-repeatability-mdlo',
          ),
      ),
      `expected a duplicate-id issue for the repeated test ref, got: ${JSON.stringify(issues)}`,
    );
  });

  it('formulas-used traces are additive: a package without one shows no formulas-used issues', () => {
    const issues = formulasUsedIssues(
      makeTmpPackage('term t {\n  label "t"\n}\n'),
    );
    assert.deepEqual(issues, []);
  });
});

describe('formulas_used — uses composition (MERGE_FIELDS, the invariant-collection parity)', () => {
  it('composes formulas-used traces through `uses` like the doctrine collections', () => {
    // The smart layout: shared doctrine lives in a foundation package;
    // every rec package composes it. The composed model must carry the
    // traces — as it does the invariants and test sequences today.
    const coreDir = mkdtempSync(join(tmpdir(), 'primmel-fu-core-'));
    writeFileSync(
      join(coreDir, 'package.primmel'),
      'package { id toy-core kind core }',
    );
    mkdirSync(join(coreDir, 'specification'));
    writeFileSync(join(coreDir, 'specification', 'formulas-used.prl'), MDLO);

    const recDir = mkdtempSync(join(tmpdir(), 'primmel-fu-rec-'));
    writeFileSync(
      join(recDir, 'package.primmel'),
      'package { id toy-rec kind rec uses { toy-core } }',
    );
    mkdirSync(join(recDir, 'model'));
    writeFileSync(
      join(recDir, 'model', 'terms.prl'),
      'term t {\n  label "t"\n}\n',
    );

    const dirs = new Map([
      ['toy-core', coreDir],
      ['toy-rec', recDir],
    ]);
    const composed = loadPackage(recDir, {
      resolvePackage: (id: string) => dirs.get(id),
    });
    assert.equal(composed.formulasUsed.length, 1);
    assert.equal(
      composed.formulasUsed[0].id,
      '/conf/metrological-tests/measurement-error-repeatability-mdlo',
    );
  });

  it('uses-no-redefine protects a formulas_used id across packages', () => {
    const coreDir = mkdtempSync(join(tmpdir(), 'primmel-fu-core-'));
    writeFileSync(
      join(coreDir, 'package.primmel'),
      'package { id toy-core kind core }',
    );
    mkdirSync(join(coreDir, 'specification'));
    writeFileSync(join(coreDir, 'specification', 'formulas-used.prl'), MDLO);

    const recDir = mkdtempSync(join(tmpdir(), 'primmel-fu-rec-'));
    writeFileSync(
      join(recDir, 'package.primmel'),
      'package { id toy-rec kind rec uses { toy-core } }',
    );
    mkdirSync(join(recDir, 'model'));
    writeFileSync(join(recDir, 'model', 'formulas-used.prl'), MDLO);

    const dirs = new Map([
      ['toy-core', coreDir],
      ['toy-rec', recDir],
    ]);
    assert.throws(
      () =>
        loadPackage(recDir, {
          resolvePackage: (id: string) => dirs.get(id),
        }),
      /redefines formulasUsed id "\/conf\/metrological-tests\/measurement-error-repeatability-mdlo"/,
    );
  });
});

describe('formulas_used — ISO 24229 text addressing (TODO.roadmap/25)', () => {
  it('text <test-ref>.description resolves against the trace (C89 stays silent)', () => {
    // The description's alternate spellings ride the same machinery
    // every prose field uses — the trace's test reference is a
    // registered element id.
    const issues = checkPackage(
      makeTmpPackage(
        MDLO +
          `
text /conf/metrological-tests/measurement-error-repeatability-mdlo.description {
  spell fra-Latn "les grandeurs du niveau évaluation que l'essai MDLO dérive de la sortie d'indication."
}
`,
      ),
    ).filter(i => i.check === 'C89');
    assert.deepEqual(
      issues,
      [],
      `expected text <test-ref>.description to resolve, got: ${issues.map(i => i.message).join('\n')}`,
    );
  });
});

describe('corpus-clean leg (additive/OCP — the 19 shipped packages)', () => {
  it(
    'shows zero errors and zero formulas-used-rule issues across the corpus',
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
          issues.filter(i => FORMULAS_USED_RULES.includes(i.check)),
          [],
          `${dir}: a package without a formulas-used trace must show no formulas-used-rule issues`,
        );
      }
    },
  );
});
