// The golden-dump rebake: regenerate test/golden/dump/*.expected.prl
// from the CURRENT dumpers. The command exists so a dumper change (the
// dump-flip rung above all) reviews as a directory diff — the
// expected bytes are the harness's data, never hand-maintained strings.
// Usage: npx tsx scripts/rebake-golden.mts
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';

const GOLDEN = join(process.cwd(), 'test', 'golden', 'dump');
mkdirSync(GOLDEN, { recursive: true });

const inputs = readdirSync(GOLDEN).filter(
  f => f.endsWith('.prl') && !f.endsWith('.expected.prl'),
);

if (inputs.length === 0) {
  console.log(
    `no fixtures in ${GOLDEN} — add <name>.prl input models; the expected bytes regenerate beside them`,
  );
  process.exit(0);
}

for (const f of inputs) {
  const src = readFileSync(join(GOLDEN, f), 'utf8');
  const out = dump(load(src)).trimEnd() + '\n';
  const expectedPath = join(GOLDEN, f.replace(/\.prl$/, '.expected.prl'));
  const before = existsSync(expectedPath)
    ? readFileSync(expectedPath, 'utf8')
    : '(new)';
  writeFileSync(expectedPath, out);
  console.log(
    before === out ? `unchanged  ${f}` : `rebaked    ${f} (${before === '(new)' ? 'new' : 'changed'})`,
  );
}
