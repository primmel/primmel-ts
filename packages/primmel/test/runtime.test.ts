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
