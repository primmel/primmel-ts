// Parser integration smoke test against a real-world Primmel model.
//
// Usage:
//   npx tsx scripts/validate-r60.mts
//
// Requires the R 60 model to be present at `models/r60/r60.mmel` (relative
// to the repo root). The model is intentionally NOT shipped with this
// repository — it is an external integration fixture. If you don't have
// the model, this script will print a clear skip message and exit 0.
import { loadFile } from '../packages/primmel/src/ser-des/index.ts';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const modelPath = resolve(repoRoot, 'models/r60/r60.mmel');

if (!existsSync(modelPath)) {
  console.log(
    `Skipping R 60 smoke test: model not found at ${modelPath}\n` +
      'This script is an integration test against an external fixture.\n' +
      'The unit test suite in packages/primmel/test/ provides CI coverage without it.'
  );
  process.exit(0);
}

let pass = 0;
let fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    pass++;
    console.log(`  ✓ ${name}: ${actual}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}: expected ${expected}, got ${actual}`);
  }
}

console.log('Test 1: R 60 model (loadFile with includes)');
const s = loadFile(modelPath);
check('roles', s.roles.length, 6);
check('dataclasses', s.dataclasses.length, 23);
check('provisions', s.provisions.length, 39);
check('processes', s.processes.length, 23);
check('forms', s.forms?.length ?? 0, 37);
check('symbols', s.symbols?.length ?? 0, 30);
check('calculations', s.calculations?.length ?? 0, 17);
check('stateMachines', s.stateMachines?.length ?? 0, 7);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
