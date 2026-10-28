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
import {
  resolveParsanolTs,
  collectPrlFiles,
  readPackage,
  documentConstructs,
} from './src/front-end.ts';
import { parseAllowlist } from './src/front-end.ts';
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
      // The manifest's fail-fast discipline — the two loader
      // diagnostics the corpus pins: a manifest declares its id, and a
      // declared status is in the closed vocabulary. The message
      // mirrors the reference loader's so the same expectation
      // judges both implementations.
      const manifestFiles = collectPrlFiles(
        target,
        p => readdirSync(p),
        p => statSync(p).isDirectory(),
      ).filter(f => f.endsWith('package.primmel'));
      if (manifestFiles.length === 0) {
        emit({
          ok: false,
          error: `loadPackage: no package manifest at ${target}`,
        });
        return;
      }
      const manifestSrc = readFileSync(manifestFiles[0]!, 'utf8');
      const manifest = documentConstructs(runtime.parseShape(manifestSrc)).find(
        c => c.keyword === 'package',
      );
      const idLine = (manifest?.items ?? []).find(
        i => i.kind === 'line' && i.key === 'id' && i.tokens.length > 0,
      );
      if (!idLine) {
        emit({
          ok: false,
          error: `loadPackage: ${manifestFiles[0]} is not a valid package manifest`,
        });
        return;
      }
      const statusLine = (manifest?.items ?? []).find(
        i => i.kind === 'line' && i.key === 'status',
      );
      if (
        statusLine !== undefined &&
        !['current', 'preview', 'superseded', 'withdrawn'].includes(
          statusLine.tokens[0] ?? '',
        )
      ) {
        emit({
          ok: false,
          error: `Parsing error: package: Expected status current|preview|superseded|withdrawn, got "${statusLine.tokens[0] ?? ''}"`,
        });
        return;
      }
      const read = (p: string) => readFileSync(p, 'utf8');
      // The shipped documents' harvest indexes (C169's counterpart
      // inputs) and the parsed allowlist (C56's): artifacts the adapter
      // reads so check() judges them without fs of its own.
      const documents: {
        urn: string;
        fragments: Set<string>;
        addresses: Set<string>;
        sentences: { address: string; fragment: string; modality: string; kind: string; text: string }[];
        malformed?: string;
      }[] = [];
      // The shipped payloads are JSON, not .prl — collectPrlFiles never
      // returns them, so the harvest indexes walk the directory
      // themselves (deterministic order, the C169/C71-C73 inputs).
      const sourcesPrd: string[] = [];
      const walkPrd = (d: string): void => {
        if (!existsSync(d)) {
          return;
        }
        for (const e of readdirSync(d).sort()) {
          const p = `${d}/${e}`;
          if (statSync(p).isDirectory()) {
            walkPrd(p);
          } else if (p.includes('sources-prd/') && p.endsWith('.json')) {
            sourcesPrd.push(p);
          }
        }
      };
      walkPrd(target);
      for (const f of sourcesPrd.filter(x => x.endsWith('.sentences.json'))) {
        const rel = f.slice(f.indexOf('sources-prd/'));
        let raw: {
          prd_sentences?: string;
          document?: { urn?: string };
          sentences?: { address?: string; fragment?: string; modality?: string; kind?: string; text?: string }[];
          anchors?: string[];
        };
        try {
          raw = JSON.parse(read(f));
        } catch (e) {
          documents.push({ urn: '', fragments: new Set(), addresses: new Set(), sentences: [], malformed: `${rel}: not parseable JSON — ${String((e as Error)?.message ?? e)} (text-coverage-config)` });
          continue;
        }
        if (
          raw.prd_sentences !== '0.1.0' ||
          typeof raw.document?.urn !== 'string' ||
          !Array.isArray(raw.sentences) ||
          raw.sentences.some(
            x =>
              typeof x?.address !== 'string' ||
              typeof x?.fragment !== 'string' ||
              (x?.modality !== 'normative' && x?.modality !== 'informative') ||
              typeof x?.text !== 'string',
          )
        ) {
          documents.push({ urn: raw.document?.urn ?? '', fragments: new Set(), addresses: new Set(), sentences: [], malformed: `${rel}: not a prd_sentences 0.1.0 manifest (document.urn + sentences[{address, fragment, modality, text}]) — regenerate the package (text-coverage-config)` });
          continue;
        }
        const fragments = new Set<string>();
        const addresses = new Set<string>();
        const sentences: { address: string; fragment: string; modality: string; kind: string; text: string }[] = [];
        for (const s2 of raw.sentences) {
          if (typeof s2.fragment === 'string') {
            fragments.add(s2.fragment);
          }
          if (typeof s2.address === 'string') {
            addresses.add(s2.address);
          }
          sentences.push({
            address: s2.address ?? '',
            fragment: s2.fragment ?? '',
            modality: s2.modality ?? 'informative',
            kind: s2.kind ?? '',
            text: s2.text ?? '',
          });
        }
        // The document's full anchor set (primmel-ts#206) — the
        // sentence-less fragments (tables, figures) a citation can land
        // on; non-string entries are ignored, never malformed.
        if (Array.isArray(raw.anchors)) {
          for (const a of raw.anchors) {
            if (typeof a === 'string') {
              fragments.add(a);
            }
          }
        }
        documents.push({ urn: raw.document.urn, fragments, addresses, sentences });
      }
      const coveragePath = sourcesPrd.find(x => x.endsWith('coverage.json'));
      let coverage: { config?: unknown; parseError?: string } | undefined;
      if (coveragePath !== undefined) {
        try {
          const cfg = JSON.parse(read(coveragePath)) as { prd_coverage?: string };
          if (cfg.prd_coverage !== '0.1.0') {
            coverage = { parseError: `sources-prd/coverage.json: prd_coverage must be "0.1.0" — regenerate the package (text-coverage-config)` };
          } else {
            coverage = { config: cfg };
          }
        } catch (e) {
          coverage = { parseError: `sources-prd/coverage.json: ${String((e as Error)?.message ?? e)} — regenerate the package (text-coverage-config)` };
        }
      }
      // The allowlist is NOT package syntax — the package grammar does
      // not capture it; the parser is checker2's own.
      const allowlistFiles = manifestFiles.filter(x => x.endsWith('.primmel-allowlist.prl'));
      let allowlist: ReturnType<typeof parseAllowlist> | undefined;
      if (allowlistFiles.length > 0) {
        allowlist = parseAllowlist(read(allowlistFiles[0]!));
      }
      const loadDir = (d: string) => {
        const files = collectPrlFiles(d, p => readdirSync(p), p => statSync(p).isDirectory());
        const parsed = readPackage(runtime, files, read);
        parsed.dir = d;
        parsed.files = existsSync(d) ? readdirSync(d) : [];
        return parsed;
      };
      const pkg = loadDir(target);
      pkg.dir = resolve(target);
      // The register this implementation mirrors — the allowlist's
      // active-rules gate (a dormant rule's entry never goes stale).
      try {
        const registerPath = join(import.meta.dirname ?? '.', '..', '..', 'conformance', 'checker2-rules.json');
        pkg.mirroredRules = new Set(
          (JSON.parse(readFileSync(registerPath, 'utf8')) as { implemented: string[] }).implemented,
        );
      } catch {
        // no register in reach — every entry counts as active
      }
      pkg.documents = documents;
      pkg.coverage = coverage;
      pkg.allowlist = allowlist;
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
