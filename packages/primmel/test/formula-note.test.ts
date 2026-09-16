// ─────────────────────────────────────────────────────────────────────
// The formula_note register (smart TODO.roadmap/40 batch 4; the
// packages-as-SSOT epic) — one note text applying to MANY symbols (the
// reverse applicability the per-symbol note facet cannot express), and
// the C126 formula-note-targets-resolve linter rule (per-register
// gated, the C58 doctrine).
//
// Fixtures:
//   SYMBOLS  — two symbols the notes annotate.
//   NOTES    — the r60 carrier shape: note-1 applying to many symbols,
//              note-2 applying to one.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const SYMBOLS = `
symbol c_c {
  name "Creep coefficient"
  type number
}
symbol conversion_factor_f {
  name "Conversion factor f"
  type number
}
`;

const NOTES = `
formula_note note-1 {
  text "Observe extreme caution by referring to calculation procedure for correct application of these formulae."
  applies_to { c_c conversion_factor_f }
}
formula_note note-2 {
  text "Use with initial 20 °C ascending load run only. Refer to R 60-2, 2.8.2."
  applies_to { conversion_factor_f }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-fnote-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('formula_note construct (smart TODO.roadmap/40 batch 4)', () => {
  it('parses the register entries', () => {
    const m = load(NOTES);
    assert.equal(m.formulaNotes.length, 2);
    assert.equal(m.formulaNotes[0]!.id, 'note-1');
    assert.match(m.formulaNotes[0]!.text, /^Observe extreme caution/);
    assert.deepEqual(m.formulaNotes[0]!.appliesTo, [
      'c_c',
      'conversion_factor_f',
    ]);
    assert.deepEqual(m.formulaNotes[1]!.appliesTo, ['conversion_factor_f']);
  });

  it('round-trips the register losslessly (fixpoint)', () => {
    const once = dump(load(SYMBOLS + NOTES));
    const twice = dump(load(once));
    assert.equal(twice, once);
    assert.deepEqual(
      load(once).formulaNotes,
      load(SYMBOLS + NOTES).formulaNotes,
    );
  });
});

describe('C126 formula-note-targets-resolve', () => {
  function c126Issues(body: string) {
    return checkPackage(makePackage(body)).filter(i => i.check === 'C126');
  }

  it('accepts notes whose targets resolve', () => {
    assert.deepEqual(c126Issues(SYMBOLS + NOTES), []);
  });

  it('flags a dangling applies_to entry when symbols are in scope', () => {
    const issues = c126Issues(
      SYMBOLS +
        NOTES.replace(
          'applies_to { conversion_factor_f }',
          'applies_to { ghost_sym }',
        ),
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /ghost_sym/);
    assert.match(issues[0]!.message, /formula-note-targets-resolve/);
  });

  it('stays silent when the symbol register is out of scope', () => {
    // No symbols declared — the register is absent from composition
    // scope, so the edges are not adjudicated (the C58 doctrine).
    const issues = c126Issues(`
formula_note lonely {
  text "A note against symbols another package declares."
  applies_to { c_c }
}
`);
    assert.deepEqual(issues, []);
  });
});
