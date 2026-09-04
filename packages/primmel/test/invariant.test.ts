// ─────────────────────────────────────────────────────────────────────
// The `invariant` construct (smart gap-close E9,
// analysis/architecture-gaps-2026-07.md; the smart doctrine
// docs/oiml-core/09-invariants.md): named architecture invariants — the
// first-class replacement for the note-family encoding (pipe-delimited
// structure inside a note's message string). Covers the parse (all
// facet shapes, incl. the comma/semicolon and bare-entry spellings),
// the round-trip fixpoint (incl. a malformed both-set model), the
// linter rules
//   C90 invariant-shape
//   C91 invariant-enforcement-grammar
// the `uses` composition leg (invariants merge like the note collection
// they replace — MERGE_FIELDS), the C89 text-addressing leg
// (text INV-1.statement resolves against the construct), and the
// corpus-clean leg: the 23 shipped packages show zero errors and zero
// invariant-rule issues (additive/OCP — packages without an invariant
// are untouched).
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
    `invariant.test.ts: skipping the corpus-clean spec — ${CORPUS_SKIP}`,
  );
}

const CLEAN = `
invariant INV-1 {
  name "No bare numbers"
  statement "every physical quantity is a QuantityValue (value + unit [+ uncertainty])."
  severity error
  applies_to { QuantityValue }
  source "docs/oiml-core/09-invariants.md#9.2"
  enforcement { kernel:C32 kernel:C33 linker:quantity-coherence linker:pair-list-components gate:schema-quantity-value }
}
`;

const ASPIRATIONAL = `
invariant INV-99 {
  name "Future rule"
  statement "a rule the gates will one day enforce."
  severity notice
  enforcement aspirational
}
`;

function makeTmpPackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-invariant-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'invariants.prl'), body);
  return dir;
}

const INVARIANT_RULES = ['C90', 'C91'];

function invariantIssues(dir: string) {
  return checkPackage(dir).filter(i => INVARIANT_RULES.includes(i.check));
}

describe('invariant — parse (smart gap-close E9)', () => {
  it('parses the full invariant block', () => {
    const m = load(CLEAN);
    assert.equal(m.invariants.length, 1);
    const inv = m.invariants[0];
    assert.equal(inv.id, 'INV-1');
    assert.equal(inv.name, 'No bare numbers');
    assert.equal(
      inv.statement,
      'every physical quantity is a QuantityValue (value + unit [+ uncertainty]).',
    );
    assert.equal(inv.severity, 'error');
    assert.deepEqual(inv.appliesTo, ['QuantityValue']);
    assert.equal(inv.source, 'docs/oiml-core/09-invariants.md#9.2');
    assert.deepEqual(inv.enforcement, {
      aspirational: false,
      claims: [
        'kernel:C32',
        'kernel:C33',
        'linker:quantity-coherence',
        'linker:pair-list-components',
        'gate:schema-quantity-value',
      ],
    });
  });

  it('parses the aspirational marker form (no list facets at all)', () => {
    const m = load(ASPIRATIONAL);
    const inv = m.invariants[0];
    assert.equal(inv.id, 'INV-99');
    assert.equal(inv.severity, 'notice');
    assert.deepEqual(inv.appliesTo, []);
    assert.equal(inv.source, '');
    assert.deepEqual(inv.enforcement, { aspirational: true, claims: [] });
  });

  it('parses the list spellings — commas, semicolons, and the bare single entry', () => {
    const m = load(`
invariant INV-2 {
  name "Schema/instance split"
  statement "an attribute is DEFINED once and VALUED per Model or Sample."
  severity error
  applies_to { AttributeDefinition, Parameter }
  enforcement { kernel:C1, linker:bind-paths; gate:codegen-entity-types }
}
invariant INV-3 {
  name "Single entry"
  statement "one bare entry per list facet."
  severity notice
  applies_to Verdict
  enforcement gate:verdict-reexecution
}
`);
    const [inv2, inv3] = m.invariants;
    assert.deepEqual(inv2.appliesTo, ['AttributeDefinition', 'Parameter']);
    assert.deepEqual(inv2.enforcement.claims, [
      'kernel:C1',
      'linker:bind-paths',
      'gate:codegen-entity-types',
    ]);
    assert.deepEqual(inv3.appliesTo, ['Verdict']);
    assert.deepEqual(inv3.enforcement, {
      aspirational: false,
      claims: ['gate:verdict-reexecution'],
    });
  });

  it('parses a quoted severity and escapes inside prose', () => {
    const m = load(`
invariant INV-4 {
  name "Reports contain no \\"verdicts\\""
  statement "D2 contains no verdicts. If a TestReport says 'pass', the schema is broken."
  severity "error"
  enforcement aspirational
}
`);
    const inv = m.invariants[0];
    assert.equal(inv.name, 'Reports contain no "verdicts"');
    assert.equal(inv.severity, 'error');
  });

  it('stays total on a malformed invariant (the linter judges, not the parser)', () => {
    const m = load('invariant broken {\n  severity error\n}\n');
    assert.equal(m.invariants.length, 1);
    const inv = m.invariants[0];
    assert.equal(inv.name, '');
    assert.equal(inv.statement, '');
    assert.deepEqual(inv.enforcement, { aspirational: false, claims: [] });
  });

  it('accumulates repeated enforcement facets so the linter sees a both-set declaration', () => {
    const m = load(`
invariant both {
  name "Both"
  statement "marker and claims."
  severity error
  enforcement aspirational
  enforcement { kernel:C1 }
}
`);
    assert.deepEqual(m.invariants[0].enforcement, {
      aspirational: true,
      claims: ['kernel:C1'],
    });
  });

  it('ignores unknown facets (forward compatibility) — C90 still catches the missing shape', () => {
    const m = load(
      'invariant future {\n  name "F" statement "s" severity error enforcement aspirational\n  rationale "not yet a facet"\n}\n',
    );
    assert.equal(m.invariants.length, 1);
    assert.equal(m.invariants[0].name, 'F');
  });

  it('round-trips the whole model losslessly (fixpoint)', () => {
    const m1 = load(CLEAN + ASPIRATIONAL);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.invariants, m1.invariants);
    assert.equal(dump(m2), dumped);
  });

  it('round-trips a MALFORMED both-set model byte-clean (marker line + claims block)', () => {
    // The parser stays total on `enforcement aspirational` + a claims
    // block; the dump must re-emit BOTH lines so the re-parse reproduces
    // the malformed model exactly — the linter (C90), not the codec,
    // owns the judgment.
    const malformed = `
invariant both {
  name "Both"
  statement "marker and claims."
  severity error
  enforcement aspirational
  enforcement { kernel:C1 }
}
`;
    const m1 = load(malformed);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.invariants, m1.invariants);
    assert.equal(dump(m2), dumped);
  });

  it('quotes the source on dump (the doc anchor carries the comment character #)', () => {
    const dumped = dump(load(CLEAN));
    assert.ok(
      dumped.includes('source "docs/oiml-core/09-invariants.md#9.2"'),
      `expected the source quoted in the dump, got:\n${dumped}`,
    );
    const m2 = load(dumped);
    assert.equal(
      m2.invariants[0].source,
      'docs/oiml-core/09-invariants.md#9.2',
    );
  });
});

describe('invariant lint rules (C90–C91)', () => {
  it('stays silent on clean invariant declarations', () => {
    const issues = invariantIssues(makeTmpPackage(CLEAN + ASPIRATIONAL));
    assert.deepEqual(
      issues,
      [],
      `expected no invariant issues, got: ${issues.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
    );
  });

  it('C90 fires on a missing name, statement, or severity', () => {
    const noName = invariantIssues(
      makeTmpPackage(CLEAN.replace('  name "No bare numbers"\n', '')),
    ).filter(i => i.check === 'C90');
    assert.ok(noName.some(i => i.message.includes('no name')));

    const noStatement = invariantIssues(
      makeTmpPackage(
        CLEAN.replace(/ {2}statement "every physical quantity[^"]*"\n/, ''),
      ),
    ).filter(i => i.check === 'C90');
    assert.ok(noStatement.some(i => i.message.includes('no statement')));

    const noSeverity = invariantIssues(
      makeTmpPackage(CLEAN.replace('  severity error\n', '')),
    ).filter(i => i.check === 'C90');
    assert.ok(noSeverity.some(i => i.message.includes('no severity')));
  });

  it('C90 fires on a missing enforcement (neither claims nor aspirational)', () => {
    const issues = invariantIssues(
      makeTmpPackage(
        CLEAN.replace(/ {2}enforcement \{ kernel:C32[^}]*\}\n/, ''),
      ),
    ).filter(i => i.check === 'C90');
    assert.ok(issues.some(i => i.message.includes('no enforcement')));
  });

  it('C90 fires when the aspirational marker mixes with claims', () => {
    const issues = invariantIssues(
      makeTmpPackage(
        ASPIRATIONAL.replace(
          'enforcement aspirational',
          'enforcement aspirational\n  enforcement { kernel:C1 }',
        ),
      ),
    ).filter(i => i.check === 'C90');
    assert.ok(
      issues.some(
        i =>
          i.message.includes('aspirational') &&
          i.message.includes('never both'),
      ),
      `expected the both-set C90, got: ${issues.map(i => i.message).join('\n')}`,
    );
  });

  it('C90 does NOT judge the severity vocabulary (the smart side owns it)', () => {
    const issues = invariantIssues(
      makeTmpPackage(CLEAN.replace('severity error', 'severity banana')),
    ).filter(i => i.check === 'C90');
    assert.deepEqual(issues, []);
  });

  it('C91 fires on claims outside the grammar — per branch', () => {
    const bad = (claim: string) =>
      invariantIssues(
        makeTmpPackage(
          CLEAN.replace(
            'kernel:C32 kernel:C33 linker:quantity-coherence linker:pair-list-components gate:schema-quantity-value',
            claim,
          ),
        ),
      ).filter(i => i.check === 'C91');

    assert.ok(bad('kernel:C').some(i => i.message.includes('"kernel:C"')));
    assert.ok(bad('kernel:32').some(i => i.message.includes('"kernel:32"')));
    assert.ok(
      bad('linker:Quantity_Coherence').some(i =>
        i.message.includes('"linker:Quantity_Coherence"'),
      ),
    );
    assert.ok(bad('gate:').some(i => i.message.includes('"gate:"')));
    assert.ok(
      bad('schema-quantity-value').some(i =>
        i.message.includes('"schema-quantity-value"'),
      ),
    );

    // The grammar's positive branches all pass.
    assert.deepEqual(bad('kernel:C90 linker:r38-crosswalk gate:g-1'), []);
  });

  it('C91 fires on the aspirational marker inside a claims list', () => {
    const issues = invariantIssues(
      makeTmpPackage(
        CLEAN.replace(
          'enforcement { kernel:C32 kernel:C33 linker:quantity-coherence linker:pair-list-components gate:schema-quantity-value }',
          'enforcement { kernel:C32 aspirational }',
        ),
      ),
    ).filter(i => i.check === 'C91');
    assert.ok(
      issues.some(i =>
        i.message.includes('never appears inside a claims list'),
      ),
      `expected the mixing C91, got: ${issues.map(i => i.message).join('\n')}`,
    );
  });

  it('invariants are additive: a package without one shows no invariant issues', () => {
    const issues = invariantIssues(
      makeTmpPackage('term t {\n  label "t"\n}\n'),
    );
    assert.deepEqual(issues, []);
  });
});

describe('invariant — uses composition (MERGE_FIELDS, the note-collection parity)', () => {
  it('composes invariants through `uses` like the note family they replace', () => {
    // The smart layout: the doctrine lives in a foundation package
    // (oiml-smart-core); every rec package composes it. The composed
    // model must carry the invariants — as it does the notes today.
    const coreDir = mkdtempSync(join(tmpdir(), 'primmel-inv-core-'));
    writeFileSync(
      join(coreDir, 'package.primmel'),
      'package { id toy-core kind core }',
    );
    mkdirSync(join(coreDir, 'specification'));
    writeFileSync(join(coreDir, 'specification', 'invariants.prl'), CLEAN);

    const recDir = mkdtempSync(join(tmpdir(), 'primmel-inv-rec-'));
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
    assert.equal(composed.invariants.length, 1);
    assert.equal(composed.invariants[0].id, 'INV-1');
  });

  it('uses-no-redefine protects an invariant id across packages', () => {
    const coreDir = mkdtempSync(join(tmpdir(), 'primmel-inv-core-'));
    writeFileSync(
      join(coreDir, 'package.primmel'),
      'package { id toy-core kind core }',
    );
    mkdirSync(join(coreDir, 'specification'));
    writeFileSync(join(coreDir, 'specification', 'invariants.prl'), CLEAN);

    const recDir = mkdtempSync(join(tmpdir(), 'primmel-inv-rec-'));
    writeFileSync(
      join(recDir, 'package.primmel'),
      'package { id toy-rec kind rec uses { toy-core } }',
    );
    mkdirSync(join(recDir, 'model'));
    writeFileSync(join(recDir, 'model', 'invariants.prl'), CLEAN);

    const dirs = new Map([
      ['toy-core', coreDir],
      ['toy-rec', recDir],
    ]);
    assert.throws(
      () =>
        loadPackage(recDir, {
          resolvePackage: (id: string) => dirs.get(id),
        }),
      /redefines invariants id "INV-1"/,
    );
  });
});

describe('invariant — ISO 24229 text addressing (TODO.roadmap/25)', () => {
  it('text <id>.statement resolves against the invariant (C89 stays silent)', () => {
    // The statement's alternate spellings ride the same machinery every
    // prose field uses — the invariant is a registered element id.
    const issues = checkPackage(
      makeTmpPackage(
        CLEAN +
          `
text INV-1.statement {
  spell fra-Latn "toute grandeur physique est une QuantityValue."
}
`,
      ),
    ).filter(i => i.check === 'C89');
    assert.deepEqual(
      issues,
      [],
      `expected text INV-1.statement to resolve, got: ${issues.map(i => i.message).join('\n')}`,
    );
  });
});

describe('corpus-clean leg (additive/OCP — the 23 shipped packages)', () => {
  it(
    'shows zero errors and zero invariant-rule issues across the corpus',
    { skip: CORPUS_SKIP },
    () => {
      const dirs = readdirSync(CORPUS)
        .map(d => join(CORPUS, d))
        .filter(d => existsSync(join(d, 'package.primmel')))
        .sort();
      assert.equal(
        dirs.length,
        29,
        `expected the 29-package corpus at ${CORPUS} (oiml-cs-dataspace joined since the 28 pin)`,
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
          issues.filter(i => INVARIANT_RULES.includes(i.check)),
          [],
          `${dir}: a package without an invariant must show no invariant-rule issues`,
        );
      }
    },
  );
});
