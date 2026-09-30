#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────
// The workflow-construct rewrite (phase 5 of the reconfiguration; file
// 09's auto-migration tooling): the deprecated process_model and
// workflow_stage declarations rewrite into the surviving process
// dialect — a `process_model <id> { sequence { a b c } }` becomes a
// canvas with its elements in sequence order and flow edges joining
// them; a `workflow_stage <id> { elements { ... } ... }` becomes a
// canvas with its elements (the stage's events and approvals remain
// declared at top level). The rewrite is byte-deterministic and prints
// one line per rewritten file.
//
//   migrate-workflow.mts <file.prl> [...]   rewrite in place
// ─────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from 'node:fs';

function seqToCanvas(id: string, ids: string[]): string {
  const lines: string[] = [
    `# (migrated from the deprecated process_model form — the sequence's`,
    `# pipeline becomes the canvas's elements and flow)`,
    `canvas ${id} {`,
    '  elements {',
  ];
  ids.forEach((e, i) => lines.push(`    ${e} { x ${i * 10} y 0 }`));
  lines.push('  }');
  if (ids.length > 1) {
    lines.push('  process_flow {');
    for (let i = 1; i < ids.length; i++) {
      lines.push(`    e${i} {`);
      lines.push(`      from ${ids[i - 1]}`);
      lines.push(`      to ${ids[i]}`);
      lines.push('    }');
    }
    lines.push('  }');
  }
  lines.push('}');
  return lines.join('\n');
}

export function migrateWorkflowConstructs(src: string): {
  out: string;
  rewrites: number;
} {
  let rewrites = 0;

  // process_model <id> { sequence { a b c } }
  const out = src.replace(
    /^process_model ([a-zA-Z_0-9-]+) \{\n(.*?)\n\}$/gm,
    (_m, id: string, body: string) => {
      const seq = body.match(/\s*sequence \{([^}]*)\}/);
      if (!seq) {
        return _m;
      }
      const ids = seq[1]!.trim().split(/\s+/).filter(Boolean);
      rewrites++;
      return seqToCanvas(id, ids);
    },
  );

  // workflow_stage <id> { label/description/elements/start/end/approvals }
  const out2 = out.replace(
    /^workflow_stage ([a-zA-Z_0-9-]+) \{\n(.*?)\n\}$/gms,
    (_m, id: string, body: string) => {
      const elements = body.match(/elements \{([^}]*)\}/);
      const ids = (elements?.[1] ?? '').trim().split(/\s+/).filter(Boolean);
      rewrites++;
      const lines: string[] = [
        `# (migrated from the deprecated workflow_stage form — the stage`,
        `# groups its elements; its start/end events and approvals remain`,
        `# declared at top level)`,
        `canvas ${id} {`,
        '  elements {',
      ];
      ids.forEach((e, i) => lines.push(`    ${e} { x ${i * 10} y 0 }`));
      lines.push('  }');
      lines.push('}');
      return lines.join('\n');
    },
  );

  return { out: out2, rewrites };
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: migrate-workflow.mts <file.prl> [...]');
  process.exit(2);
}
let total = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const { out, rewrites } = migrateWorkflowConstructs(src);
  if (rewrites > 0) {
    writeFileSync(f, out);
    total += rewrites;
    console.log(`${f}: ${rewrites} rewritten`);
  }
}
console.log(`total: ${total}`);
