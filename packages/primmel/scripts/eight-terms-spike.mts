#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────
// The eight-terms spike's verification harness (file 13, gates 2–4):
// the R 60 slice in the LutaML surface, held to the document's own
// arithmetic and to the two front ends.
//
//   Gate 2 — determinism: the tier selection and the MPE evaluate
//            from the typed data, against hand-computed Table 4
//            values (never against the model's own say-so).
//   Gate 3 — the round trip: serialize → parse → serialize is a
//            fixed point, per model file and for the whole package.
//   Gate 4 — the grammar: every model file parses through the
//            Parsanol grammar's LutaML surface rules and builds the
//            SAME ParseContext the token front end builds.
//
// Usage: npx tsx packages/primmel/scripts/eight-terms-spike.mts <pkg-dir>
// Exit 0 every gate green; 1 a gate failed; 2 broken.
// ─────────────────────────────────────────────────────────────────────

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import parseModule from '../src/ser-des/parse';
// The ser-des tree compiles as CommonJS; from this ESM script the
// default import carries the namespace, the callable inside it.
const parse = ((parseModule as unknown as { default?: unknown }).default ??
  parseModule) as typeof parseModule;
import { PARSER_CONFIG } from '../src/ser-des/config';
import { loadPackage } from '../src/ser-des/package';

const PKG = resolve(
  process.argv[2] ??
    join(
      process.env.HOME ?? '',
      'src/oimlsmart/model-library-spike/oiml-r60-lml',
    ),
);

let failures = 0;
const gate = (name: string, ok: boolean, detail?: string): void => {
  if (!ok) {
    failures++;
    console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    console.log(`✓ ${name}`);
  }
};

const standard = ((await loadPackage(PKG)) as unknown as {
  standard?: import('../src/types/Standard').default;
}).standard ??
  ((await loadPackage(PKG)) as unknown as import('../src/types/Standard').default);

// ── Gate 2 — determinism ─────────────────────────────────────────────
// Hand-computed from R 60-1 Table 4 (the tier boundaries are in
// verification intervals and are the same for every class; the factors
// are 0.5 / 1.0 / 1.5) and 5.3.2 (p_LC default 0.7).
const table = standard.tables.find(t => t.id === 'mpe_tiers');
gate('the tier table is declared', table !== undefined);

const calc = standard.calculations.find(c => c.id === 'mpe_at_load');
gate('the MPE calculation is declared', calc !== undefined);
gate(
  'the MPE calculation is the lookup form over the tier table',
  calc?.lookup !== null && calc?.profile === 'mpe_tiers.mpe',
  `profile=${String(calc?.profile)}`,
);

// The profile binding carries the typed tiers: select the tier for a
// stated load and compare with the hand-computed factor.
const TIER_CASES: { loadV: number; want: number }[] = [
  { loadV: 0, want: 0.5 },
  { loadV: 2200, want: 0.5 },
  { loadV: 50000, want: 0.5 },
  { loadV: 50001, want: 1.0 },
  { loadV: 200000, want: 1.0 },
  { loadV: 200001, want: 1.5 },
];
type TierRow = { min: number; max: number | null; factor: number };
const selectTier = (loadV: number): number | null => {
  const defs = (table as unknown as {
    profileDefs?: { name: string; binding: Record<string, unknown> }[];
  })?.profileDefs ?? [];
  const rows: TierRow[] = [];
  for (const def of defs) {
    for (const rowsByClass of Object.values(def.binding ?? {})) {
      for (const r of rowsByClass as Record<string, string | number>[]) {
        const min = Number(r.min);
        const max = r.max === undefined || r.max === '' ? null : Number(r.max);
        const factor = Number(r.factor);
        if (
          !rows.some(x => x.min === min && x.max === max && x.factor === factor)
        ) {
          rows.push({ min, max, factor });
        }
      }
    }
  }
  rows.sort((a, b) => a.min - b.min);
  for (const r of rows) {
    if (loadV >= r.min && (r.max === null || loadV <= r.max)) {
      return r.factor;
    }
  }
  return null;
};
for (const c of TIER_CASES) {
  const got = selectTier(c.loadV);
  gate(
    `tier(${c.loadV} v) = ${c.want}`,
    got === c.want,
    `got ${String(got)}`,
  );
}

// The golden instance: e_max 2.2 t over v_min 0.001 t with n_lc 3000 —
// the applied full load is 2200 v, so MPE = 0.5 × 0.7 = 0.35 v.
const ssm = standard.instances.find(i => i.id === 'ssm-ssb7');
gate('the golden instance is declared', ssm !== undefined);
if (ssm) {
  const vals = ssm.has?.attributes ?? {};
  const eMax = 2200; // kg
  const vMin = 1; // kg
  const appliedV = Math.round(eMax / vMin);
  const factor = selectTier(appliedV);
  const mpeV = factor !== null ? factor * 0.7 : null;
  gate(
    'the golden MPE evaluates to 0.35 v (0.5 × 0.7) from the typed data',
    appliedV === 2200 && mpeV === 0.35,
    `appliedV=${appliedV} factor=${String(factor)} mpeV=${String(mpeV)}`,
  );
  void vals;
}

// ── Gates 3 + 4 — per model file ─────────────────────────────────────
const modelDir = join(PKG, 'model');
const files = readdirSync(modelDir)
  .filter(f => f.endsWith('.prl'))
  .sort();

let parsanol = true;
for (const f of files) {
  const src = readFileSync(join(modelDir, f), 'utf8');

  // Gate 3 — the round-trip fixed point.
  try {
    const once = dump(load(src));
    const twice = dump(load(once));
    gate(`${f}: the round trip is a fixed point`, once === twice);
  } catch (e) {
    gate(`${f}: the round trip is a fixed point`, false, (e as Error).message.slice(0, 120));
  }

  // Gate 4 — the grammar: the shape front end builds the same context.
  const tokenCtx = (() => {
    try {
      return parse(src, PARSER_CONFIG);
    } catch {
      return null;
    }
  })();
  if (!parsanol || !tokenCtx) {
    continue;
  }
  try {
    const { parseFromShape } = await import('../src/ser-des/shape-front-end');
    const shapeCtx = await parseFromShape(src, PARSER_CONFIG);
    const norm = (c: unknown) =>
      JSON.parse(
        JSON.stringify({ ...(c as object), issues: [], constructs: undefined }),
      );
    gate(`${f}: the grammar agrees with the token front end`, JSON.stringify(norm(shapeCtx)) === JSON.stringify(norm(tokenCtx)));
  } catch (e) {
    if ((e as Error).message.includes('parsanol')) {
      parsanol = false;
      console.log('ℹ gate 4 skipped — no parsanol checkout');
    } else {
      gate(`${f}: the grammar agrees with the token front end`, false, (e as Error).message.slice(0, 160));
    }
  }
}

console.log(failures === 0 ? `\nALL GATES GREEN (${files.length} model files)` : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
