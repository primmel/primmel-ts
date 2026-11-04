// ─────────────────────────────────────────────────────────────────────
// The edition-lifecycle family — checkEditionLifecycle moved wholesale from check.ts (the
// family-module decomposition). The compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type { CheckIssue } from '../check';
import { findCycle } from '../graph';
import { normalizeSourceRef } from '../model-diff';
import { readPackageManifest } from '../ser-des/package';
import { isDate, isDateTime, timeInstantMs } from '../time';
import type Standard from '../types/Standard';
import { readdirSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';

export function checkEditionLifecycle(
  dir: string,
  standard: Standard,
  providers?: Array<{ id: string; dir: string }>,
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const err = (check: string, message: string) =>
    issues.push({ check, severity: 'error', message });
  const warn = (check: string, message: string) =>
    issues.push({ check, severity: 'warning', message });
  const m = standard.packageManifest;
  if (!m) {
    return issues;
  }
  const register = new Set<string>([
    ...(m.editions ?? []),
    ...(m.version ? [m.version] : []),
  ]);
  // Under composition the register is the union the closure EXPLICITLY
  // declares: every provider manifest's editions join the root's, so a
  // merged package's own instances pin against their declaring package's
  // register, not the consumer's. Nothing implicit enters — a pin to an
  // edition no closure manifest declares still fails (INV-8 keeps its
  // teeth; the r60-lml closure's procedure packages are the case that
  // named this).
  for (const p of providers ?? []) {
    try {
      const pm = readPackageManifest(p.dir);
      for (const e of pm.editions ?? []) {
        register.add(e);
      }
      if (pm.version) {
        register.add(pm.version);
      }
    } catch {
      // An unparseable provider manifest is reported by the uses edges
      // (C27); the register union silently skips it.
    }
  }

  // C77 — a current/preview edition is the register's newest entry.
  if (m.status === 'current' || m.status === 'preview') {
    const newest = (m.editions ?? [])[0];
    if (newest !== undefined && m.version !== newest) {
      err(
        'C77',
        `package "${m.id}": status ${m.status} but version "${m.version}" is not the edition register's newest entry (${newest}) (edition-status)`,
      );
    }
  }

  // C78 — the validity window is well-formed time (§13.7).
  if (m.validity) {
    const { from, to } = m.validity;
    if (!from || !(isDate(from) || isDateTime(from))) {
      err(
        'C78',
        `package "${m.id}": validity window from "${from}" is not an ISO 8601 date/datetime (edition-validity-window)`,
      );
    }
    if (to !== undefined) {
      if (!(isDate(to) || isDateTime(to))) {
        err(
          'C78',
          `package "${m.id}": validity window to "${to}" is not an ISO 8601 date/datetime (edition-validity-window)`,
        );
      } else if (from) {
        // Compare as INSTANTS, never lexicographically: a mixed
        // date/datetime pair (from 2021-01-01T00:00:00Z, to 2021-01-01)
        // is the same moment — string order false-positives on it.
        const fromMs = timeInstantMs(from);
        const toMs = timeInstantMs(to);
        if (fromMs !== null && toMs !== null && toMs < fromMs) {
          err(
            'C78',
            `package "${m.id}": validity window to ${to} is before from ${from} (edition-validity-window)`,
          );
        }
      }
    }
  }

  // C85 — the base URN is a well-formed IRI (TODO.roadmap/27, task-27c
  // review Important 1): a scheme, then no whitespace or IRI delimiters.
  // baseUrn grounds every downstream IRI (the RDF projection's document
  // node and instance IRIs, edition-normalized provenance comparisons);
  // the field is a free string, and a malformed value (`urn:bad urn`)
  // passed check while exports emitted spec-malformed IRIREFs silently.
  // The same shape the RDF export guards on (export/rdf.ts IRI_SHAPED) —
  // duplicated as one line rather than shared across the kernel/export
  // boundary.
  if (
    m.baseUrn &&
    !/^[A-Za-z][A-Za-z0-9+.-]*:[^\s<>"{}|^`\\]*$/.test(m.baseUrn)
  ) {
    err(
      'C85',
      `package "${m.id}": baseUrn "${m.baseUrn}" is not a well-formed IRI (a scheme followed by no whitespace or IRI delimiters) (baseurn-wellformed)`,
    );
  }

  // C79 — supersedes/replaces/superseded_by: well-formed URNs, never self,
  // resolving against the register (same-document targets) and acyclic
  // across the repo's manifests (§13.7). The v3.2 forward edge
  // (superseded_by, clause 9.3.1) takes the same shape checks; coherence of
  // the two directions is C113 below.
  const relations: [string, string][] = [
    ...(m.supersedes ?? []).map(t => ['supersedes', t] as [string, string]),
    ...(m.replaces ?? []).map(t => ['replaces', t] as [string, string]),
    ...(m.supersededBy ?? []).map(
      t => ['superseded_by', t] as [string, string],
    ),
  ];
  const ownBasis = normalizeSourceRef(m.baseUrn ?? '', '').basis;
  for (const [rel, target] of relations) {
    if (!target.startsWith('urn:')) {
      err(
        'C79',
        `package "${m.id}": ${rel} "${target}" is not a URN — versioning relations name published package versions (edition-supersedes-resolves)`,
      );
      continue;
    }
    if (target === m.baseUrn) {
      err(
        'C79',
        `package "${m.id}": ${rel} ${target} — a package cannot ${rel} itself (edition-supersedes-resolves)`,
      );
      continue;
    }
    const tNorm = normalizeSourceRef(target, '');
    if (rel !== 'superseded_by' && tNorm.basis === ownBasis && tNorm.edition) {
      if (!register.has(tNorm.edition)) {
        warn(
          'C79',
          `package "${m.id}": ${rel} ${target}, but the edition register { ${[...register].join(' ')} } does not list ${tNorm.edition} (edition-supersedes-resolves)`,
        );
      }
    }
  }
  if (relations.length > 0) {
    // The supersedes graph over the repo's manifests (sibling dirs keyed
    // by baseUrn) must be acyclic — no superseding oneself through a
    // chain. Edges to URNs no sibling declares are external and cannot
    // close a cycle here. The walk also captures each node's forward edge
    // (superseded_by) for C113; the cycle detector deliberately reads the
    // backward edges ONLY — a matched supersedes/superseded_by pair is
    // one lineage fact declared at both ends, never a 2-cycle.
    const nodes = new Map<string, [string, string][]>(); // baseUrn → backward relations
    const forwardByNode = new Map<string, Set<string>>(); // baseUrn → superseded_by targets
    const parent = dirname(resolve(dir));
    for (const entry of readdirSync(parent).sort()) {
      const full = join(parent, entry);
      try {
        if (!statSync(full).isDirectory()) {
          continue;
        }
        const sib = readPackageManifest(full);
        const key = sib.baseUrn || sib.id;
        nodes.set(key, [
          ...(sib.supersedes ?? []).map(
            t => ['supersedes', t] as [string, string],
          ),
          ...(sib.replaces ?? []).map(t => ['replaces', t] as [string, string]),
        ]);
        forwardByNode.set(key, new Set(sib.supersededBy ?? []));
      } catch {
        // Not a package dir — not a graph node.
      }
    }
    const adj = new Map<string, string[]>();
    for (const [baseUrn, rels] of nodes) {
      adj.set(
        baseUrn,
        rels
          .map(([, t]) => t)
          // Self-edges are reported by the dedicated self-supersession
          // check above — the cycle detector covers chains of length ≥ 2.
          .filter(t => nodes.has(t) && t !== baseUrn),
      );
    }
    const cycle = findCycle(adj);
    if (cycle) {
      err(
        'C79',
        `supersedes cycle: ${cycle.join(' → ')} — the supersedes graph must be acyclic; a package cannot supersede itself through a chain (edition-supersedes-resolves)`,
      );
    }

    // C113 — edition-lineage-coherent (MN 114 v3.2, clause 9.3.1): the
    // lineage graph is the union of the declared edges of both directions;
    // when two composed packages declare opposite edges between the same
    // pair, the declarations must agree. A MISSING forward edge is never
    // an error — the backward edges remain the authored minimum — so each
    // leg fires only when the opposite edge set is declared and omits this
    // package. Edges to URNs no sibling declares are external: nothing to
    // cohere with here.
    const ownKey = m.baseUrn || m.id;
    for (const target of [...(m.supersedes ?? []), ...(m.replaces ?? [])]) {
      const fwd = forwardByNode.get(target);
      if (fwd !== undefined && fwd.size > 0 && !fwd.has(ownKey)) {
        err(
          'C113',
          `package "${m.id}": supersedes/replaces ${target}, but that package declares superseded_by { ${[...fwd].join(' ')} } without ${ownKey} — opposite lineage edges between the same pair must agree (edition-lineage-coherent)`,
        );
      }
    }
    for (const target of m.supersededBy ?? []) {
      const bwdRels = nodes.get(target);
      if (bwdRels === undefined) {
        continue;
      }
      const bwd = new Set(bwdRels.map(([, t]) => t));
      if (bwd.size > 0 && !bwd.has(ownKey)) {
        err(
          'C113',
          `package "${m.id}": superseded_by ${target}, but that package declares supersedes/replaces { ${[...bwd].join(' ')} } without ${ownKey} — opposite lineage edges between the same pair must agree (edition-lineage-coherent)`,
        );
      }
    }
  }

  // C80 — INV-8: definition version pins resolve against the edition
  // register. Silent on a register-less package (nothing to resolve
  // against); C18 still requires the pins themselves.
  if (register.size > 0) {
    for (const inst of standard.instances ?? []) {
      for (const [definition, version] of Object.entries(
        inst.definitionVersions ?? {},
      )) {
        if (!register.has(version)) {
          err(
            'C80',
            `instance ${inst.id}: definition_versions pin ${definition} : "${version}" does not resolve against the edition register { ${[...register].join(' ')} } — every executed definition is version-pinned to a declared edition (INV-8) (edition-pin-resolves)`,
          );
        }
      }
    }
  }

  return issues;
}
