// ─────────────────────────────────────────────────────────────────────
// The evaluation-registers family (C134–C142, smart TODO.roadmap/40
// batches 3+5, the packages-as-SSOT epic): the evaluation-side
// registers — evaluation_dimensions (C134), evaluation_profiles (C135),
// certificate_templates (C136; C137 is RESERVED — the workflow_config
// construct retired in phase 6), verification_pathways (C138), the
// selection rules (C139),
// test_report_skeletons (C140), test_report_checklists (C141), and the
// exclusive gateways' routing cascade (C142). Per-register gating
// throughout (the C58 doctrine): a resolve leg runs only when its
// target register is in composition scope; parse-enforced vocabularies
// carry no check legs; opaque predicates stay unresolved (the R26
// field-resolution precedent).
//
// THE FAMILY-MODULE PATTERN (the check.ts decomposition, one family
// at a time): the family takes the context record it actually uses —
// `standard`, the precomputed id sets it reads, the two emit closures
// — and nothing else. The bodies move verbatim from check.ts; the
// compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import type Standard from '../types/Standard';

export interface EvaluationRegistersContext {
  standard: Standard;
  attrIds: Set<string>;
  dimIds: Map<string, Set<string> | null>;
  testIds: Set<string>;
  reqIds: Set<string>;
  err: (check: string, message: string) => void;
  warn: (check: string, message: string) => void;
}

export function runEvaluationRegistersFamily({
  standard,
  attrIds,
  dimIds,
  testIds,
  reqIds,
  err,
  warn,
}: EvaluationRegistersContext): void {
  // ── C134: evaluation-dimension-references (smart TODO.roadmap/40 ────
  // batch 3; the packages-as-SSOT epic) ────────────────────────────────
  // The form-facing classification field schema: the enum facet resolves
  // to a declared classification dimension (error, per-register gated),
  // and the field NAME resolves to an is_dimension attribute_definition
  // OR a dimension id — the two coexisting conventions (owner decision:
  // r129's legacy camelCase names carry as-is), a WARNING when neither
  // (gated on the registers composing). The type/setting vocabularies
  // are parse-enforced upstream (no check legs).
  {
    const dimensionedAttrIds = new Set(
      (standard.attributeDefinitions ?? [])
        .filter(a => a.isDimension === true)
        .map(a => a.id),
    );
    for (const ed of standard.evaluationDimensions ?? []) {
      for (const f of ed.fields ?? []) {
        const where = `evaluation_dimensions ${ed.id}: field ${f.id}`;
        if (f.enumRef && dimIds.size > 0 && !dimIds.has(f.enumRef)) {
          err(
            'C134',
            `${where}: enum "${f.enumRef}" is not a declared classification dimension (evaluation-dimension-references)`,
          );
        }
        if (
          (dimensionedAttrIds.size > 0 || dimIds.size > 0) &&
          !dimensionedAttrIds.has(f.id) &&
          !dimIds.has(f.id)
        ) {
          warn(
            'C134',
            `${where}: the field name "${f.id}" resolves to neither an is_dimension attribute_definition nor a classification dimension — the legacy camelCase convention (evaluation-dimension-references)`,
          );
        }
      }
    }
  }

  // ── C135: evaluation-profile-coherence (smart TODO.roadmap/40 ───────
  // batch 3; the packages-as-SSOT epic) ────────────────────────────────
  // The named dimension-value presets: every dimensions key resolves to
  // a declared classification dimension and every value to one of that
  // dimension's declared values (per-register gated, the smart R4/R8
  // applicability mirror; an OPEN dimension — no declared value set —
  // accepts any value). A set-cardinality dimension's preset is a value
  // LIST (r144's measurand_components) — each entry resolves.
  {
    for (const p of standard.evaluationProfiles ?? []) {
      const where = `evaluation_profile ${p.id}`;
      for (const [dim, value] of Object.entries(p.dimensions ?? {})) {
        if (dimIds.size > 0 && !dimIds.has(dim)) {
          err(
            'C135',
            `${where}: dimensions key "${dim}" is not a declared classification dimension (evaluation-profile-coherence)`,
          );
          continue;
        }
        const values = dimIds.get(dim);
        for (const v of Array.isArray(value) ? value : [value]) {
          if (values && values.size > 0 && !values.has(v)) {
            err(
              'C135',
              `${where}: dimensions entry "${dim}" names value "${v}", which the dimension does not declare (evaluation-profile-coherence)`,
            );
          }
        }
      }
    }
  }

  // ── C136: certificate-template-references (smart TODO.roadmap/40 ────
  // batch 3; the packages-as-SSOT epic) ────────────────────────────────
  // The certificate rendering contract: the dimension_labels pattern
  // placeholders ({dim} / {dim:sep}) resolve to declared classification
  // dimensions (error, per-register gated); the characteristic bindings
  // resolve (attribute/attributes → attribute_definitions, dimension →
  // classification dimensions, per-register gated) with the XOR shape
  // leg (≤ 1 of attribute | attributes | dimension — none is the
  // statement row); the characteristic type carries the renderer-driven
  // closed vocabulary (string | integer | number | quantity |
  // statement) at ERROR (the owner-settled decision — parse stays
  // total against renderer growth); the number_format placeholders
  // check against the known token vocabulary at WARNING (open for
  // program-specific prefixes like twin-cert's literal TW-1).
  {
    const CERTIFICATE_NUMBER_TOKENS = new Set([
      'shortName',
      'edition',
      'scheme',
      'authority',
      'year2',
      'seq',
    ]);
    const CERTIFICATE_CHARACTERISTIC_TYPES = new Set([
      'string',
      'integer',
      'number',
      'quantity',
      'statement',
    ]);
    const placeholderRe = /\{([^{}:/]+)(?::[^{}]*)?\}/g;
    for (const t of standard.certificateTemplates ?? []) {
      const where = `certificate_template ${t.id}`;
      if (t.numberFormat) {
        let m: RegExpExecArray | null;
        while ((m = placeholderRe.exec(t.numberFormat)) !== null) {
          if (!CERTIFICATE_NUMBER_TOKENS.has(m[1]!)) {
            warn(
              'C136',
              `${where}: number_format placeholder "{${m[1]}}" is not a known token (${[...CERTIFICATE_NUMBER_TOKENS].join(', ')}) — a program-specific spelling (certificate-template-references)`,
            );
          }
        }
      }
      if (t.dimensionLabels && dimIds.size > 0) {
        let m: RegExpExecArray | null;
        while ((m = placeholderRe.exec(t.dimensionLabels.pattern)) !== null) {
          if (!dimIds.has(m[1]!)) {
            err(
              'C136',
              `${where}: dimension_labels placeholder "{${m[1]}}" is not a declared classification dimension (certificate-template-references)`,
            );
          }
        }
      }
      for (const c of t.characteristics ?? []) {
        const cwhere = `${where}: characteristic ${c.id}`;
        if (c.type && !CERTIFICATE_CHARACTERISTIC_TYPES.has(c.type)) {
          err(
            'C136',
            `${cwhere}: type "${c.type}" is outside the renderer vocabulary (string, integer, number, quantity, statement) (certificate-template-references)`,
          );
        }
        const bindings =
          (c.attribute ? 1 : 0) +
          (c.attributes.length > 0 ? 1 : 0) +
          (c.dimension ? 1 : 0);
        if (bindings > 1) {
          err(
            'C136',
            `${cwhere}: carries ${bindings} content bindings — the XOR is attribute | attributes | dimension | none (certificate-template-references)`,
          );
        }
        if (c.attribute && attrIds.size > 0 && !attrIds.has(c.attribute)) {
          err(
            'C136',
            `${cwhere}: attribute "${c.attribute}" is not a declared attribute_definition (certificate-template-references)`,
          );
        }
        for (const a of c.attributes) {
          if (attrIds.size > 0 && !attrIds.has(a)) {
            err(
              'C136',
              `${cwhere}: attributes entry "${a}" is not a declared attribute_definition (certificate-template-references)`,
            );
          }
        }
        if (c.dimension && dimIds.size > 0 && !dimIds.has(c.dimension)) {
          err(
            'C136',
            `${cwhere}: dimension "${c.dimension}" is not a declared classification dimension (certificate-template-references)`,
          );
        }
      }
    }
  }

  // C137 is RESERVED (the workflow_config construct retired in phase 6;
  // the catalog carries the id, no leg runs).

  // ── C138: verification-pathway-references (smart TODO.roadmap/40 ───
  // batch 3; the packages-as-SSOT epic) ────────────────────────────────
  // The verification pathways beyond type evaluation: the tests resolve
  // to conformance_tests and the assessment covers to requirements
  // (per-register gated — the smart R22 mirror); the trigger action
  // resolves to a transition action of an in-scope LIFECYCLE
  // state_machine (gated); the trigger event is required iff kind
  // signal; the validity window carries ≥ 1 of years/months. The kind /
  // trigger-kind / limits-mode vocabularies are parse-enforced upstream
  // (no check legs).
  {
    const lifecycleActions = new Set<string>();
    for (const sm of standard.stateMachines ?? []) {
      if (sm.kind !== 'lifecycle') {
        continue;
      }
      for (const t of sm.transitions ?? []) {
        if (t.actionName) {
          lifecycleActions.add(t.actionName);
        }
      }
    }
    for (const p of standard.verificationPathways ?? []) {
      const where = `verification_pathway ${p.id}`;
      for (const t of p.tests ?? []) {
        if (testIds.size > 0 && !testIds.has(t)) {
          err(
            'C138',
            `${where}: tests entry "${t}" is not a declared conformance_test (verification-pathway-references)`,
          );
        }
      }
      for (const r of p.assessment?.covers ?? []) {
        if (reqIds.size > 0 && !reqIds.has(r)) {
          err(
            'C138',
            `${where}: assessment covers entry "${r}" is not a declared requirement (verification-pathway-references)`,
          );
        }
      }
      const window = p.validity?.window;
      if (window && window.years <= 0 && window.months <= 0) {
        err(
          'C138',
          `${where}: the validity window carries neither years nor months (verification-pathway-references)`,
        );
      }
      for (const t of p.validity?.triggers ?? []) {
        const twhere = `${where}: trigger ${t.id}`;
        if (t.kind === 'signal' && !t.event) {
          err(
            'C138',
            `${twhere}: kind signal requires the event facet (verification-pathway-references)`,
          );
        }
        if (t.kind === 'timer' && t.event) {
          err(
            'C138',
            `${twhere}: kind timer carries no event facet — the period is the window's (verification-pathway-references)`,
          );
        }
        if (
          t.action &&
          lifecycleActions.size > 0 &&
          !lifecycleActions.has(t.action)
        ) {
          err(
            'C138',
            `${twhere}: action "${t.action}" is not a transition action of an in-scope lifecycle state_machine (verification-pathway-references)`,
          );
        }
      }
    }
  }

  // ── C139: selection-rule-references (smart TODO.roadmap/40 ─────────
  // batch 3; the packages-as-SSOT epic) ────────────────────────────────
  // The selection rules: the lab criterion's applies_when/match
  // model_field resolve against the attribute OR dimension registers
  // (the two coexisting conventions — gated on either register
  // composing); the match operator's conditional facets hold
  // (has_capability ⇒ required_capability; capability_from_field /
  // capability_covers_value / capability_prefix_match ⇒
  // required_capability_prefix + model_field; always_pass ⇒ nothing
  // else); the capability strings are free-form lab-side labels —
  // never resolved. The sample/governance entries carry shape legs
  // only (rule / rationale / applicability non-empty). The vocabularies
  // are parse-enforced upstream (no check legs).
  {
    const fieldResolvable = (f: string): boolean =>
      attrIds.has(f) || dimIds.has(f);
    const fieldRegistersCompose = attrIds.size > 0 || dimIds.size > 0;
    for (const c of standard.labSelectionCriteria ?? []) {
      const where = `lab_selection_criterion ${c.id}`;
      if (
        c.appliesWhen?.modelField &&
        fieldRegistersCompose &&
        !fieldResolvable(c.appliesWhen.modelField)
      ) {
        err(
          'C139',
          `${where}: applies_when model_field "${c.appliesWhen.modelField}" resolves to neither an attribute_definition nor a classification dimension (selection-rule-references)`,
        );
      }
      const m = c.match;
      if (m) {
        if (
          m.modelField &&
          fieldRegistersCompose &&
          !fieldResolvable(m.modelField)
        ) {
          err(
            'C139',
            `${where}: match model_field "${m.modelField}" resolves to neither an attribute_definition nor a classification dimension (selection-rule-references)`,
          );
        }
        if (m.operator === 'has_capability' && !m.requiredCapability) {
          err(
            'C139',
            `${where}: operator has_capability requires the required_capability facet (selection-rule-references)`,
          );
        }
        if (
          (m.operator === 'capability_from_field' ||
            m.operator === 'capability_covers_value' ||
            m.operator === 'capability_prefix_match') &&
          (!m.requiredCapabilityPrefix || !m.modelField)
        ) {
          err(
            'C139',
            `${where}: operator ${m.operator} requires required_capability_prefix and model_field (selection-rule-references)`,
          );
        }
        if (
          m.operator === 'always_pass' &&
          (m.requiredCapability ||
            m.requiredCapabilityPrefix ||
            m.modelField ||
            m.labCapabilityPrefix)
        ) {
          err(
            'C139',
            `${where}: operator always_pass carries no other match facet (selection-rule-references)`,
          );
        }
      }
    }
    for (const r of standard.sampleSelectionRules ?? []) {
      const where = `sample_selection_rule ${r.id}`;
      for (const [facet, v] of [
        ['rule', r.rule],
        ['rationale', r.rationale],
        ['applicability', r.applicability],
      ] as const) {
        if (!v) {
          err(
            'C139',
            `${where}: the ${facet} facet is required (selection-rule-references)`,
          );
        }
      }
    }
    for (const r of standard.specimenGovernanceRules ?? []) {
      const where = `specimen_governance_rule ${r.id}`;
      for (const [facet, v] of [
        ['rule', r.rule],
        ['rationale', r.rationale],
        ['applicability', r.applicability],
      ] as const) {
        if (!v) {
          err(
            'C139',
            `${where}: the ${facet} facet is required (selection-rule-references)`,
          );
        }
      }
    }
  }

  // ── C140: test-report-skeleton-references (smart TODO.roadmap/40 ───
  // batch 3; the packages-as-SSOT epic) ────────────────────────────────
  // The evaluation-report structure: the form entry id resolves to a
  // declared form, the conformance_test facet to a conformance_test, the
  // requirements to requirements (all per-register gated — the smart
  // R29/R35 mirrors); a conditional form carries its inclusion rule
  // (applicability) or a documentary note (warning). The required
  // vocabulary is parse-enforced upstream (no check leg).
  {
    const formIds = new Set((standard.forms ?? []).map(f => f.id));
    const checkFormEntries = (
      where: string,
      entries: {
        id: string;
        conformanceTest: string;
        requirements: string[];
        required: string;
        applicability: unknown[];
        notes: string;
      }[],
    ) => {
      for (const f of entries) {
        const fwhere = `${where}: form ${f.id}`;
        if (formIds.size > 0 && !formIds.has(f.id)) {
          err(
            'C140',
            `${fwhere}: the entry id is not a declared form (test-report-skeleton-references)`,
          );
        }
        if (
          f.conformanceTest &&
          testIds.size > 0 &&
          !testIds.has(f.conformanceTest)
        ) {
          err(
            'C140',
            `${fwhere}: conformance_test "${f.conformanceTest}" is not a declared conformance_test (test-report-skeleton-references)`,
          );
        }
        for (const r of f.requirements) {
          if (reqIds.size > 0 && !reqIds.has(r)) {
            err(
              'C140',
              `${fwhere}: requirements entry "${r}" is not a declared requirement (test-report-skeleton-references)`,
            );
          }
        }
        if (
          f.required === 'conditional' &&
          f.applicability.length === 0 &&
          !f.notes
        ) {
          warn(
            'C140',
            `${fwhere}: required conditional carries neither applicability nor notes — the inclusion rule is undocumented (test-report-skeleton-references)`,
          );
        }
      }
    };
    for (const s of standard.testReportSkeletons ?? []) {
      for (const section of s.sections ?? []) {
        const where = `test_report_skeleton ${s.id}: section ${section.id}`;
        checkFormEntries(where, section.forms ?? []);
        for (const sub of section.subsections ?? []) {
          checkFormEntries(
            `${where}: subsection "${sub.title}"`,
            sub.forms ?? [],
          );
        }
      }
    }
  }

  // ── C141: checklist-entry-shape (smart TODO.roadmap/40 batch 3; ────
  // the packages-as-SSOT epic) ─────────────────────────────────────────
  // The OIML-CS test-report checklist (PD-05 §4.4.3): the element
  // letter rides the a–r vocabulary at WARNING (check-time, never
  // parse-enforced — the element count can grow); the entry ids are
  // unique per checklist; the overlay orphan-entry leg fires at
  // COMPOSITION (the package.ts merge loop reports
  // orphan-overlay-entry, surfaced under this rule above). The
  // obligation vocabulary is parse-enforced upstream; the
  // source/validation strings are engine expressions — documentary,
  // never resolved.
  {
    for (const c of standard.testReportChecklists ?? []) {
      const where = `test_report_checklist ${c.id}`;
      const seen = new Set<string>();
      for (const e of c.entries ?? []) {
        if (seen.has(e.id)) {
          err(
            'C141',
            `${where}: entry "${e.id}" is declared twice (checklist-entry-shape)`,
          );
        }
        seen.add(e.id);
        if (e.element !== null && !/^[a-r]$/.test(e.element)) {
          warn(
            'C141',
            `${where}: entry "${e.id}" element "${e.element}" is outside the PD-05 §4.4.3 vocabulary (a–r) — the element count can grow, confirm the extension (checklist-entry-shape)`,
          );
        }
      }
    }
  }

  // ── C142: gateway-edges-resolve (smart TODO.roadmap/40 batch 5; ────
  // the packages-as-SSOT epic) ─────────────────────────────────────────
  // The workflow routing cascade: every edge target resolves to a
  // declared process (per-register gated — the smart R-rule mirrors);
  // a gateway carrying edges declares exactly ONE default-conditioned
  // edge (the first-match-wins cascade needs its catch-all), and the
  // default edge is RECOMMENDED last (a mid-list default shadows the
  // edges after it — WARNING, not error: the YAML lineage carries
  // mid-list defaults). The conditions stay opaque strings — never
  // resolved (the R26 field-resolution precedent). The edge-less
  // gateway (a label-only declaration) carries no routing, so the
  // default discipline skips it.
  {
    const gwProcessIds = new Set((standard.processes ?? []).map(p => p.id));
    for (const g of standard.gateways ?? []) {
      if (g.gatewayType !== 'exclusive_gateway') {
        continue;
      }
      const edges =
        (g as { edges?: { target: string; condition: string }[] }).edges ?? [];
      const where = `exclusive_gateway ${g.id}`;
      // The exhaustive gateway's dead-route leg: the conditions cover
      // the dimension domain, so a declared default can never fire.
      if (
        (g as { exhaustive?: boolean }).exhaustive &&
        edges.some(e => e.condition === 'default')
      ) {
        err(
          'C142',
          `${where}: declares a default edge but the conditions are exhaustive — the catch-all can never fire (gateway-edges-resolve)`,
        );
      }
      edges.forEach((e, i) => {
        if (gwProcessIds.size > 0 && !gwProcessIds.has(e.target)) {
          err(
            'C142',
            `${where}: edge ${i + 1} targets "${e.target}", which is not a declared process (gateway-edges-resolve)`,
          );
        }
      });
      if (edges.length > 0 && !(g as { exhaustive?: boolean }).exhaustive) {
        const defaults = edges
          .map((e, i) => ({ e, i }))
          .filter(x => x.e.condition === 'default');
        if (defaults.length === 0) {
          err(
            'C142',
            `${where}: no default edge — the first-match-wins cascade needs its catch-all (gateway-edges-resolve)`,
          );
        } else if (defaults.length > 1) {
          err(
            'C142',
            `${where}: ${defaults.length} default edges — exactly one catch-all is allowed (gateway-edges-resolve)`,
          );
        } else if (defaults[0]!.i !== edges.length - 1) {
          warn(
            'C142',
            `${where}: the default edge is not last — it shadows the edges after it in the first-match-wins cascade (gateway-edges-resolve)`,
          );
        }
      }
    }
  }
}
