// ─────────────────────────────────────────────────────────────────────
// The attestations family — checkAttestations moved wholesale from check.ts (the
// family-module decomposition). The compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type { CheckIssue } from '../check';
import type Standard from '../types/Standard';
import type { SubjectPromise } from '../types/Subject';

export function checkAttestations(standard: Standard): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const err = (check: string, message: string) =>
    issues.push({ check, severity: 'error', message });

  const roleIds = new Set((standard.roles ?? []).map(r => r.id));

  const instanceIds = new Set((standard.instances ?? []).map(i => i.id));
  const verdictIds = new Set((standard.verdicts ?? []).map(v => v.id));

  // A promise set is either a top-level promise_set construct or a
  // subject's anonymous is-promises register. The reference forms:
  // the bare construct id, `Subject.set`, or `Subject.promise_set`.
  interface SetView {
    promises: SubjectPromise[];
  }
  const setViews = new Map<string, SetView>();
  for (const ps of standard.promiseSets ?? []) {
    setViews.set(ps.id, { promises: ps.promises });
    setViews.set(`${ps.id}.promise_set`, { promises: ps.promises });
  }
  for (const s of standard.subjects ?? []) {
    if ((s.is?.promises ?? []).length > 0) {
      setViews.set(s.id, { promises: s.is.promises });
    }
  }
  const resolveSet = (ref: string): SetView | null =>
    setViews.get(ref) ??
    setViews.get(ref.split('.').slice(1).join('.')) ??
    null;

  const mandatoryOf = (view: SetView): Set<string> => {
    const out = new Set<string>();
    for (const p of view.promises) {
      if (p.certificate?.obligation === 'mandatory') {
        out.add(p.id);
      }
    }
    return out;
  };

  for (const a of standard.attestations ?? []) {
    if (!a.subject) {
      err(
        'C150',
        `attestation ${a.id}: no subject facet (attestation-references-resolve)`,
      );
    } else if (!instanceIds.has(a.subject)) {
      err(
        'C150',
        `attestation ${a.id}: subject "${a.subject}" is not a declared instance (attestation-references-resolve)`,
      );
    }
    if (!a.promises) {
      err(
        'C150',
        `attestation ${a.id}: no promises facet (attestation-references-resolve)`,
      );
    }
    const set = a.promises ? resolveSet(a.promises) : null;
    if (a.promises && !set) {
      err(
        'C150',
        `attestation ${a.id}: promises "${a.promises}" does not resolve to a declared promise set (attestation-references-resolve)`,
      );
    }
    for (const b of a.basis) {
      if (!b.kind || !b.id) {
        err(
          'C150',
          `attestation ${a.id}: a basis entry needs an evidence kind and an id (attestation-references-resolve)`,
        );
      }
    }
    if (
      a.authority.role &&
      roleIds.size > 0 &&
      !roleIds.has(a.authority.role)
    ) {
      err(
        'C150',
        `attestation ${a.id}: authority role "${a.authority.role}" is not a declared role (attestation-references-resolve)`,
      );
    }

    const carried = new Set(a.claims.map(c => c.promise));
    for (const c of a.claims) {
      if (set && !set.promises.some(p => p.id === c.promise)) {
        err(
          'C150',
          `attestation ${a.id}: claim "${c.promise}" is not a promise of "${a.promises}" (attestation-references-resolve)`,
        );
      }
      if (!c.declared) {
        err(
          'C151',
          `attestation ${a.id}: claim "${c.promise}" carries no declaration reference (attestation-claim-lineage)`,
        );
      }
      if (!c.validatedBy) {
        err(
          'C151',
          `attestation ${a.id}: claim "${c.promise}" carries no verdict reference (attestation-claim-lineage)`,
        );
      } else if (
        verdictIds.size > 0 &&
        !c.validatedBy.startsWith('/') &&
        !verdictIds.has(c.validatedBy)
      ) {
        // Bare ids resolve inside the package; slash ids are the
        // requirement-anatomy path form and resolve in the linker.
        err(
          'C150',
          `attestation ${a.id}: claim "${c.promise}" names verdict "${c.validatedBy}", which is not declared (attestation-references-resolve)`,
        );
      }
    }
    if (set) {
      for (const pid of mandatoryOf(set)) {
        if (!carried.has(pid)) {
          err(
            'C151',
            `attestation ${a.id}: the mandatory promise "${pid}" of "${a.promises}" is carried by no claim — a mandatory characteristic is carried by lineage, never restated (attestation-claim-lineage)`,
          );
        }
      }
    }
  }
  return issues;
}
