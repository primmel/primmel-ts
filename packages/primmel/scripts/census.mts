// ─────────────────────────────────────────────────────────────────────
// The parsed-model census (the design lesson of the 2026-11-03
// campaigns: every corpus census ran as regex over text and
// mis-attributed at least once — the one-line constructs hid their
// hosts, the origin census missed a whole carrier). The parser already
// knows the truth; `primmel census` walks the PARSED package and
// prints the machine-readable facet inventory: the expression
// carriers' classes (inline | quoted | absent) per tracked plane, the
// origin axis histogram, and the datum/label surfaces. The model's
// wire keeps no authoring-keyword spelling (name and label parse into
// one field), so the text-level spellings stay a `--raw` concern, not
// this inventory's.
// ─────────────────────────────────────────────────────────────────────

import { loadPackageWithIssues } from '../src/ser-des/package.ts';
import type Standard from '../src/types/Standard.ts';

interface CarrierStat {
  inline: number;
  quoted: number;
  absent: number;
}

const stat = (carry: unknown, bound: unknown, present: boolean): CarrierStat => {
  const s: CarrierStat = { inline: 0, quoted: 0, absent: 0 };
  if (!present) {
    return s;
  }
  if (carry === undefined || carry === null || carry === '') {
    s.absent += 1;
  } else if (bound) {
    s.inline += 1;
  } else {
    s.quoted += 1;
  }
  return s;
};

const mergeStat = (a: CarrierStat, b: CarrierStat): CarrierStat => ({
  inline: a.inline + b.inline,
  quoted: a.quoted + b.quoted,
  absent: a.absent + b.absent,
});

export function censusCli(args: string[]): void {
  const dir = args.find(a => !a.startsWith('--'));
  if (!dir) {
    console.error('Usage: primmel census <package-dir> [--json]');
    process.exit(2);
  }
  const json = args.includes('--json');
  const { standard } = loadPackageWithIssues(dir);
  const st = standard as unknown as Record<string, unknown[]>;

  const carriers: Record<string, CarrierStat> = {};
  const bump = (plane: string, s: CarrierStat): void => {
    carriers[plane] = mergeStat(carriers[plane] ?? { inline: 0, quoted: 0, absent: 0 }, s);
  };

  for (const r of (st.requirements ?? []) as Record<string, never>[]) {
    const limit = r['limit'] as Record<string, unknown> | undefined;
    bump(
      'requirement.limit.expression',
      stat(limit?.expression, limit?.argsBound, Boolean(limit)),
    );
  }
  for (const v of (st.verdicts ?? []) as Record<string, unknown>[]) {
    bump('verdict.derive', stat(v['derive'], v['deriveBound'], true));
  }
  for (const t of (st.conformanceTests ?? []) as Record<string, never>[]) {
    for (const v of (t['variables'] ?? []) as Record<string, unknown>[]) {
      bump('test.variable.derivation', stat(v['derivation'], v['derivationBound'], true));
    }
    for (const p of (t['preconditions'] ?? []) as Record<string, unknown>[]) {
      bump('test.precondition.check', stat(p['check'], p['checkBound'], true));
    }
  }
  for (const c of (st.constraints ?? []) as Record<string, unknown>[]) {
    bump('constraint.check', stat(c['check'], c['checkBound'], true));
  }
  for (const c of (st.checks ?? []) as Record<string, unknown>[]) {
    // a FOLDED check is the parse-side view of its owner's carrier
    // (C161) — the owner's plane is counted there; counting the view
    // would double-count one carrier (the C178 census's same exemption)
    if (c['folds']) {
      continue;
    }
    bump('check.expression', stat(c['expression'], c['expressionBound'], true));
  }
  for (const p of (st.processes ?? []) as Record<string, never>[]) {
    for (const s of ((p as Record<string, unknown>)['steps'] ?? []) as Record<string, unknown>[]) {
      bump('process.step.completion', stat(s['completion'], s['completionBound'], true));
    }
  }

  const origins: Record<string, number> = {};
  for (const a of (st.attributeDefinitions ?? []) as Record<string, unknown>[]) {
    const o = String(a['origin'] ?? '');
    origins[o === '' ? '(absent)' : o] = (origins[o === '' ? '(absent)' : o] ?? 0) + 1;
  }
  for (const s of (st.symbols ?? []) as Record<string, unknown>[]) {
    const o = String(s['origin'] ?? '');
    origins[o === '' ? '(absent)' : o] = (origins[o === '' ? '(absent)' : o] ?? 0) + 1;
  }

  const counts: Record<string, number> = {};
  for (const [field, items] of Object.entries(st)) {
    if (Array.isArray(items)) {
      counts[field] = items.length;
    }
  }

  const census = { package: dir, carriers, origins, elements: counts };
  if (json) {
    console.log(JSON.stringify(census, null, 2));
  } else {
    console.log(`census ${dir}`);
    console.log('  carriers:');
    for (const [plane, s] of Object.entries(carriers)) {
      console.log(
        `    ${plane.padEnd(28)} inline ${String(s.inline).padStart(4)}  quoted ${String(s.quoted).padStart(4)}  absent ${String(s.absent).padStart(4)}`,
      );
    }
    console.log('  origins:');
    for (const [token, n] of Object.entries(origins).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${token.padEnd(24)} ${n}`);
    }
    console.log('  elements:');
    for (const [field, n] of Object.entries(counts)) {
      console.log(`    ${field.padEnd(28)} ${n}`);
    }
  }
  process.exit(0);
}

export type { CarrierStat };
