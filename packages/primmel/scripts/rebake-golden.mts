// The golden-dump rebake: regenerate test/golden/dump/*.expected.prl
// from the CURRENT dumpers. The command exists so a dumper change (the
// dump-flip rung above all) reviews as a directory diff — the
// expected bytes are the harness's data, never hand-maintained strings.
// Usage: npx tsx scripts/rebake-golden.mts
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';

const GOLDEN = join(process.cwd(), 'test', 'golden', 'dump');
mkdirSync(GOLDEN, { recursive: true });

const inputs = readdirSync(GOLDEN).filter(
  f => f.endsWith('.prl') && !f.endsWith('.expected.prl'),
);

// ── the harvest mode: seed one fixture per uncovered construct ──────
// `rebake-golden --harvest` walks the conformance corpus (+ the repo's
// fixtures), parses each file, and copies the SMALLEST file exercising
// each construct plane no golden fixture covers yet — the parse/dump
// pin grows from the suite's own material, never hand-written.
const harvest = process.argv.includes('--harvest');
if (harvest) {
  const { loadFile } = await import('../src/ser-des/index');
  const { CONSTRUCTS } = await import('../src/ser-des/config/index');
  const covered = new Set<string>();
  for (const f of inputs) {
    const std = loadFile(join(GOLDEN, f)) as unknown as Record<string, unknown[]>;
    for (const [field, items] of Object.entries(std)) {
      if (Array.isArray(items) && items.length > 0) {
        covered.add(field);
      }
    }
  }
  const wanted = new Set(
    CONSTRUCTS.map(c => c.field as string).filter(f => !covered.has(f)),
  );
  const corpusRoots = [
    join(process.cwd(), '..', '..', 'conformance', 'corpus'),
    join(process.cwd(), 'test', 'fixtures'),
  ];
  const candidates: { file: string; size: number; fields: Set<string> }[] = [];
  const walkFiles = (d: string): void => {
    if (!existsSync(d)) {
      return;
    }
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      const st = statSync(p);
      if (st.isDirectory()) {
        walkFiles(p);
      } else if (e.endsWith('.prl')) {
        candidates.push({ file: p, size: st.size, fields: new Set() });
      }
    }
  };
  corpusRoots.forEach(walkFiles);
  for (const c of candidates) {
    try {
      const std = loadFile(c.file) as unknown as Record<string, unknown[]>;
      for (const [field, items] of Object.entries(std)) {
        if (Array.isArray(items) && items.length > 0) {
          c.fields.add(field);
        }
      }
    } catch {
      // a corpus file the lenient load rejects — not harvest material
    }
  }
  candidates.sort((a, b) => a.size - b.size);
  const seeded: string[] = [];
  for (const c of candidates) {
    const hits = [...wanted].filter(f => c.fields.has(f));
    if (hits.length === 0) {
      continue;
    }
    const name = `harvest-${hits[0]}${hits.length > 1 ? `-and${hits.length - 1}` : ''}.prl`;
    writeFileSync(join(GOLDEN, name), readFileSync(c.file));
    hits.forEach(h => wanted.delete(h));
    // the copied file covers every plane it carries
    c.fields.forEach(f => {
      if (wanted.has(f)) {
        wanted.delete(f);
      }
    });
    seeded.push(`${name} (${hits.join(', ')})`);
  }
  console.log(
    `harvested ${seeded.length} fixture(s); ${wanted.size} plane(s) still uncovered:` +
      (wanted.size ? '\n  ' + [...wanted].join('\n  ') : ''),
  );
  process.exit(0);
}

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
