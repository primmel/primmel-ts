// ─────────────────────────────────────────────────────────────────────
// The dataspaces family (C104–C108, TODO.primmel/10, MN 114 v3.1
// clause 19): the dataspace is model content — participant classes,
// artifact classes, the policy register, the trust anchors, the
// governance citations. C104 resolves the dataspace's references
// (policies, default policy, per-class overrides, content elements,
// compatibility register). C105 checks the trust anchors' shape — the
// trust_ref is OPAQUE (types/TrustRef.ts): the checker verifies
// presence, never resolution (the trust plane's membership is runtime
// fact, not model content). C106 warns on a dataspace with no
// governance citation. C107 is the policy shape: at least one rule,
// every rule with its action, a rule's artifact inside the governs
// register, the governed classes resolving, and at most one
// default-posture policy per class. C108 is the correspondence shape:
// one entry per scheme per element, and the irdi legacy spelling
// agreeing with `corresponds iec-cdd` when both are present.
//
// THE FAMILY-MODULE PATTERN (the check.ts decomposition, one family
// at a time): the family takes the context record it actually uses —
// `standard` and the two emit closures — and nothing else. The bodies
// move verbatim from check.ts; the compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type Standard from '../types/Standard';

export interface DataspacesContext {
  standard: Standard;
  err: (check: string, message: string) => void;
  warn: (check: string, message: string) => void;
}

export function runDataspacesFamily({
  standard,
  err,
  warn,
}: DataspacesContext): void {
  {
    const dataspaces = standard.dataspaces ?? [];
    const policies = standard.policies ?? [];
    const policyIds = new Set(policies.map(p => p.id));
    const dataspaceIds = new Set(dataspaces.map(d => d.id));
    // The merged artifact-class register: the union over the package's
    // dataspaces (composition merges the closure's collections upstream).
    const artifactClassIds = new Set<string>();
    for (const d of dataspaces) {
      for (const ac of d.artifactClasses) {
        artifactClassIds.add(ac.id);
      }
    }
    // The content-element domain of artifact_class element refs: the
    // model elements that define an exchanged class's content.
    const elementIds = new Set<string>([
      ...(standard.artifactDefinitions ?? []).map(a => a.id),
      ...(standard.forms ?? []).map(f => f.id),
      ...(standard.dataclasses ?? []).map(c => c.id),
    ]);

    for (const d of dataspaces) {
      // C104 — dataspace-references-resolve
      for (const pid of d.policies) {
        if (!policyIds.has(pid)) {
          err(
            'C104',
            `dataspace ${d.id}: policies entry "${pid}" declares no policy of that id — the dataspace's policy register references declared policy constructs (dataspace-references-resolve)`,
          );
        }
      }
      if (d.defaultPolicy !== '') {
        if (!policyIds.has(d.defaultPolicy)) {
          err(
            'C104',
            `dataspace ${d.id}: default_policy "${d.defaultPolicy}" declares no policy of that id — the standing default is a declared policy (dataspace-references-resolve)`,
          );
        } else if (!d.policies.includes(d.defaultPolicy)) {
          err(
            'C104',
            `dataspace ${d.id}: default_policy "${d.defaultPolicy}" is not in the dataspace's policies register — the default is one of the policy sets the dataspace carries (dataspace-references-resolve)`,
          );
        }
      }
      for (const ac of d.artifactClasses) {
        if (ac.policy !== '') {
          if (!policyIds.has(ac.policy)) {
            err(
              'C104',
              `dataspace ${d.id}: artifact class "${ac.id}" overrides with policy "${ac.policy}", which declares no policy of that id (dataspace-references-resolve)`,
            );
          } else if (!d.policies.includes(ac.policy)) {
            err(
              'C104',
              `dataspace ${d.id}: artifact class "${ac.id}" overrides with policy "${ac.policy}", which the dataspace's policies register does not carry — an override names a policy set the dataspace carries (dataspace-references-resolve)`,
            );
          }
        }
        if (ac.element !== '' && !elementIds.has(ac.element)) {
          err(
            'C104',
            `dataspace ${d.id}: artifact class "${ac.id}" declares element "${ac.element}", which names no declared artifact definition, form, or data class — the class's content definition must resolve (dataspace-references-resolve)`,
          );
        }
      }
      for (const compat of d.compatibleWith) {
        if (!dataspaceIds.has(compat)) {
          err(
            'C104',
            `dataspace ${d.id}: compatible_with entry "${compat}" declares no dataspace of that id — compatibility is explicit and resolved (dataspace-references-resolve)`,
          );
        } else if (compat === d.id) {
          err(
            'C104',
            `dataspace ${d.id}: compatible_with names the dataspace itself — compatibility relates two dataspaces (dataspace-references-resolve)`,
          );
        }
      }

      // C105 — dataspace-trust-anchor-shape
      for (const ta of d.trustAnchors) {
        if (!ta.trustRef || ta.trustRef.org === '') {
          err(
            'C105',
            `dataspace ${d.id}: trust anchor "${ta.id}" declares no trust_ref with an organization identifier — an anchor without its trust reference anchors nothing (dataspace-trust-anchor-shape)`,
          );
        }
      }

      // C106 — dataspace-governance-provenance
      const hasGovernance =
        (d.sourceRefs?.length ?? 0) > 0 ||
        (d.source && (d.source.doc || d.source.clause));
      if (!hasGovernance) {
        warn(
          'C106',
          `dataspace ${d.id}: the dataspace cites no governance clause — the definition's charter is its clause-cited provenance (ref derives-from); an orphan definition is a warning, never silent (dataspace-governance-provenance)`,
        );
      }
    }

    // C107 — policy-shape
    for (const p of policies) {
      if (p.rules.length === 0) {
        err(
          'C107',
          `policy ${p.id}: a policy declares at least one rule — a rule-less set says nothing (policy-shape)`,
        );
      }
      for (const g of p.governs) {
        if (!artifactClassIds.has(g)) {
          err(
            'C107',
            `policy ${p.id}: governs entry "${g}" names no artifact class declared by the merged model's dataspaces — the governed classes resolve (policy-shape)`,
          );
        }
      }
      for (const r of p.rules) {
        if (r.action === '') {
          err(
            'C107',
            `policy ${p.id}: rule "${r.id}" declares no action — a rule without its action says nothing (policy-shape)`,
          );
        }
        if (r.artifact !== '') {
          if (p.governs.length > 0 && !p.governs.includes(r.artifact)) {
            err(
              'C107',
              `policy ${p.id}: rule "${r.id}" constrains artifact class "${r.artifact}", which is not in the policy's governs register — a rule stays inside the register, or drops the facet to cover every governed class (policy-shape)`,
            );
          }
          if (!artifactClassIds.has(r.artifact)) {
            err(
              'C107',
              `policy ${p.id}: rule "${r.id}" constrains artifact class "${r.artifact}", which no dataspace of the merged model declares (policy-shape)`,
            );
          }
        }
      }
    }
    // At most one default-posture policy per governed class.
    const postureByClass = new Map<string, string[]>();
    for (const p of policies) {
      if (p.defaultPosture !== true) {
        continue;
      }
      for (const g of p.governs) {
        postureByClass.set(g, [...(postureByClass.get(g) ?? []), p.id]);
      }
    }
    for (const [cls, ids] of postureByClass) {
      if (ids.length > 1) {
        err(
          'C107',
          `artifact class "${cls}" is governed by ${ids.length} default-posture policies (${ids.join(', ')}) — the standing default is one policy per class; the rest attach by explicit reference (policy-shape)`,
        );
      }
    }

    // C108 — correspondence-shape
    const corrElements: Array<{
      kind: string;
      id: string;
      corrs: import('../types/Correspondence').Correspondence[];
    }> = [];
    const collect = (
      kind: string,
      items: ReadonlyArray<{
        id: string;
        correspondences?: import('../types/Correspondence').Correspondence[];
      }>,
    ) => {
      for (const it of items ?? []) {
        if (it.correspondences && it.correspondences.length > 0) {
          corrElements.push({ kind, id: it.id, corrs: it.correspondences });
        }
      }
    };
    collect('dataspace', dataspaces);
    collect('policy', policies);
    collect('instrument', standard.instruments ?? []);
    collect('attribute_definition', standard.attributeDefinitions ?? []);
    collect('capability', standard.capabilities ?? []);
    collect('behavior', standard.behaviors ?? []);
    collect('requirement', standard.requirements ?? []);
    collect('conformance_test', standard.conformanceTests ?? []);
    collect('form', standard.forms ?? []);
    collect('table', standard.tables ?? []);
    collect('symbol', standard.symbols ?? []);
    collect('calculation', standard.calculations ?? []);
    collect('term', standard.terms ?? []);
    collect('artifact_definition', standard.artifactDefinitions ?? []);
    collect('verdict', standard.verdicts ?? []);
    collect('reference_material', standard.referenceMaterials ?? []);
    collect('test_point_set', standard.testPointSets ?? []);
    collect('competence_kind', standard.competenceKinds ?? []);
    collect('constraint', standard.constraints ?? []);
    collect('test_sequence', standard.testSequences ?? []);
    collect('process', standard.processes ?? []);
    for (const f of standard.forms ?? []) {
      for (const fld of f.fields ?? []) {
        if (fld.correspondences && fld.correspondences.length > 0) {
          corrElements.push({
            kind: 'field',
            id: `${f.id}.${fld.name}`,
            corrs: fld.correspondences,
          });
        }
      }
    }
    if (standard.packageManifest?.correspondences?.length) {
      corrElements.push({
        kind: 'package',
        id: standard.packageManifest.id,
        corrs: standard.packageManifest.correspondences,
      });
    }
    for (const el of corrElements) {
      const byScheme = new Map<string, number>();
      for (const c of el.corrs) {
        byScheme.set(c.scheme, (byScheme.get(c.scheme) ?? 0) + 1);
        if (c.scheme === '' || c.concept === '') {
          err(
            'C108',
            `${el.kind} ${el.id}: a corresponds entry carries an empty scheme or concept — the entry names its scheme and the scheme's concept identifier (correspondence-shape)`,
          );
        }
      }
      for (const [scheme, n] of byScheme) {
        if (n > 1) {
          err(
            'C108',
            `${el.kind} ${el.id}: ${n} corresponds entries name scheme "${scheme}" — one element has at most one correspondence per scheme, so every bridge reads an unambiguous mapping (correspondence-shape)`,
          );
        }
      }
    }
    // The irdi legacy spelling agrees with `corresponds iec-cdd` when both
    // are present on one attribute definition.
    for (const a of standard.attributeDefinitions ?? []) {
      if (a.irdi && a.irdi !== '') {
        const cdd = (a.correspondences ?? []).find(c => c.scheme === 'iec-cdd');
        if (cdd && cdd.concept !== a.irdi) {
          warn(
            'C108',
            `attribute_definition ${a.id}: irdi "${a.irdi}" disagrees with corresponds iec-cdd "${cdd.concept}" — the legacy single-scheme spelling and the generalized annotation name the same concept, or the irdi facet retires (correspondence-shape)`,
          );
        }
      }
    }
  }
}
