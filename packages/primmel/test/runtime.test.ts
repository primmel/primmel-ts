// ─────────────────────────────────────────────────────────────────────
// The runtime's pin (the full flow's phase 4): the R 60 goldens
// execute END TO END from the authored models — the MPE the tier
// selection derives, the verdict outcomes the fixture hand-computed
// from the document's arithmetic, the run replayable byte-stably, the
// evidence record the law's loop closes through. Zero hand-coded
// values in the runtime: every expected value here comes from the
// spike's hand-computed fixture (the document's own arithmetic), and
// every computed value comes from the model.
// Skips when the spike checkout is absent.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadPackage } from '../src/ser-des/package';
import {
  evaluateExpression,
  lookupTable,
  type LookupTable,
  executeRun,
  projectCertificate,
  type Run,
} from '../src/runtime';

const PKG = join(homedir(), 'src/oimlsmart/model-library-spike/oiml-r60-lml');
const FIXTURES = join(
  homedir(),
  'src/oimlsmart/model-library-spike/spike/fixtures/golden-evaluation.json',
);
const available =
  existsSync(join(PKG, 'package.primmel')) && existsSync(FIXTURES);

async function loadComposed(): Promise<ReturnType<typeof loadPackage>> {
  return (await loadPackage(PKG, {
    resolvePackage: (id: string) =>
      join(homedir(), 'src/oimlsmart/model-library-spike', id),
  })) as unknown as ReturnType<typeof loadPackage>;
}

describe(
  'the runtime executes the R 60 goldens',
  { skip: available ? false : 'no model-library-spike checkout' },
  () => {
    const fx = JSON.parse(readFileSync(FIXTURES, 'utf8')) as {
      flintec_ssb7: {
        classification: string;
        n_lc: number;
        p_lc: number;
        mpe_at_load_v: { load_v: number; mpe_v: number }[];
        verdict_run: { load_v: number; e_l: number; holds: boolean }[];
      };
    };

    // The list aggregators — the MMEL v2 measurement language's postfix
    // `.sum/.max/.min/.count/.average`, retained as call-form over the run
    // scope's list payloads (the rename contract's expression table).
    it('evaluates the list aggregators over list payloads', () => {
      const env = {
        Included_Emission: [10, 20, 30],
        Excluded_Emission: [1, 2],
        Total_Emission: 63,
      };
      const cases: Array<[string, number]> = [
        ['sum(Included_Emission)', 60],
        ['max(Included_Emission)', 30],
        ['min(Included_Emission)', 10],
        ['count(Included_Emission)', 3],
        ['average(Included_Emission)', 20],
        ['max(Included_Emission) / Total_Emission', 30 / 63],
        ['sum(Included_Emission) + sum(Excluded_Emission)', 63],
      ];
      for (const [expr, want] of cases) {
        assert.equal(evaluateExpression(expr, env), want, expr);
      }
    });

    // Scalar min/max keeps its two-argument form even beside list payloads.
    it('scalar min/max keeps the two-argument form beside list payloads', () => {
      const env = { a: 5, b: 9, list: [1, 100] };
      assert.equal(evaluateExpression('min(a, b)', env), 5);
      assert.equal(evaluateExpression('max(a, b)', env), 9);
    });

    // The MMEL v2 TABLE-variable lookup — retained with the legacy's exact
    // signature and semantics (Checker.js lookupTable). The grid below is
    // inlined from the corpus (showcase 5's BS6004 'data' table, rows 0–2)
    // so the spec is self-contained.
    it('resolves the legacy table lookup (the BS6004 grid, inlined)', () => {
      const tables: LookupTable[] = [
        {
          id: 'data',
          data: [
            ['', 'Rated voltage of cable', '', 'Conductor–earth', ''],
            ['6181Y', '1 x 1.0', '1', '1', '0.6'],
            ['6181Y', '1 x 1.5', '1.5', '1', '0.7'],
          ],
        },
      ];
      // The lookup form: tableId,targetCol,matchCol,matchVar.
      assert.equal(
        lookupTable(tables, 'data,1,0,type', { type: '6181Y' }),
        '1 x 1.0',
      );
      // numeric cells return numbers (the first matching row wins)
      assert.equal(lookupTable(tables, 'data,2,0,type', { type: '6181Y' }), 1);
      // multiple match pairs narrow to the second row
      assert.equal(
        lookupTable(tables, 'data,4,1,size', { size: '1 x 1.5' }),
        0.7,
      );
      // the header row is skipped: 'Rated voltage' never matches the lookup
      assert.throws(
        () =>
          lookupTable(tables, 'data,1,1,size', {
            size: 'Rated voltage of cable',
          }),
        /matches no row/,
      );
      // no-match throws (never silently nulls)
      assert.throws(
        () => lookupTable(tables, 'data,1,0,type', { type: 'NOPE' }),
        /matches no row/,
      );
      // missing table throws
      assert.throws(
        () => lookupTable(tables, 'missing,1,0,type', { type: 'x' }),
        /no declared table/,
      );
      // malformed definition throws
      assert.throws(() => lookupTable(tables, 'data', {}), /tableId,targetCol/);
    });

    it('the tier selection evaluates from the authored class data', async () => {
      const std = (await loadComposed()) as unknown as Parameters<
        typeof executeRun
      >[0];
      const p_lc = fx.flintec_ssb7.p_lc;
      for (const row of fx.flintec_ssb7.mpe_at_load_v) {
        const mpe = executeRun(std, {
          instance: 'ssm-ssb7',
          requirement: '/req/metrological/mpe',
          inputs: [{ load_v: row.load_v, e_l: row.mpe_v }],
        }).verdicts;
        assert.ok(mpe.length > 0, `a verdict exists at ${row.load_v} v`);
        const bound = mpe[0]!.limit!.bound;
        assert.ok(
          Math.abs(bound - row.mpe_v) < 1e-12,
          `MPE(${row.load_v} v) = ${row.mpe_v} v, got ${bound}`,
        );
        void p_lc;
      }
    });

    it('the verdict outcomes hold and fail exactly as the fixture records', async () => {
      const std = (await loadComposed()) as unknown as Parameters<
        typeof executeRun
      >[0];
      const runs = fx.flintec_ssb7.verdict_run;
      const run = executeRun(std, {
        instance: 'ssm-ssb7',
        requirement: '/req/metrological/mpe',
        inputs: runs.map(r => ({ load_v: r.load_v, e_l: r.e_l })),
      });
      const outcomes = run.verdicts.filter(v => v.limit?.expression === 'mpe');
      assert.equal(outcomes.length, runs.length);
      for (const [i, want] of runs.entries()) {
        assert.equal(
          outcomes[i]!.outcome,
          want.holds ? 'pass' : 'fail',
          `|e_l|=${want.e_l} at ${want.load_v} v`,
        );
      }
    });

    it('the run is deterministic — identical calls, identical bytes', async () => {
      const std = (await loadComposed()) as unknown as Parameters<
        typeof executeRun
      >[0];
      const a = (): Run =>
        executeRun(std, {
          instance: 'ssm-ssb7',
          test: '/conf/metrological-tests/measurement-error-repeatability-mdlo',
          inputs: [{ load_v: 400, e_l: 0.3 }],
          evidenceRegistry: 'testReports',
        });
      assert.equal(JSON.stringify(a()), JSON.stringify(a()));
    });

    it('the run carries the applied program with evaluated arguments', async () => {
      const std = (await loadComposed()) as unknown as Parameters<
        typeof executeRun
      >[0];
      const run = executeRun(std, {
        instance: 'ssm-ssb7',
        test: '/conf/metrological-tests/measurement-error-repeatability-mdlo',
        inputs: [{ load_v: 400, e_l: 0.3 }],
      });
      const stimulus = run.programs.filter(p => p.program === 'stimulus');
      assert.ok(stimulus.length > 0, 'the stimulus program is in the run');
      // The MDLO program's first point drives 10% of e_max (loadKg):
      // the evaluated argument reflects the instance's own e_max (8 t).
      const first = stimulus[0]!;
      assert.equal(first.drive, 'ladApply');
      const loadArg = Number(first.args['loadKg']);
      assert.ok(
        Math.abs(loadArg - 0.8) < 1e-12,
        `args.load evaluates 0.1 * e_max = 0.8, got ${loadArg}`,
      );
    });

    it('the evidence record lands in the registry the run names', async () => {
      const std = (await loadComposed()) as unknown as Parameters<
        typeof executeRun
      >[0];
      const run = executeRun(std, {
        instance: 'ssm-ssb7',
        requirement: '/req/metrological/mpe',
        inputs: [{ load_v: 400, e_l: 0.3 }],
        evidenceRegistry: 'testReports',
      });
      assert.equal(run.evidence.length, 1);
      const rec = run.evidence[0]!;
      assert.equal(rec.registry, 'testReports');
      assert.equal(rec.run, 'ssm-ssb7');
      assert.ok(
        rec.values.length >= 2,
        'the record carries the load and the verdict',
      );
    });

    it('the Flintec certificate projects from the run — declared values and outcomes', async () => {
      const std = (await loadComposed()) as unknown as Parameters<
        typeof executeRun
      >[0];
      const att = std.attestations.find(
        (a: { id: string }) => a.id === 'r60-certificate-claim',
      );
      assert.ok(att, 'the golden attestation is declared');
      const vids = [
        ...new Set(
          att.claims
            .map((c: { validatedBy?: string }) => c.validatedBy)
            .filter(Boolean),
        ),
      ] as string[];
      const run = executeRun(std, {
        instance: 'ssm-ssb7',
        requirement: '/req/metrological/mpe',
        inputs: [
          { load_v: 400, e_l: 0.3 },
          { load_v: 600, e_l: 0.69 },
        ],
        verdicts: vids,
      });
      const cert = projectCertificate(std, run, att.id);
      assert.equal(cert.subject, 'ssm-ssb7');
      const byId = new Map(cert.claims.map(c => [c.id, c]));
      // The declared values read from the authored lineage — never
      // re-entered: accuracy class C, n_lc 3000 intervals, p_lc 0.7.
      assert.equal(byId.get('accuracy_class')?.declared?.value, 'C');
      assert.equal(byId.get('n_lc')?.declared?.value, 3000);
      assert.equal(byId.get('p_lc')?.declared?.value, 0.7);
      // Every validated claim holds: the MPE verdicts executed and
      // passed (0.3 <= 0.35 at 400 v; 0.69 <= 0.7 at 600 v).
      for (const c of cert.claims) {
        assert.equal(c.outcome, 'pass', `claim ${c.id}`);
      }
      assert.equal(
        JSON.stringify(projectCertificate(std, run, att.id)),
        JSON.stringify(cert),
      );
    });

    it('the evaluator throws on an undeclared name — never indeterminates silently', () => {
      assert.throws(() => evaluateExpression('undeclared_name + 1', {}));
      assert.equal(evaluateExpression('abs(0 - 3) + min(2, 5)', {}), 5);
      assert.equal(
        evaluateExpression('if x <= 10 then x * 0.5 else x * 1.5', { x: 4 }),
        2,
      );
      assert.equal(
        evaluateExpression('if x <= 10 then x * 0.5 else x * 1.5', { x: 40 }),
        60,
      );
    });
  },
);
