// ─────────────────────────────────────────────────────────────────────
// The registers family (C58 activity-kind, C190 capability-parameters,
// C120 framework-references, C59 segregation-members, C121
// abstract-process-references, C84 constraint-shape): the register
// reference-resolution plane — every register's members and parameters
// resolve, the framework/abstract-process references resolve, and the
// constraint's check evaluates to a boolean. The region moves verbatim
// from check.ts; the compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import type { ProcessGateWindow } from '../types/process';
import type Standard from '../types/Standard';

export interface RegistersContext {
  standard: Standard;
  err: (check: string, message: string) => void;
}

export function runRegistersFamily({ standard, err }: RegistersContext): void {
  // ── C58: activity-kind-resolves (TODO.roadmap/39) ─────────────────
  // A process's `activity_kind { … }` classifies it against the ISO/IEC
  // 17000 functional-approach activity taxonomy (selection; determination
  // — testing/inspection/audit/validation/verification/peer assessment;
  // review; decision; attestation — declaration/certification/
  // accreditation; surveillance …). Classification, not inheritance —
  // multi-kind is deliberate (ISO/IEC 17065 §7.4 "evaluation" = selection
  // + determination). Every tagged kind must resolve against a declared
  // activity_archetype register WHEN ONE IS IN SCOPE (composed via uses);
  // the rule stays silent in a register-less package — classification is
  // opt-in and a register-less tree cannot adjudicate. The register's own
  // `parent` references must likewise resolve to declared archetypes.
  // Mirror of the OIML SMART linker's R23 activity-kind-resolves.
  const activityArchetypeIds = new Set(
    (standard.activityArchetypes ?? []).map(a => a.id),
  );
  if (activityArchetypeIds.size > 0) {
    // The register's own parent references resolve within the register.
    for (const a of standard.activityArchetypes ?? []) {
      if (a.parent !== '' && !activityArchetypeIds.has(a.parent)) {
        err(
          'C58',
          `activity_archetype ${a.id}: parent "${a.parent}" is not a declared activity archetype (activity-kind-resolves)`,
        );
      }
    }
    for (const p of standard.processes ?? []) {
      for (const kind of p.activityKinds ?? []) {
        if (!activityArchetypeIds.has(kind)) {
          err(
            'C58',
            `process ${p.id}: activity_kind "${kind}" is not a declared activity archetype (activity-kind-resolves)`,
          );
        }
      }
    }
  }

  // ── C190: capability-parameters-resolve (TODO.lang-gaps/04, the ────
  // datum unification's first rung) ───────────────────────────────────
  // A capability's `has_parameters` members name the composition-scoped
  // plane of the datum substrate ([[datum-unification]], spec#87): the
  // four plane carriers are ALIAS spellings of the one "named, typed,
  // unit-ed value" primitive. Every member resolves to a declared datum
  // or to a declared attribute_definition — the legacy alias spelling
  // the unification folds into the datum (the attribute_definition
  // carrier migrates in wave 04 PR 4). Inline `datum <id> { … }` entries
  // resolve by construction: the parser registers them in the datum
  // register. Resolution by full id (the corpus census: every resolving
  // member is a full-id match); mirror of the C58 resolution shape.
  {
    const capabilityDatumIds = new Set((standard.datums ?? []).map(d => d.id));
    const capabilityAttrIds = new Set(
      (standard.attributeDefinitions ?? []).map(a => a.id),
    );
    for (const c of standard.capabilities ?? []) {
      for (const p of c.hasParameters ?? []) {
        if (!capabilityDatumIds.has(p) && !capabilityAttrIds.has(p)) {
          err(
            'C190',
            `capability ${c.id}: has_parameters "${p}" is not a declared datum or attribute_definition (capability-parameters-resolve)`,
          );
        }
      }
    }
  }

  // ── C120: framework-references-resolve (smart TODO.roadmap/40; the ──
  // packages-as-SSOT epic) ────────────────────────────────────────────
  // The certification-framework registers cross-reference each other:
  // participant_kind approval organs and declaration edges, the organs'
  // own sub-committee/independence edges, declaration holder + gate
  // edges, scheme-lifecycle organ edges and the entry's conditions_ref,
  // framework_document approving organs, and decision_rule organ +
  // exemption edges. Every such edge must resolve against the composed
  // registers WHEN the target register is in scope (composed via uses) —
  // per-register gating, the C58 doctrine: a package carrying only some
  // of the framework registers (a scheme-side package mid-migration)
  // cannot adjudicate the rest. Mirror of the OIML SMART linker's R25
  // framework-references.
  const organIds = new Set((standard.governanceOrgans ?? []).map(o => o.id));
  const kindIds = new Set((standard.participantKinds ?? []).map(k => k.id));
  const declIds = new Set((standard.declarationKinds ?? []).map(d => d.id));
  const frameworkProcessIds = new Set(
    (standard.processes ?? []).map(p => p.id),
  );
  const resolveOrgan = (where: string, facet: string, id: string) => {
    if (organIds.size > 0 && id !== '' && !organIds.has(id)) {
      err(
        'C120',
        `${where}: ${facet} "${id}" is not a declared governance organ (framework-references-resolve)`,
      );
    }
  };
  const resolveKind = (where: string, facet: string, id: string) => {
    if (kindIds.size > 0 && id !== '' && !kindIds.has(id)) {
      err(
        'C120',
        `${where}: ${facet} "${id}" is not a declared participant kind (framework-references-resolve)`,
      );
    }
  };
  const resolveDeclaration = (where: string, facet: string, id: string) => {
    if (declIds.size > 0 && id !== '' && !declIds.has(id)) {
      err(
        'C120',
        `${where}: ${facet} "${id}" is not a declared declaration kind (framework-references-resolve)`,
      );
    }
  };
  for (const o of standard.governanceOrgans ?? []) {
    resolveOrgan(
      `governance_organ ${o.id}`,
      'sub_committee_of',
      o.sub_committee_of,
    );
    resolveOrgan(
      `governance_organ ${o.id}`,
      'independent_of',
      o.independent_of,
    );
  }
  for (const k of standard.participantKinds ?? []) {
    const where = `participant_kind ${k.id}`;
    resolveOrgan(where, 'approved_by', k.approved_by);
    resolveKind(where, 'designated_by', k.designated_by);
    resolveKind(where, 'becomes', k.becomes);
    resolveDeclaration(where, 'declaration', k.declaration);
    if (k.approval) {
      resolveOrgan(where, 'approval.decided_by', k.approval.decided_by);
      resolveOrgan(
        where,
        'approval.on_recommendation_of',
        k.approval.on_recommendation_of,
      );
    }
  }
  for (const d of standard.declarationKinds ?? []) {
    resolveKind(`declaration_kind ${d.id}`, 'holder', d.holder);
  }
  for (const g of standard.declarationGates ?? []) {
    const where = `declaration_gate ${g.id}`;
    resolveKind(where, 'holder', g.holder);
    resolveDeclaration(where, 'declaration', g.declaration);
    if (frameworkProcessIds.size > 0) {
      for (const b of g.blocks) {
        if (!frameworkProcessIds.has(b)) {
          err(
            'C120',
            `${where}: blocks "${b}" is not a declared process (framework-references-resolve)`,
          );
        }
      }
    }
  }
  for (const l of standard.schemeLifecycles ?? []) {
    const where = `scheme_lifecycle ${l.id}`;
    const actionIds = new Set(l.transitions.map(t => t.action));
    for (const t of l.transitions) {
      resolveOrgan(
        `${where} transition ${t.action}`,
        'decided_by',
        t.decided_by,
      );
      resolveOrgan(
        `${where} transition ${t.action}`,
        'on_proposal_of',
        t.on_proposal_of,
      );
    }
    for (const tr of l.triggers) {
      if (tr.action !== '' && !actionIds.has(tr.action)) {
        err(
          'C120',
          `${where}: trigger ${tr.id} fires action "${tr.action}", which no transition of the machine declares (framework-references-resolve)`,
        );
      }
    }
  }
  for (const d of standard.frameworkDocuments ?? []) {
    resolveOrgan(`framework_document ${d.id}`, 'approved_by', d.approved_by);
  }
  for (const r of standard.decisionRules ?? []) {
    const where = `decision_rule ${r.id}`;
    resolveOrgan(where, 'organ', r.organ);
    resolveOrgan(where, 'on_recommendation_of', r.on_recommendation_of);
    resolveOrgan(where, 'independent_of', r.independent_of);
    for (const k of r.no_entrance_fees_for) {
      resolveKind(where, 'no_entrance_fees_for', k);
    }
  }

  // ── C59: segregation-members-resolve (TODO.roadmap/39b) ────────────
  // A process's `segregation { constraint … }` declares the ISO/IEC 17065
  // role-segregation constraints as first-class structure (7.5.1 reviewer
  // ∉ evaluation, 7.6.2 decider ∉ evaluation, 7.13.5 complaint resolution
  // ∉ case activities, 7.13.6/4.2.10 consultancy bars). Well-formedness:
  // (a) every pair member resolves to a declared process id or the
  // reserved `case_personnel` token (the personnel involved in the
  // certification activities of the case a complaint relates to); (b) the
  // two members are distinct; (c) the owning process is a member of its
  // own pair; (d) the kind is declared. Pair members are process ids,
  // never roles — a scheme may bind one role to evaluation, review AND
  // decision, so the norms quantify over process involvement. Per-
  // assignment runtime enforcement is the platform's business (task 44).
  // The kind-conditional shape (smart TODO.roadmap/40 batch 2 — the YAML
  // schema's allOf discipline, data/schemas/abstract-processes.yaml): a
  // case_personnel_disjoint constraint is ONLY a pair (no period, no
  // barred relations); a consultancy_bar is ONLY a barred-relations list
  // with an optional period (never a pair).
  // Mirror of the OIML SMART linker's R24 abstract-process-segregation.
  {
    const SEGREGATION_CASE_PERSONNEL = 'case_personnel';
    const segregationProcessIds = new Set(
      (standard.processes ?? []).map(p => p.id),
    );
    for (const p of standard.processes ?? []) {
      for (const s of p.segregation ?? []) {
        if (
          s.kind !== 'case_personnel_disjoint' &&
          s.kind !== 'consultancy_bar'
        ) {
          err(
            'C59',
            `process ${p.id}: segregation constraint "${s.id}" declares kind "${s.kind || '(none)'}" — valid kinds: case_personnel_disjoint, consultancy_bar (segregation-members-resolve)`,
          );
          continue;
        }
        if (s.kind === 'case_personnel_disjoint') {
          if (s.pair.length !== 2) {
            err(
              'C59',
              `process ${p.id}: segregation constraint "${s.id}" is case_personnel_disjoint but declares ${s.pair.length} pair members — exactly two are required (segregation-members-resolve)`,
            );
            continue;
          }
          if (s.period !== '' || s.barred.length > 0) {
            err(
              'C59',
              `process ${p.id}: segregation constraint "${s.id}" is case_personnel_disjoint but declares ${
                s.period !== '' ? `period "${s.period}"` : 'barred relations'
              } — a disjoint constraint is ONLY a pair; the period/barred facets belong to consultancy_bar (segregation-members-resolve)`,
            );
          }
          const [a, b] = s.pair;
          if (a === b) {
            err(
              'C59',
              `process ${p.id}: segregation constraint "${s.id}" declares "${a}" disjoint from itself — the two personnel sets must be distinct (segregation-members-resolve)`,
            );
          }
          for (const member of [a, b]) {
            if (
              member !== SEGREGATION_CASE_PERSONNEL &&
              !segregationProcessIds.has(member)
            ) {
              err(
                'C59',
                `process ${p.id}: segregation constraint "${s.id}" names pair member "${member}", which is not a declared process (nor the reserved "${SEGREGATION_CASE_PERSONNEL}" token) (segregation-members-resolve)`,
              );
            }
          }
          if (a !== p.id && b !== p.id) {
            err(
              'C59',
              `process ${p.id}: segregation constraint "${s.id}" is declared on process "${p.id}" but neither pair member is "${p.id}" — the constrained process owns its segregation constraints (segregation-members-resolve)`,
            );
          }
        } else {
          // consultancy_bar — the barred client relations are REQUIRED
          // (a bar that bars nothing is no bar); the pair is the disjoint
          // kind's shape and never appears here; the period is optional
          // (4.2.10 body-specified vs 7.13.6 fixed P2Y).
          if (s.barred.length === 0) {
            err(
              'C59',
              `process ${p.id}: segregation constraint "${s.id}" is consultancy_bar but bars no client relation — the barred list is required (segregation-members-resolve)`,
            );
          }
          if (s.pair.length > 0) {
            err(
              'C59',
              `process ${p.id}: segregation constraint "${s.id}" is consultancy_bar but declares a pair — the pair is the case_personnel_disjoint shape; a bar carries barred relations and an optional period only (segregation-members-resolve)`,
            );
          }
        }
      }
    }
  }

  // ── C121: abstract-process-references-resolve (smart TODO.roadmap/40 ──
  // batch 2; the packages-as-SSOT epic) ───────────────────────────────
  // The abstract-process model's framework bindings resolve against the
  // composed registers: the role binding list, the organ and participant
  // kind facets, the decision rule, the declaration kind (plus the sign |
  // update action vocabulary), the discharged declaration gates (the
  // gate facet's discharge entries — TODO.lang-spec/07), the realizing
  // processes and the authorizing approvals; the calendar windows' shape
  // legs (the max_elapsed | min_elapsed kind vocabulary; exactly one of
  // years/months — the scheme_lifecycle duration sub-grammar) are
  // register-free. The process_model's sequence members
  // (→ process) and register maintainers (→ governance_organ) ride the
  // same rule. Per-register gating (the C58 doctrine): an edge is checked
  // only when its target register is in composition scope. The windows'
  // anchor/applies_to FIELD resolution stays consumer-side (the R26
  // precedent). Mirror of the OIML SMART linker's abstract-process
  // reference legs.
  {
    const apRoleIds = new Set((standard.roles ?? []).map(r => r.id));
    const apGateIds = new Set((standard.declarationGates ?? []).map(g => g.id));
    const apRuleIds = new Set((standard.decisionRules ?? []).map(r => r.id));
    const apApprovalIds = new Set((standard.approvals ?? []).map(a => a.id));
    // The C120 organ/kind/declaration resolvers report under C120 — the
    // abstract-process edges are C121's, so the rule carries its own
    // per-register-gated resolvers over the same composed registers.
    const resolveOrganAp = (where: string, facet: string, id: string) => {
      if (organIds.size > 0 && id !== '' && !organIds.has(id)) {
        err(
          'C121',
          `${where}: ${facet} "${id}" is not a declared governance organ (abstract-process-references-resolve)`,
        );
      }
    };
    const resolveKindAp = (where: string, facet: string, id: string) => {
      if (kindIds.size > 0 && id !== '' && !kindIds.has(id)) {
        err(
          'C121',
          `${where}: ${facet} "${id}" is not a declared participant kind (abstract-process-references-resolve)`,
        );
      }
    };
    const resolveDeclarationAp = (where: string, facet: string, id: string) => {
      if (declIds.size > 0 && id !== '' && !declIds.has(id)) {
        err(
          'C121',
          `${where}: ${facet} "${id}" is not a declared declaration kind (abstract-process-references-resolve)`,
        );
      }
    };
    const resolveProcessRef = (where: string, facet: string, id: string) => {
      if (frameworkProcessIds.size > 0 && !frameworkProcessIds.has(id)) {
        err(
          'C121',
          `${where}: ${facet} "${id}" is not a declared process (abstract-process-references-resolve)`,
        );
      }
    };
    for (const p of standard.processes ?? []) {
      const where = `process ${p.id}`;
      if (apRoleIds.size > 0) {
        for (const r of p.roles ?? []) {
          if (!apRoleIds.has(r)) {
            err(
              'C121',
              `${where}: roles "${r}" is not a declared role (abstract-process-references-resolve)`,
            );
          }
        }
      }
      for (const o of p.organs ?? []) {
        resolveOrganAp(where, 'organs', o);
      }
      for (const k of p.participantKinds ?? []) {
        resolveKindAp(where, 'participant_kinds', k);
      }
      if (p.decision) {
        if (p.decision.rule === '') {
          err(
            'C121',
            `${where}: the decision facet declares no rule — a decision names the decision_rule it applies (abstract-process-references-resolve)`,
          );
        } else if (apRuleIds.size > 0 && !apRuleIds.has(p.decision.rule)) {
          err(
            'C121',
            `${where}: decision.rule "${p.decision.rule}" is not a declared decision rule (abstract-process-references-resolve)`,
          );
        }
      }
      if (p.declaration) {
        if (p.declaration.kind === '') {
          err(
            'C121',
            `${where}: the declaration facet declares no kind — a declaration names the declaration_kind it signs or updates (abstract-process-references-resolve)`,
          );
        } else {
          resolveDeclarationAp(where, 'declaration.kind', p.declaration.kind);
        }
        if (
          p.declaration.action !== 'sign' &&
          p.declaration.action !== 'update'
        ) {
          err(
            'C121',
            `${where}: declaration action "${p.declaration.action || '(none)'}" — a declaration is signed or updated (valid: sign, update) (abstract-process-references-resolve)`,
          );
        }
      }
      for (const g of p.gates ?? []) {
        if (
          g.kind === 'discharge' &&
          apGateIds.size > 0 &&
          !apGateIds.has(g.gate)
        ) {
          err(
            'C121',
            `${where}: gate discharge "${g.gate}" is not a declared declaration gate (abstract-process-references-resolve)`,
          );
        }
      }
      for (const r of p.realizedBy ?? []) {
        resolveProcessRef(where, 'realized_by', r);
      }
      if (apApprovalIds.size > 0) {
        for (const a of p.approvedBy ?? []) {
          if (!apApprovalIds.has(a)) {
            err(
              'C121',
              `${where}: approved_by "${a}" is not a declared approval (abstract-process-references-resolve)`,
            );
          }
        }
      }
      for (const w of (p.gates ?? []).filter(
        g => g.kind === 'window',
      ) as ProcessGateWindow[]) {
        const wwhere = `${where} window ${w.id}`;
        if (w.windowKind !== 'max_elapsed' && w.windowKind !== 'min_elapsed') {
          err(
            'C121',
            `${wwhere}: kind "${w.windowKind || '(none)'}" — a calendar window is a deadline or a cooling-off (valid: max_elapsed, min_elapsed) (abstract-process-references-resolve)`,
          );
        }
        if (w.windowYears > 0 === w.windowMonths > 0) {
          err(
            'C121',
            `${wwhere}: the window duration declares ${
              w.windowYears > 0
                ? 'both years and months'
                : 'neither years nor months'
            } — exactly one is required (the scheme_lifecycle window sub-grammar) (abstract-process-references-resolve)`,
          );
        }
      }
    }
  }

  // ── C84: constraint-shape (TODO.roadmap/51 — BUG.R60-SSOT gap 7) ─────
  // The subject-intrinsic constraint's DECLARATION shape — the kernel
  // mirror of the OIML SMART constraints.yaml schema
  // (data/schemas/constraints.yaml; the resolution legs stay smart-side
  // as linker rule R32 constraint-references): the stereotype is always
  // «inv» (the subject's declaration-level invariant; requirements are
  // the «req» counterpart), the check is ONE OCL boolean expression, the
  // violation_meaning is REQUIRED (the judgment records what a violation
  // means, never a bare id), and on_violation is invalid (void
  // measurement) or indeterminate (the declaration cannot be judged) —
  // never a fail. A declared source names both doc and clause (clause-URN
  // provenance). Duplicate constraint ids are the parse-time duplicate-id
  // rule (surfaced as C96), not a C84 leg.
  {
    const OCL_CHECK = /^ocl\{[\s\S]*\}$/;
    for (const c of standard.constraints ?? []) {
      if (c.stereotype !== 'inv') {
        err(
          'C84',
          `constraint ${c.id}: stereotype "${c.stereotype || '(none)'}" — a constraint is always «inv», the subject's declaration-level invariant (constraint-shape)`,
        );
      }
      if (!c.checkBound && !OCL_CHECK.test(c.check)) {
        err(
          'C84',
          `constraint ${c.id}: check is not one OCL boolean expression ocl{…} over the subject's declared anatomy (constraint-shape)`,
        );
      }
      if (!c.violationMeaning || c.violationMeaning.trim() === '') {
        err(
          'C84',
          `constraint ${c.id}: violation_meaning is required — the invalidated judgment records what the violation means, never a bare id (constraint-shape)`,
        );
      }
      if (c.onViolation !== 'invalid' && c.onViolation !== 'indeterminate') {
        err(
          'C84',
          `constraint ${c.id}: on_violation "${c.onViolation || '(none)'}" — valid: invalid (void measurement), indeterminate (the declaration cannot be judged); never a fail (constraint-shape)`,
        );
      }
      if (c.source && (!c.source.doc || !c.source.clause)) {
        err(
          'C84',
          `constraint ${c.id}: source names ${!c.source.doc ? 'no doc' : 'no clause'} — clause-URN provenance carries both doc and clause (constraint-shape)`,
        );
      }
    }
  }
}
