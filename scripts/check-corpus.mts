// The composed-corpus smoke (the goal's CI promotion): run the corpus
// repo's own composed gate — `primmel check --strict --audit` over every
// package with the sibling locator wired — using THIS checkout's kernel
// CLI. The corpus lives outside primmel-ts (oimlsmart/model-library, a
// private repo), so the job skips LOUDLY when the checkout is absent
// (fork PRs without the token): silence would read as a pass, and a
// skipped corpus gate that looks green is exactly the failure mode the
// gate exists to prevent.

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(import.meta.dirname, '..');
const corpus = process.env.PRIMMEL_CORPUS_DIR
  ? resolve(process.env.PRIMMEL_CORPUS_DIR)
  : join(repoRoot, '..', 'model-library');
const gate = join(corpus, 'scripts', 'check-all.mjs');
const cli = join(repoRoot, 'packages', 'primmel', 'dist-cli', 'primmel.mjs');

if (!existsSync(gate) || !existsSync(cli)) {
  console.log(
    'CORPUS SMOKE SKIPPED: ' +
      (!existsSync(gate)
        ? `no corpus checkout at ${corpus} (set PRIMMEL_CORPUS_DIR)`
        : `no CLI bundle at ${cli} (run yarn workspace @primmel/primmel build:cli)`) +
      ' — this is a SKIP, never a pass.',
  );
  process.exit(0);
}

const res = spawnSync(process.execPath, [gate], {
  cwd: corpus,
  stdio: 'inherit',
  env: { ...process.env, PRIMMEL_CLI: `${process.execPath} ${cli}` },
});
process.exit(res.status ?? 1);
