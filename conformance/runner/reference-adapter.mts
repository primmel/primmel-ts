#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────
// The Primmel conformance suite: the reference adapter.
//
// The primmel-ts implementation of the adapter contract documented in
// conformance/docs/running-a-third-party-implementation.md. The runner
// invokes this file once per case:
//
//   reference-adapter.mts parse [--strict] <file.prl>
//   reference-adapter.mts roundtrip <file.prl>
//   reference-adapter.mts check <package-dir> [--with <id>=<dir>]...
//   reference-adapter.mts exports <probe.json>
//
// Each invocation prints one JSON object on stdout and exits 0; a
// non-zero exit means the adapter itself malfunctioned (never a
// conformance verdict).
// ─────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  load,
  dump,
  loadWithIssues,
} from '../../packages/primmel/src/ser-des/index.js';
// The browser runtime surface probe (the exports command): the namespace
// of the browser bundle's entry module (vite.browser.config.ts), whose
// export surface the ES lib build preserves verbatim.
import * as browserSurface from '../../packages/primmel/src/ser-des/index.js';
import { checkPackage } from '../../packages/primmel/src/check.js';function emit(result: unknown): void {
  process.stdout.write(JSON.stringify(result) + '\n');
}

function fail(message: string): never {
  process.stderr.write(`reference-adapter: ${message}\n`);
  process.exit(1);
}

function runParse(args: string[]): void {
  const strict = args.includes('--strict');
  const file = args.filter(a => a !== '--strict')[0];
  if (!file) {
    fail('parse: missing file argument');
  }
  const content = readFileSync(resolve(file!), 'utf8');
  try {
    const { issues } = loadWithIssues(content, { strict });
    emit({
      ok: true,
      issues: issues.map(i => ({
        code: i.code ?? 'parse-issue',
        message: i.message,
      })),
    });
  } catch (e) {
    emit({ ok: false, error: (e as Error).message });
  }
}

function runRoundtrip(args: string[]): void {
  const file = args[0];
  if (!file) {
    fail('roundtrip: missing file argument');
  }
  try {
    const content = readFileSync(resolve(file!), 'utf8');
    const first = dump(load(content));
    const second = dump(load(first));
    emit({ ok: true, stable: first === second, output: first });
  } catch (e) {
    emit({ ok: false, error: (e as Error).message });
  }
}

function runCheck(args: string[]): void {
  const positional: string[] = [];
  const locator = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--with') {
      const spec = args[++i];
      const eq = spec?.indexOf('=') ?? -1;
      if (!spec || eq <= 0) {
        fail('check: --with expects <id>=<dir>');
      }
      locator.set(spec.slice(0, eq), resolve(spec.slice(eq + 1)));
    } else {
      positional.push(args[i]);
    }
  }
  const dir = positional[0];
  if (!dir) {
    fail('check: missing package directory argument');
  }
  try {
    const issues = checkPackage(resolve(dir), {
      resolvePackage: (id: string) => locator.get(id),
    });
    emit({
      ok: true,
      issues: issues.map(i => ({
        rule: i.check,
        severity: i.severity,
        message: i.message,
      })),
    });
  } catch (e) {
    emit({ ok: false, error: (e as Error).message });
  }
}

function runExports(args: string[]): void {
  const file = args[0];
  if (!file) {
    fail('exports: missing probe file argument');
  }
  try {
    const probe = JSON.parse(readFileSync(resolve(file!), 'utf8')) as {
      probe?: string[];
    };
    const names = probe.probe ?? [];
    emit({
      ok: true,
      present: names.filter(n => n in browserSurface),
      absent: names.filter(n => !(n in browserSurface)),
    });
  } catch (e) {
    emit({ ok: false, error: (e as Error).message });
  }
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case 'parse':
      runParse(rest);
      return;
    case 'roundtrip':
      runRoundtrip(rest);
      return;
    case 'check':
      runCheck(rest);
      return;
    case 'exports':
      runExports(rest);
      return;
    default:
      fail(
        'usage: reference-adapter.mts parse [--strict] <file> | ' +
          'roundtrip <file> | check <dir> [--with <id>=<dir>]... | ' +
          'exports <probe.json>',
      );
  }
}

main();
