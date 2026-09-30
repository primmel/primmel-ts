#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────
// The second checker's adapter — the conformance suite's adapter
// contract, answered without the kernel. `parse` is the grammar's own
// verdict; `check` runs this implementation's rules over the shape
// tree. `roundtrip` and `exports` are outside this implementation's
// scope (serialization is the reference kernel's conformance leg).
//
//   checker2-adapter.mts parse [--strict] <file.prl>
//   checker2-adapter.mts check <package-dir>
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveParsanolTs, collectPrlFiles, readPackage } from './src/front-end.ts';
import { resolve } from 'node:path';
import { check } from './src/rules.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const ARTIFACT = join(REPO_ROOT, 'grammar', 'artifacts', 'primmel.json');

function emit(result: unknown): void {
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const target = argv.find(a => !a.startsWith('--') && a !== cmd);
  const withArgs = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--with' && argv[i + 1] !== undefined) {
      withArgs.push(argv[i + 1]!);
    }
  }
  if (!cmd || !target || !existsSync(target)) {
    emit({ ok: false, error: `usage: checker2-adapter.mts parse|check <path> [--with <id>=<dir>]…` });
    return;
  }
  const parsanolTs = resolveParsanolTs(REPO_ROOT);
  if (!parsanolTs || !existsSync(ARTIFACT)) {
    emit({
      ok: false,
      error: 'no parsanol-ts checkout or grammar artifact (set PRIMMEL_PARSANOL_TS)',
    });
    return;
  }
  const { PargRuntime } = (await import(join(parsanolTs, 'dist', 'runtime.js'))) as {
    PargRuntime: { fromFile(path: string): { parseShape(src: string): unknown } };
  };
  const runtime = PargRuntime.fromFile(ARTIFACT);

  if (cmd === 'parse') {
    try {
      runtime.parseShape(readFileSync(target, 'utf8'));
      emit({ ok: true });
    } catch (e) {
      emit({ ok: false, error: String((e as Error)?.message ?? e) });
    }
    return;
  }

  if (cmd === 'check') {
    try {
      const read = (p: string) => readFileSync(p, 'utf8');
      const loadDir = (d: string) => {
        const files = collectPrlFiles(d, p => readdirSync(p), p => statSync(p).isDirectory());
        return readPackage(runtime, files, read);
      };
      const pkg = loadDir(target);
      pkg.dir = resolve(target);
      // The lineage counterparties: the sibling package directories.
      pkg.siblings = readdirSync(resolve(target, '..'))
        .map(e => join(resolve(target, '..'), e))
        .filter(p => statSync(p).isDirectory() && p !== resolve(target) && existsSync(join(p, 'package.primmel')))
        .map(loadDir);
      const located = { packages: new Map() };
      for (const w of withArgs) {
        const eq = w.indexOf('=');
        if (eq <= 0) {
          continue;
        }
        const id = w.slice(0, eq);
        const dir = w.slice(eq + 1);
        if (existsSync(dir)) {
          located.packages.set(id, loadDir(dir));
        }
      }
      const issues = check(pkg, located);
      emit({
        ok: true,
        issues: issues.map(i => ({ rule: i.rule, severity: i.severity, message: i.message })),
      });
    } catch (e) {
      emit({ ok: false, error: String((e as Error)?.message ?? e) });
    }
    return;
  }

  emit({ ok: false, error: `unknown subcommand ${cmd}` });
}

await main();
