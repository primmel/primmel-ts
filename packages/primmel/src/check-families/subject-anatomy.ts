// ─────────────────────────────────────────────────────────────────────
// The subject-anatomy family (C170 edition-lineage, C168 method-refs,
// C6-C9 the subject anatomy): the pre-promise legs — the declarative
// edition mapping (the cross-edition linkage is an artifact, never
// implicit), the method_ref resolution (bare in-package or scoped
// through the locator, the C31 doctrine), and the subject anatomy's
// family placement / characteristic derivation / behavior resolution /
// extends chains. The region moves verbatim from check.ts; the
// compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import { readFileSync } from 'fs';
import { join } from 'path';
import { loadPackageWithIssues, readPackageManifest } from '../ser-des/package';
import type Standard from '../types/Standard';

export interface SubjectAnatomyContext {
  dir: string;
  standard: Standard;
  behaviorIds: Set<string>;
  subjectIds: Set<string>;
  err: (check: string, message: string) => void;
  warn: (check: string, message: string) => void;
  resolvePackage?: (id: string) => string | undefined;
}

export function runSubjectAnatomyFamily({
  dir,
  standard,
  behaviorIds,
  subjectIds,
  err,
  warn,
  resolvePackage,
}: SubjectAnatomyContext): void {
  // ── C170 edition-lineage-declared ───────────────────────────────────
  // A package declaring more than one edition carries a declarative
  // edition mapping (edition-mapping.json, primmel-edition-mapping/1)
  // naming both edition states — the cross-edition linkage is an
  // artifact, never implicit. Born-at-edition packages map the prior
  // edition with model_state: null and the reason.
  try {
    const mf = readPackageManifest(dir);
    const eds = (mf.editions ?? []).map(String);
    if (eds.length > 1) {
      const map = JSON.parse(
        readFileSync(join(dir, 'edition-mapping.json'), 'utf8'),
      ) as {
        kind?: string;
        from?: { edition?: string | number };
        to?: { edition?: string | number };
      };
      if (map.kind !== 'primmel-edition-mapping/1') {
        err(
          'C170',
          `edition-mapping.json: kind "${String(map.kind)}" is not primmel-edition-mapping/1 (edition-lineage-declared)`,
        );
      } else {
        const fromEd =
          map.from?.edition === undefined
            ? undefined
            : String(map.from.edition);
        const toEd =
          map.to?.edition === undefined ? undefined : String(map.to.edition);
        for (const [side, ed] of [
          ['from', fromEd],
          ['to', toEd],
        ] as const) {
          if (!ed || !eds.includes(ed)) {
            err(
              'C170',
              `edition-mapping.json: the ${side} edition ${String(ed)} is not among the manifest's declared editions [${eds.join(', ')}] (edition-lineage-declared)`,
            );
          }
        }
      }
    }
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'ENOENT') {
      const eds = ((): string[] => {
        try {
          return ((readPackageManifest(dir).editions ?? []) as unknown[]).map(
            String,
          );
        } catch {
          return [];
        }
      })();
      if (eds.length > 1) {
        err(
          'C170',
          `the package declares ${eds.length} editions [${eds.join(', ')}] but ships no edition-mapping.json — the cross-edition linkage is an artifact, never implicit (edition-lineage-declared)`,
        );
      }
    } else if (e instanceof SyntaxError) {
      err(
        'C170',
        `edition-mapping.json is not valid JSON: ${(e as Error).message} (edition-lineage-declared)`,
      );
    }
  }

  // ── C168 method-ref-resolves ────────────────────────────────────────
  // A conformance test's method_ref names THE PROCESS the test realizes:
  // a bare id resolved in this package, or a scoped <package>:<id>
  // reference resolved read-only through the locator (the target's own
  // content validates the id; nothing merges — the C31 doctrine). A
  // bibliographic standard id is not a resolution target: the method is
  // a process to be realized, not a document to cite. Locator-gated
  // like C27-C31 — without a locator the scoped leg stays silent.
  const methodTargetIds = (s: Standard): Set<string> =>
    new Set([
      ...(s.processes ?? []).map(p => p.id),
      ...(s.conformanceTests ?? []).map(x => x.id),
    ]);
  const localMethodIds = methodTargetIds(standard);
  const scopedMethodIds = new Map<string, Set<string>>();
  const resolveCitation = (elemId: string, ref: string): void => {
    const colon = ref.indexOf(':');
    if (colon <= 0) {
      if (!localMethodIds.has(ref)) {
        err(
          'C168',
          `${elemId}: the reference "${ref}" names no process or conformance test declared in this package (method-ref-resolves)`,
        );
      }
      return;
    }
    if (!resolvePackage) {
      return;
    }
    const pkgId = ref.slice(0, colon);
    const localId = ref.slice(colon + 1);
    let ids = scopedMethodIds.get(pkgId);
    if (!ids) {
      ids = new Set<string>();
      try {
        const depDir = resolvePackage(pkgId);
        if (depDir) {
          const dep = loadPackageWithIssues(depDir);
          ids = methodTargetIds(dep.standard);
        }
      } catch {
        // Unreadable dependency — C27 reports the resolution failure;
        // this rule stays silent rather than double-reporting.
      }
      scopedMethodIds.set(pkgId, ids);
    }
    if (!ids.has(localId)) {
      err(
        'C168',
        `${elemId}: the reference "${ref}" names no process or conformance test declared in package "${pkgId}" (method-ref-resolves)`,
      );
    }
  };
  for (const t of standard.conformanceTests ?? []) {
    const ref = t.methodRef;
    if (ref) {
      resolveCitation(t.id, ref);
    }
  }
  // The process bodies' call edges ride the same resolution: a step's
  // `calls <p>` (typed or raw-plane) names a process to be realized.
  for (const pr of standard.processes ?? []) {
    const raw = pr as unknown as {
      steps?: { id?: string; calls?: string; signatureBlock?: string }[];
    };
    for (const st of raw.steps ?? []) {
      const call =
        st.calls || st.signatureBlock?.match(/\bcalls +([\w:/.-]+)/)?.[1];
      if (call) {
        resolveCitation(`${pr.id}/step/${st.id ?? ''}`, call);
      }
    }
  }
  // C6 — subject anatomy: every aspect declared under exactly one family
  // (anatomy-family). The parser records wrong-family and undeclared
  // aspect keys on Subject.misplacedAspects; value-level markers catch
  // the two classic content confusions (a test-dependent value among
  // design parameters; a condition tier among attributes). NOTE: those
  // two value-level checks (the test-dependent marker in
  // design_parameters; condition-tier keys in has.attributes) are
  // HEURISTICS beyond the spec's literal wording — the spec mandates
  // aspect→family placement only.
  const ASPECT_FAMILY: Record<string, string> = {
    metadata: 'is',
    provenance: 'is',
    structure: 'is',
    design_parameters: 'is',
    designed_conditions: 'is',
    promises: 'is',
    artifacts: 'is',
    endpoint: 'is',
    attributes: 'has',
    dimensions: 'has',
    state: 'has',
    characteristics: 'has',
    environmental_context: 'has',
    artifact_instances: 'has',
    serve: 'has',
    behavior: 'does',
  };
  const CONDITION_TIERS = new Set(['reference', 'rated', 'limiting']);
  for (const s of standard.subjects ?? []) {
    for (const m of s.misplacedAspects ?? []) {
      const home = ASPECT_FAMILY[m.aspect];
      if (home && home !== m.family) {
        err(
          'C6',
          `subject ${s.id}: aspect "${m.aspect}" declared under family "${m.family}" — it belongs to "${home}" (anatomy-family)`,
        );
      } else if (!home) {
        err(
          'C6',
          `subject ${s.id}: undeclared aspect "${m.aspect}" in family "${m.family}" (anatomy-family)`,
        );
      }
    }
    for (const [k, v] of Object.entries(s.is.designParameters ?? {})) {
      if (/test[-_]dependent/.test(v)) {
        err(
          'C6',
          `subject ${s.id}: design parameter "${k}" is test-dependent — exhibited values belong to has.attributes (anatomy-family)`,
        );
      }
    }
    for (const k of Object.keys(s.has.attributes ?? {})) {
      if (CONDITION_TIERS.has(k)) {
        err(
          'C6',
          `subject ${s.id}: attribute "${k}" is a condition tier — designed tiers belong to is.designed_conditions (anatomy-family)`,
        );
      }
    }
    // C7 — every characteristic names its derivation from behavior I/O
    // (anatomy-characteristic-derivation).
    for (const [k, c] of Object.entries(s.has.characteristics ?? {})) {
      if (!c.derivation) {
        err(
          'C7',
          `subject ${s.id}: characteristic "${k}" names no derivation from behavior I/O (anatomy-characteristic-derivation)`,
        );
      }
    }
    // C8 — every does behavior resolves to a declared behavior
    // (anatomy-behavior-resolves).
    for (const b of s.does.behaviors ?? []) {
      if (!behaviorIds.has(b)) {
        err(
          'C8',
          `subject ${s.id}: behavior "${b}" is not a declared behavior (anatomy-behavior-resolves)`,
        );
      }
    }
    // C9 — a subject's extends target resolves to a declared subject id
    // (subject-extends-resolves). Successfully merged chains clear
    // `extends` at resolve time, so a surviving link is exactly an
    // unresolved one (missing parent, or a broken cycle).
    if (s.extends && !subjectIds.has(s.extends)) {
      warn(
        'C9',
        `subject ${s.id}: extends "${s.extends}" is not a declared subject (subject-extends-resolves)`,
      );
    }
  }
}
