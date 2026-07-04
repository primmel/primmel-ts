// Parser smoke test — run with: npx tsx scripts/validate-r60.mts
import { loadFile, load } from '../packages/mmel/src/ser-des/index.ts'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

let pass = 0, fail = 0
function check(name, actual, expected) {
  if (actual === expected) { pass++; console.log(`  ✓ ${name}: ${actual}`) }
  else { fail++; console.log(`  ✗ ${name}: expected ${expected}, got ${actual}`) }
}

console.log('Test 1: R 60 model (loadFile with includes)')
const s = loadFile(resolve(repoRoot, 'models/r60/r60.mmel'))
check('roles', s.roles.length, 6)
check('dataclasses', s.dataclasses.length, 23)
check('provisions', s.provisions.length, 39)
check('processes', s.processes.length, 23)
check('forms', s.forms?.length, 37)
check('symbols', s.symbols?.length, 30)
check('calculations', s.calculations?.length, 17)
check('stateMachines', s.stateMachines?.length, 7)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
