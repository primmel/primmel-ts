// ─────────────────────────────────────────────────────────────────────
// Workspace locators (TODO.lang-spec/15, PROPOSAL-model-separation §2a).
//
// The workspace declares the NAMED resolution endpoints its packages
// compose through; the import carries its resolution in its own name —
// `ribose-registry::iso-iec-17000` reads: through the endpoint named
// ribose-registry, the package iso-iec-17000. The declarations live in
// the workspace's `.primmel/locators.prl` — never package content; the
// kernel reads the file standalone (walking up from the package
// directory, nearest file wins).
//
//   locator ribose-registry {
//     scheme registry
//     registry "https://models.ribose.com/v1"
//     auth env:RIBOSE_MODELS_TOKEN
//   }
//
//   locator acme-local {
//     scheme local
//     path "../model-library/${id}"
//   }
//
// The facets: `scheme` (`local` | `registry` | `git` — the endpoint
// kind), `path` (local: the directory template, `${id}` substituting
// the import's unqualified id), `registry` (the registry URL), `repo`
// and `ref` (git), and `auth`. The credentials are REFERENCES ONLY —
// `auth env:VAR` or `auth vault:path`; an inline secret is a checker
// error (C188). The local scheme resolves in the kernel (the path
// template); the registry and git schemes are declared endpoints their
// resolvers compile behind (the platform layer) — a dependency through
// them is interface-closed: the endpoint is declared, the content sits
// behind the credential.
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import tokenize, { stripWrapping, unwrapBlock } from './tokenize';

/** The endpoint kinds. `local` resolves in the kernel; `registry` and
 *  `git` are declared endpoints their resolvers compile behind (the
 *  platform layer). */
export type LocatorScheme = 'local' | 'registry' | 'git';

const SCHEMES: readonly LocatorScheme[] = ['local', 'registry', 'git'];

/** One named locator endpoint, exactly the file's declared facets. */
export interface LocatorEndpoint {
  name: string;
  scheme: LocatorScheme;
  /** local: the directory template; `${id}` substitutes the import's
   *  unqualified id. */
  path?: string;
  /** registry: the registry URL. */
  registry?: string;
  /** git: the repository URL template (may carry `${id}`). */
  repo?: string;
  /** git: the ref to resolve (branch, tag, commit). */
  ref?: string;
  /** The credential REFERENCE: `env:VAR` or `vault:path`. Never an
   *  inline secret — C188 (locator-credential-reference) judges it. */
  auth?: string;
}

export type LocatorIssueCode = 'locator-shape' | 'locator-credential';

export interface LocatorIssue {
  code: LocatorIssueCode;
  message: string;
}

export interface ParsedLocators {
  locators: LocatorEndpoint[];
  issues: LocatorIssue[];
}

/** The workspace locator file, relative to the workspace root. */
export const LOCATOR_FILE = join('.primmel', 'locators.prl');

/**
 * The keyword the workspace-file parser answers to. The locator file is
 * the workspace's own — never package content — so the keyword
 * deliberately has no package CONSTRUCTS entry; the registry-parity
 * gate reads this to count the construct as implemented.
 */
export const LOCATOR_KEYWORD = 'locator';

/**
 * The closure state of one dependency (§2a): `closed` (the content is
 * present locally), `interface-closed` (the endpoint is declared and
 * the content sits behind the interface), `unresolved` (known by name,
 * no locator reaches it).
 */
export type ClosureState = 'closed' | 'interface-closed' | 'unresolved';

/** One dependency's entry in the closure report. */
export interface ClosureEntry {
  /** The bare package id (the resolution target). */
  id: string;
  /** The qualifier, when the import carried one (`<locator>::<id>`). */
  locator?: string;
  /** The declared endpoint's scheme, when qualified. */
  scheme?: LocatorScheme;
  state: ClosureState;
  /** The resolved directory, when the content is present locally. */
  dir?: string;
}

/** The credential-reference prefixes (the ONLY accepted `auth` forms —
 *  an inline secret in a locator is C188). */
export const CREDENTIAL_REFERENCE_PREFIXES = ['env:', 'vault:'] as const;

/** Is this `auth` value a credential REFERENCE (never a literal)? */
export function isCredentialReference(value: string): boolean {
  return CREDENTIAL_REFERENCE_PREFIXES.some(p => value.startsWith(p));
}

/**
 * Parse a `.primmel/locators.prl` source. Total: malformed declarations
 * and facet-shape violations come back as `locator-shape` issues (C187's
 * declaration plane), inline credentials as `locator-credential` issues
 * (C188) — the file never throws, so one bad endpoint cannot take the
 * workspace's other declarations down with it.
 */
export function parseLocators(source: string): ParsedLocators {
  const locators: LocatorEndpoint[] = [];
  const issues: LocatorIssue[] = [];
  const names = new Set<string>();
  const t = tokenize(source);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'locator') {
      issues.push({
        code: 'locator-shape',
        message: `locators: expected "locator <name> { … }", got "${cmd}" — the locator file declares endpoints, nothing else`,
      });
      // Skip the stray token's value if it has one (the manifest
      // parser's skipUnknownValue posture).
      if (i < t.length && !t[i]!.startsWith('{') && !t[i]!.startsWith('"')) {
        i++;
      }
      continue;
    }
    const nameToken = t[i++];
    if (nameToken === undefined) {
      issues.push({
        code: 'locator-shape',
        message: 'locators: a `locator` declaration names no endpoint',
      });
      break;
    }
    const name = stripWrapping(nameToken);
    const blockToken = t[i++];
    if (blockToken === undefined || !blockToken.startsWith('{')) {
      issues.push({
        code: 'locator-shape',
        message: `locator ${name}: the declaration carries no facet block — "locator ${name} { scheme … }"`,
      });
      continue;
    }
    const ep: LocatorEndpoint = {
      name,
      scheme: '' as LocatorScheme,
    };
    const bt = tokenize(unwrapBlock(blockToken));
    let j = 0;
    while (j < bt.length) {
      const facet = bt[j++];
      const value = bt[j];
      if (value === undefined) {
        issues.push({
          code: 'locator-shape',
          message: `locator ${name}: facet "${facet}" carries no value`,
        });
        break;
      }
      j++;
      const v = stripWrapping(value);
      if (facet === 'scheme') {
        if (!SCHEMES.includes(v as LocatorScheme)) {
          issues.push({
            code: 'locator-shape',
            message: `locator ${name}: Expected scheme ${SCHEMES.join('|')}, got "${v}"`,
          });
        } else {
          ep.scheme = v as LocatorScheme;
        }
      } else if (facet === 'path') {
        ep.path = v;
      } else if (facet === 'registry') {
        ep.registry = v;
      } else if (facet === 'repo') {
        ep.repo = v;
      } else if (facet === 'ref') {
        ep.ref = v;
      } else if (facet === 'auth') {
        ep.auth = v;
      } else {
        issues.push({
          code: 'locator-shape',
          message: `locator ${name}: unknown facet "${facet}" — the facets are scheme, path, registry, repo, ref, auth`,
        });
      }
    }
    // The declaration's shape: a scheme, the scheme's required facet,
    // and a name the workspace declares once.
    if (names.has(name)) {
      issues.push({
        code: 'locator-shape',
        message: `locator ${name}: the workspace declares the endpoint twice — a locator name is the resolution's identity, declared once`,
      });
    }
    names.add(name);
    if (ep.scheme === ('' as LocatorScheme)) {
      issues.push({
        code: 'locator-shape',
        message: `locator ${name}: declares no scheme — Expected scheme ${SCHEMES.join('|')}`,
      });
    } else {
      const required: Record<LocatorScheme, string | null> = {
        local: 'path',
        registry: 'registry',
        git: 'repo',
      };
      const need = required[ep.scheme];
      if (
        need &&
        (ep as unknown as Record<string, string | undefined>)[need] ===
          undefined
      ) {
        issues.push({
          code: 'locator-shape',
          message: `locator ${name}: scheme ${ep.scheme} requires the "${need}" facet`,
        });
      }
    }
    locators.push(ep);
    // The credential plane (C188): references only.
    if (ep.auth !== undefined && !isCredentialReference(ep.auth)) {
      issues.push({
        code: 'locator-credential',
        message: `locator ${name}: auth "${ep.auth}" is an inline credential — credentials are references only (auth env:VAR or auth vault:path) (locator-credential-reference)`,
      });
    }
  }
  return { locators, issues };
}

/** A discovered workspace: the locator file, its directory (the base
 *  the `path` templates resolve against), and its parsed endpoints. */
export interface Workspace {
  file: string;
  dir: string;
  locators: LocatorEndpoint[];
  issues: LocatorIssue[];
}

/**
 * Find the workspace's locator file: walk up from `startDir` (nearest
 * `.primmel/locators.prl` wins), parse it. Returns null when no
 * ancestor declares one — the workspace vocabulary is absent, and a
 * package's qualified imports are C187 errors.
 */
export function findWorkspaceLocators(startDir: string): Workspace | null {
  let dir = resolve(startDir);
  for (;;) {
    const file = join(dir, LOCATOR_FILE);
    if (existsSync(file)) {
      const parsed = parseLocators(readFileSync(file, 'utf8'));
      return { file, dir, ...parsed };
    }
    const parent = join(dir, '..');
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/** The named endpoint of a workspace, or undefined. */
export function locatorByName(
  ws: Workspace,
  name: string,
): LocatorEndpoint | undefined {
  return ws.locators.find(l => l.name === name);
}

/** `${id}` substitution: the endpoint template with the import's
 *  unqualified id in place. */
export function substituteId(template: string, id: string): string {
  return template.split('${id}').join(id);
}

/**
 * Resolve a LOCAL endpoint for a package id: the path template,
 * `${id}`-substituted, against the workspace directory. Returns the
 * directory when it exists, else undefined (the endpoint does not
 * reach the id — the closure report records `unresolved`).
 */
export function localEndpointDir(
  ws: Workspace,
  endpoint: LocatorEndpoint,
  id: string,
): string | undefined {
  if (endpoint.scheme !== 'local' || endpoint.path === undefined) {
    return undefined;
  }
  const dir = resolve(ws.dir, substituteId(endpoint.path, id));
  return existsSync(dir) ? dir : undefined;
}
