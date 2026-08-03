// ─────────────────────────────────────────────────────────────────────
// primmel export CLI tests (TODO.roadmap/27): usage diagnostics (exit
// 2, no stack trace), stdout output, and --out file writing for the
// ReqIF and RDF/OWL projections.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFixturePackage, parseXml } from './helpers/reqif';
import { parseTurtle } from './helpers/rdf';

const CLI = join(__dirname, '..', 'scripts', 'check.mts');

function run(args: string[]): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  // npm_config_loglevel=silent: the spawned npx must not leak its own
  // warnings (runner npmrc quirks like `always-auth`) into stderr — the
  // assertions count the CLI's diagnostic lines, never npm's noise.
  const res = spawnSync('npx', ['tsx', CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, npm_config_loglevel: 'silent' },
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

describe('primmel export CLI', () => {
  it('missing format/operands: usage, exit 2, no stack trace', () => {
    const bare = run(['export']);
    assert.equal(bare.status, 2);
    assert.match(bare.stderr, /Usage: primmel export reqif\|rdf/);
    const bogusFormat = run(['export', 'bogus', '/tmp']);
    assert.equal(bogusFormat.status, 2);
    assert.match(bogusFormat.stderr, /Usage: primmel export reqif\|rdf/);
    const missingDir = run(['export', 'reqif']);
    assert.equal(missingDir.status, 2);
    assert.match(missingDir.stderr, /Usage: primmel export reqif\|rdf/);
  });

  it('an unreadable package dir: clean diagnostic, exit 2', () => {
    const { status, stderr } = run(['export', 'reqif', '/nonexistent/pkg']);
    assert.equal(status, 2, `stderr: ${stderr}`);
    assert.match(stderr, /cannot read package at \/nonexistent\/pkg:/);
    assert.equal(stderr.trim().split('\n').length, 1);
  });

  it('unknown flag: usage, exit 2', () => {
    const { status, stderr } = run(['export', 'reqif', '--bogus', '/tmp']);
    assert.equal(status, 2, `stderr: ${stderr}`);
    assert.match(stderr, /unknown flag: --bogus/);
  });

  it('a load failure (invalid manifest): clean one-line message, exit 1 — not a usage error (review Minor 4)', () => {
    // A readable package dir whose package.primmel parses but declares
    // no id — the loader throws, the CLI maps it to exit 1 (a content
    // failure), never a stack trace.
    const parent = mkdtempSync(join(tmpdir(), 'primmel-reqif-bad-'));
    const dir = join(parent, 'pkg');
    mkdirSync(dir);
    writeFileSync(
      join(dir, 'package.primmel'),
      'package {\n  kind rec\n  title "No id"\n}\n',
    );
    const { status, stderr } = run(['export', 'reqif', dir]);
    assert.equal(status, 1, `stderr: ${stderr}`);
    assert.match(
      stderr,
      /cannot export package at .*: loadPackage: .* is not a valid package manifest/,
    );
    assert.equal(stderr.trim().split('\n').length, 1);
  });

  it('--out to an unwritable path: clean one-line diagnostic, exit 1, no stack trace (review Important 2)', () => {
    const dir = buildFixturePackage();
    const { status, stderr } = run([
      'export',
      'reqif',
      dir,
      '--out',
      '/nonexistent-dir/x.reqif',
    ]);
    assert.equal(status, 1, `stderr: ${stderr}`);
    assert.match(stderr, /cannot write \/nonexistent-dir\/x\.reqif:/);
    assert.equal(stderr.trim().split('\n').length, 1);
  });

  it('exports the fixture package to stdout by default', () => {
    const dir = buildFixturePackage();
    const { status, stdout, stderr } = run(['export', 'reqif', dir]);
    assert.equal(status, 0, stderr);
    const root = parseXml(stdout);
    assert.equal(root.tag, 'REQ-IF');
    assert.match(stdout, /primmel-so-req-scope-alpha/);
  });

  it('--out writes the document to a file (and --out=<file> works too)', () => {
    const dir = buildFixturePackage();
    const outDir = mkdtempSync(join(tmpdir(), 'primmel-reqif-out-'));
    const out = join(outDir, 'export.reqif');
    try {
      const { status, stdout, stderr } = run([
        'export',
        'reqif',
        dir,
        '--out',
        out,
      ]);
      assert.equal(status, 0, stderr);
      assert.match(stdout, /^wrote /);
      assert.match(stdout, /4 requirements, 2 requirement classes/);
      const root = parseXml(readFileSync(out, 'utf8'));
      assert.equal(root.tag, 'REQ-IF');

      const out2 = join(outDir, 'export2.reqif');
      const eq = run(['export', 'reqif', dir, `--out=${out2}`]);
      assert.equal(eq.status, 0, eq.stderr);
      // Same document modulo the export timestamp (two separate runs).
      const normalize = (s: string): string =>
        s
          .replace(/<CREATION-TIME>[^<]+/, '<CREATION-TIME>')
          .replace(/LAST-CHANGE="[^"]+"/g, 'LAST-CHANGE=""');
      assert.equal(
        normalize(readFileSync(out2, 'utf8')),
        normalize(readFileSync(out, 'utf8')),
      );
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

describe('primmel export rdf CLI (TODO.roadmap/27, surface 2)', () => {
  it('an unknown --format value: usage, exit 2', () => {
    const { status, stderr } = run([
      'export',
      'rdf',
      '/tmp',
      '--format',
      'xml',
    ]);
    assert.equal(status, 2, `stderr: ${stderr}`);
    assert.match(stderr, /unknown format: xml/);
    assert.match(stderr, /Usage: primmel export reqif\|rdf/);
  });

  it('--format on the reqif surface: usage, exit 2', () => {
    const { status, stderr } = run([
      'export',
      'reqif',
      '/tmp',
      '--format',
      'jsonld',
    ]);
    assert.equal(status, 2, `stderr: ${stderr}`);
    assert.match(stderr, /--format applies to `primmel export rdf` only/);
  });

  it('an unreadable package dir: clean diagnostic, exit 2', () => {
    const { status, stderr } = run(['export', 'rdf', '/nonexistent/pkg']);
    assert.equal(status, 2, `stderr: ${stderr}`);
    assert.match(stderr, /cannot read package at \/nonexistent\/pkg:/);
    assert.equal(stderr.trim().split('\n').length, 1);
  });

  it('a load failure (invalid manifest): clean one-line message, exit 1 — not a usage error (review Minor 3)', () => {
    // A readable package dir whose package.primmel parses but declares
    // no id — the loader throws, the CLI maps it to exit 1 (a content
    // failure), never a stack trace. The rdf-surface twin of the reqif
    // surface's 27b-Minor-4 leg.
    const parent = mkdtempSync(join(tmpdir(), 'primmel-rdf-bad-'));
    const dir = join(parent, 'pkg');
    mkdirSync(dir);
    writeFileSync(
      join(dir, 'package.primmel'),
      'package {\n  kind rec\n  title "No id"\n}\n',
    );
    const { status, stderr } = run(['export', 'rdf', dir]);
    assert.equal(status, 1, `stderr: ${stderr}`);
    assert.match(
      stderr,
      /cannot export package at .*: loadPackage: .* is not a valid package manifest/,
    );
    assert.equal(stderr.trim().split('\n').length, 1);
  });

  it('exports Turtle to stdout by default (parse-back)', () => {
    const dir = buildFixturePackage();
    const { status, stdout, stderr } = run(['export', 'rdf', dir]);
    assert.equal(status, 0, stderr);
    const store = parseTurtle(stdout);
    assert.ok(store.triples.length > 0);
    assert.match(stdout, /inst:req-scope-alpha a smart:Requirement/);
  });

  it('--format jsonld renders the same graph as JSON-LD', () => {
    const dir = buildFixturePackage();
    const { status, stdout, stderr } = run([
      'export',
      'rdf',
      dir,
      '--format',
      'jsonld',
    ]);
    assert.equal(status, 0, stderr);
    const doc = JSON.parse(stdout);
    assert.equal(doc['@context'].inst, 'urn:test:pkg:1#');
    assert.ok(
      doc['@graph'].some(
        (n: Record<string, unknown>) => n['@id'] === 'inst:req-scope-alpha',
      ),
    );
  });

  it('--out writes the document to a file with the stats summary', () => {
    const dir = buildFixturePackage();
    const outDir = mkdtempSync(join(tmpdir(), 'primmel-rdf-out-'));
    const out = join(outDir, 'export.ttl');
    try {
      const { status, stdout, stderr } = run([
        'export',
        'rdf',
        dir,
        '--out',
        out,
      ]);
      assert.equal(status, 0, stderr);
      assert.match(stdout, /^wrote /);
      assert.match(stdout, /4 requirements, 2 requirement classes/);
      assert.match(stdout, /1 conformance test, 0 terms, \d+ triples/);
      assert.ok(parseTurtle(readFileSync(out, 'utf8')).triples.length > 0);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
