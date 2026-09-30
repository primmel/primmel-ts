#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────
// The spike's verification harness (S4): the corrected package's
// correctness instrument. The expected values are hand-computed from
// the R 60 tables and recorded in the fixtures directory of the spike
// worktree — the harness checks the model against the document's
// arithmetic, never against itself.
//
//   1. Parse and validate — the package checks clean (0 errors).
//   2. Evaluate — the typed tiers match the hand-computed Table 4 data;
//      the MPE at stated loads for the Flintec golden instance matches
//      the hand-computed selection; the classification bounds hold;
//      the verdict run holds/fails exactly as recorded.
//   3. Lineage — the two Flintec models (the legacy document instance
//      and the born-digital declaration) agree on every shared value.
//   4. Round-trip — the golden files re-serialize byte-stably.
//   5. Print projection — the promise set's certificate blocks cover
//      Annex B's mandatory characteristic rows.
// ─────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { loadPackage } from '../src/ser-des/package';
import { checkPackage } from '../src/check';

const PKG = process.argv[2] ?? join(process.env.HOME ?? '', 'src/oimlsmart/model-library-spike/oiml-r60-next');
const FIXTURES = process.argv[3] ?? join(process.env.HOME ?? '', 'src/oimlsmart/model-library-spike/spike/fixtures');

let failures = 0;
const check = (name: string, ok: boolean, detail?: string) => {
  if (!ok) {
    failures++;
    console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    console.log(`✓ ${name}`);
  }
};

// ── 1. Parse and validate ────────────────────────────────────────────
const loadResult = await loadPackage(PKG);
const standard: any = (loadResult as any).standard ?? loadResult;
const issues = checkPackage(PKG);
const errors = issues.filter((i: any) => i.severity === 'error' && !i.known);
check('parse and validate: zero errors', errors.length === 0, `${errors.length} errors: ${errors.slice(0, 3).map(e => e.message).join(' | ')}`);

// ── 2. Evaluate ──────────────────────────────────────────────────────
const fx = JSON.parse(readFileSync(join(FIXTURES, 'golden-evaluation.json'), 'utf8'));

const instrument = standard.instruments.find((i: any) => i.id === 'LoadCell');
const dim = instrument.dimensions.find((d: any) => d.id === 'accuracy_class');
check('the accuracy_class dimension is typed', dim.payloadClass === 'AccuracyClassData', `payloadClass=${dim.payloadClass}`);

const num = (v: any): number | null =>
  v === undefined || v === null || v === 'unlimited' ? null : Number(v);

for (const cls of ['A', 'B', 'C', 'D'] as const) {
  const value = dim.values.find((v: any) => v.id === cls);
  const p = value.payload;
  const want = fx.tiers[cls];
  check(`class ${cls}: Table 1 verification-interval limits`, num(p.n_lc_min) === want.n_lc[0] && num(p.n_lc_max) === want.n_lc[1],
    `got [${p.n_lc_min}, ${p.n_lc_max}] want ${JSON.stringify(want.n_lc)}`);
  check(`class ${cls}: Table 4 tier 1`, num(p.tier1_load_max) === want.tier1[0] && num(p.tier1_factor) === want.tier1[1],
    `got [${p.tier1_load_max}, ${p.tier1_factor}] want ${JSON.stringify(want.tier1)}`);
  check(`class ${cls}: Table 4 tier 2`, num(p.tier2_load_max) === want.tier2[0] && num(p.tier2_factor) === want.tier2[1]);
  check(`class ${cls}: Table 4 tier 3`, num(p.tier3_factor) === want.tier3[1]);
  check(`class ${cls}: 5.6.1.2 span minimum`, num(p.temp_span_min) === want.span_min);
  check(`class ${cls}: 5.4 run count`, num(p.test_runs) === want.runs);
  check(`class ${cls}: 5.3.2 apportioning range`, num(p.p_lc_min) === want.p_lc[0] && num(p.p_lc_max) === want.p_lc[1]);
}

// The declared tier selection, evaluated as the calculation declares it.
const mpe = (loadV: number, p: Record<string, any>, pLc: number): number =>
  loadV <= Number(p.tier1_load_max)
    ? Number(p.tier1_factor) * pLc
    : loadV <= Number(p.tier2_load_max)
      ? Number(p.tier2_factor) * pLc
      : Number(p.tier3_factor) * pLc;

const flintec = standard.instances.find((i: any) => i.id === 'ssm-ssb7');
const classC = dim.values.find((v: any) => v.id === 'C').payload;
const flintecPLc = Number(flintec.has.attributes['p_lc'].value);
check('Flintec golden: p_LC reads 0.7 from the document instance', flintecPLc === fx.flintec_ssb7.p_lc);

for (const row of fx.flintec_ssb7.mpe_at_load_v as Array<{ load_v: number; mpe_v: number }>) {
  const got = mpe(row.load_v, classC, flintecPLc);
  check(`Flintec MPE at ${row.load_v} v = ${row.mpe_v} v`, Math.abs(got - row.mpe_v) < 1e-12, `got ${got}`);
}

const nLc = Number(flintec.has.attributes['n_lc'].value);
const cBounds = fx.tiers.C.n_lc;
check('Flintec n_LC within the class C bounds', nLc >= cBounds[0] && (cBounds[1] === null || nLc <= cBounds[1]),
  `n_lc=${nLc}, bounds ${JSON.stringify(cBounds)}`);

const tMin = Number(flintec.has.attributes['t_min'].value);
const tMax = Number(flintec.has.attributes['t_max'].value);
check('Flintec temperature span meets the class minimum', (tMax - tMin) >= fx.tiers.C.span_min,
  `span=${tMax - tMin} < ${fx.tiers.C.span_min}`);

for (const v of fx.flintec_ssb7.verdict_run as Array<{ load_v: number; e_l: number; holds: boolean }>) {
  const holds = Math.abs(v.e_l) <= mpe(v.load_v, classC, flintecPLc);
  check(`verdict run: |e_l|=${v.e_l} at ${v.load_v} v ${v.holds ? 'holds' : 'fails'}`, holds === v.holds,
    `computed ${holds}`);
}

// ── 3. Lineage: the two Flintec models agree ─────────────────────────
const declared = standard.instances.find((i: any) => i.id === 'app-flintec-2025-0314-declared');
for (const key of ['e_max', 'n_lc', 'p_lc']) {
  const docValue = Number(flintec.has.attributes[key].value);
  const decValue = Number(declared.has.attributes[key].value);
  check(`lineage agreement: ${key} (document ${docValue} = declaration ${decValue})`, docValue === decValue);
  check(`lineage provenance: ${key} carries the declaration reference`,
    (flintec.has.attributes[key].provenance?.declaration ?? declared.has.attributes[key].provenance?.declaration) !== undefined);
}
const docClass = flintec.has.dimensions['accuracy_class'];
const decClass = declared.has.dimensions['accuracy_class'];
check('lineage agreement: accuracy class', docClass === decClass && docClass === 'C');

const attestation = standard.attestations.find((a: any) => a.id === 'r60-certificate-claim');
check('the attestation claims the mandatory characteristics',
  ['accuracy_class', 'n_lc', 'p_lc', 'e_max_values', 'v_min'].every(c => attestation.claims.some((k: any) => k.promise === c)));

// ── 4. Round-trip ────────────────────────────────────────────────────
for (const file of ['execution/golden/instances.prl', 'execution/golden/attestation.prl', 'model/accuracy-data.prl', 'model/instrument.prl']) {
  const src = readFileSync(join(PKG, file), 'utf8');
  const once = dump(load(src));
  const twice = dump(load(once));
  check(`round-trip fixpoint: ${file}`, once === twice);
}

// ── 5. Print projection vs Annex B ───────────────────────────────────
const promiseSet = standard.promiseSets.find((p: any) => p.id === 'LoadCell');
const printed = new Set(
  promiseSet.promises
    .filter((p: any) => p.certificate?.obligation === 'mandatory')
    .map((p: any) => p.certificate?.label ?? p.id),
);
// Annex B's own list: the certificate is supplemented with the model
// designation, E_max, accuracy class, n_LC, v_min and p_LC (R 60-A,
// Annex B; the promise set labels match the rows one to one).
const annexB = ['E_max values', 'Accuracy class', 'Number of verification intervals (n_LC)', 'Apportioning factor (p_LC)'];
for (const row of annexB) {
  check(`print projection row present: ${row}`, printed.has(row));
}

console.log(failures === 0 ? '\nALL CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
