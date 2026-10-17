// ─────────────────────────────────────────────────────────────────────
// The step plane (register 19): the signature steps' typed ios, the
// completion carrier, C173, and the process:step.io dot-descent.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPackage } from '../src/ser-des/package';
import { checkPackage } from '../src/check';

const BODY = [
  'process scale {',
  '  name "Scaling"',
  '  step scale {',
  '    inputs { filtered_counts e_lim }',
  '    outputs { indication overload_flag }',
  '    completion "overload_flag = filtered_counts > e_lim"',
  '  }',
  '  step ghost {',
  '    inputs { a }',
  '    outputs { b }',
  '    completion "b = ghost_counts > a"',
  '  }',
  '}',
  'requirement /req/addresses {',
  '  name "A"',
  '  statement "S"',
  '  limit {',
  '    args {',
  '      ind <- process:scale.scale.indication',
  '      ghost <- process:scale.scale.ghost_io',
  '    }',
  '    expression {',
  '      ind >= 0',
  '    }',
  '  }',
  '}',
].join('\n');

function make(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-step-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'), { recursive: true });
  writeFileSync(join(dir, 'model', 'r.prl'), body);
  return dir;
}

describe('the step plane (register 19)', () => {
  it('types the signature steps and resolves the dot-descent', () => {
    const dir = make(BODY);
    const m = loadPackage(dir);
    const p = m.processes[0];
    const steps = p.steps ?? [];
    assert.equal(steps.length, 2);
    assert.deepEqual(steps[0]?.sigInputs, ['filtered_counts', 'e_lim']);
    assert.deepEqual(steps[0]?.sigOutputs, ['indication', 'overload_flag']);
    assert.equal(
      steps[0]?.completion,
      'overload_flag = filtered_counts > e_lim',
    );
    // C173: the ghost io in the ghost step's completion names; the
    // ghost io in the requirement's args names
    const msgs = checkPackage(dir)
      .filter(i => i.check === 'C171' || i.check === 'C173')
      .map(i => i.message);
    assert.ok(msgs.some(m => m.includes('"ghost_counts"')));
    assert.ok(msgs.some(m => m.includes('"ghost_io"')));
    rmSync(dir, { recursive: true, force: true });
  });

  it("holds the completion to the step's own ios", () => {
    const dir = make(BODY.replace('ghost_counts > a', 'unrelated > a'));
    const msgs = checkPackage(dir)
      .filter(i => i.check === 'C173')
      .map(i => i.message);
    assert.ok(msgs.some(m => m.includes('"unrelated"')));
    rmSync(dir, { recursive: true, force: true });
  });

  it('keeps the completion carrier honest', () => {
    const dir = make(
      BODY.replace(
        'completion "overload_flag = filtered_counts > e_lim"',
        'completion {\n        overload_flag = filtered_counts > e_lim\n      }',
      ),
    );
    const m = loadPackage(dir);
    const st = (m.processes[0].steps ?? [])[0];
    assert.equal(st?.completionBound, true);
    const msgs = checkPackage(dir).filter(i => i.check === 'C173');
    const ghost = msgs.filter(i => i.message.includes('"ghost_counts"'));
    assert.ok(ghost.length > 0);
    rmSync(dir, { recursive: true, force: true });
  });
});
