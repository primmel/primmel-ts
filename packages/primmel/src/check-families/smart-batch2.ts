// ─────────────────────────────────────────────────────────────────────
// The smart-batch2 family (C122 scheme-type, C123
// document-module-references, C97-C98 the certification program, C99
// the probe-channel provenance; smart TODO.roadmap/40 batch 2 +
// TODO.v2/01): the certification program's scheme self-classification,
// the document modules, the program register's maps_to legs, and the
// probe-channel provenance facet. The region moves verbatim from
// check.ts (options narrowed to the context's resolvePackage); the
// compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import { createDepManifestResolver } from './executable-plane';
import type Standard from '../types/Standard';

export interface SmartBatch2Context {
  dir: string;
  standard: Standard;
  err: (check: string, message: string) => void;
  warn: (check: string, message: string) => void;
  resolvePackage?: (id: string) => string | undefined;
}

export function runSmartBatch2Family({
  dir,
  standard,
  err,
  warn,
  resolvePackage,
}: SmartBatch2Context): void {
  const resolveDepManifest = createDepManifestResolver(dir, resolvePackage);
  const productManifest = standard.packageManifest;
  // ── C122: scheme-type-resolves (smart TODO.roadmap/40 batch 2; the ──
  // packages-as-SSOT epic) ────────────────────────────────────────────
  // The ISO/IEC 17067 register is composable: a manifest's `scheme_type`
  // token resolves against the composed scheme_type register WHEN one is
  // in scope (per-register gating, the C58 doctrine — a register-less
  // package keeps the register-free fallback, the C89 spelling
  // precedent); and a scheme_type's determination / attestation /
  // surveillance.activities entries resolve against the composed
  // scheme_activity_kind menus when THAT register is in scope. C98's
  // hard-coded no-surveillance set defers to the register's
  // surveillance.required (below, in the C97–C98 block).
  {
    const schemeTypeIds = new Set((standard.schemeTypes ?? []).map(t => t.id));
    const menuIds = new Set(
      (standard.schemeActivityKinds ?? []).map(k => k.id),
    );
    const manifestSchemeType = standard.packageManifest?.schemeType;
    if (
      schemeTypeIds.size > 0 &&
      manifestSchemeType &&
      !schemeTypeIds.has(manifestSchemeType)
    ) {
      err(
        'C122',
        `package "${standard.packageManifest!.id}": scheme_type "${manifestSchemeType}" is not a declared scheme type of the in-scope ISO/IEC 17067 register (scheme-type-resolves)`,
      );
    }
    if (menuIds.size > 0) {
      const resolveMenuEntry = (where: string, facet: string, id: string) => {
        if (!menuIds.has(id)) {
          err(
            'C122',
            `${where}: ${facet} "${id}" is not a declared scheme activity kind (scheme-type-resolves)`,
          );
        }
      };
      for (const t of standard.schemeTypes ?? []) {
        const where = `scheme_type ${t.id}`;
        for (const d of t.determination) {
          resolveMenuEntry(where, 'determination', d);
        }
        for (const a of t.attestation) {
          resolveMenuEntry(where, 'attestation', a);
        }
        for (const s of t.surveillance?.activities ?? []) {
          resolveMenuEntry(where, 'surveillance.activities', s);
        }
      }
    }
  }

  // ── C123: document-module-references-resolve (smart TODO.roadmap/40 ──
  // batch 2; the packages-as-SSOT epic) ───────────────────────────────
  // The document module's edges resolve: the sequence members against
  // the composed processes, the register maintainers against the
  // governance_organ register (per-register gating, the C58 doctrine),
  // and the declared namespace is an absolute requirement-namespace path
  // (the register-free shape leg). The informative annex's applies_to
  // names a known package — checked through the dependency-manifest
  // locator, so the leg is gated on a locator being supplied (the
  // C97-class resolution discipline; without a locator the sibling scan
  // cannot adjudicate non-sibling ids and the leg stays silent).
  {
    const dmOrganIds = new Set(
      (standard.governanceOrgans ?? []).map(o => o.id),
    );
    const dmProcessIds = new Set((standard.processes ?? []).map(p => p.id));
    for (const m of standard.documentModules ?? []) {
      const where = `document_module ${m.id}`;
      if (m.namespace !== '' && !m.namespace.startsWith('/')) {
        err(
          'C123',
          `${where}: namespace "${m.namespace}" is not an absolute requirement-namespace path (e.g. /req/cs/${m.id}) — the declared pin C119 guards must be a path (document-module-references-resolve)`,
        );
      }
      if (dmProcessIds.size > 0) {
        for (const s of m.sequence ?? []) {
          if (!dmProcessIds.has(s)) {
            err(
              'C123',
              `${where}: sequence "${s}" is not a declared process (document-module-references-resolve)`,
            );
          }
        }
      }
      if (dmOrganIds.size > 0) {
        for (const r of m.registers ?? []) {
          if (r.maintainer !== '' && !dmOrganIds.has(r.maintainer)) {
            err(
              'C123',
              `${where} register ${r.id}: maintainer "${r.maintainer}" is not a declared governance organ (document-module-references-resolve)`,
            );
          }
        }
      }
    }
    if (resolvePackage) {
      for (const a of standard.informativeAnnexes ?? []) {
        if (a.appliesTo !== '' && !resolveDepManifest(a.appliesTo)) {
          err(
            'C123',
            `informative_annex ${a.id}: applies_to "${a.appliesTo}" does not resolve to a known package — the CASCO layer the annex applies to must resolve (document-module-references-resolve)`,
          );
        }
      }
    }
  }

  // ── C97–C98: the certification program (TODO.v2/01;
  // analysis/twin-certification-design.md Q4) ──
  // A fourth publisher with the product_reference shape: the scheme
  // operator's program is related to recs and product packages by
  // MAPPING and pinned abstract imports only — composed into nothing.
  // C97: the program's maps_to register resolves (the C81-class
  // resolution discipline — the same resolveDepManifest locator/sibling
  // scan): the program maps to the rec requirement vocabulary it
  // certifies against, never to another program, and product twin
  // declarations enter as pinned abstract imports (uses @edition, C83),
  // never as maps_to entries. C98: a program declaring a no-surveillance
  // ISO/IEC 17067 scheme shape (type_1a/1b — sample-only; Table 1) while
  // declaring surveillance machinery (a monitor — the continuous-
  // evaluation primitive — or a surveillance-classified process) is a
  // WARNING: the type_1a/1b shape structurally can't say "continuously".
  if (productManifest?.kind === 'certification_program') {
    const mapsTo = productManifest.mapsTo ?? [];
    if (mapsTo.length === 0) {
      err(
        'C97',
        `package "${productManifest.id}": a certification program declares the Recommendation vocabulary it certifies against (maps_to) — a program that maps to nothing certifies nothing (program-maps-resolves)`,
      );
    }
    for (const target of mapsTo) {
      const dm = resolveDepManifest(target);
      if (!dm) {
        err(
          'C97',
          `package "${productManifest.id}": maps_to "${target}" does not resolve to a known package — the requirement vocabulary a program certifies against must resolve (program-maps-resolves)`,
        );
      } else if (dm.kind === 'certification_program') {
        err(
          'C97',
          `package "${productManifest.id}": maps_to "${target}" is itself a certification program — a program maps to the standards vocabulary, never to another program (program-maps-resolves)`,
        );
      } else if (dm.kind === 'product_reference') {
        err(
          'C97',
          `package "${productManifest.id}": maps_to "${target}" is a product reference package — the product twin declarations a program certifies are pinned abstract imports (uses { ${target}@<edition> }, C83), never maps_to entries (program-maps-resolves)`,
        );
      }
    }

    // C98 — the no-surveillance scheme shapes (ISO/IEC 17067 Table 1:
    // type 1a/1b carry no surveillance) versus the program's declared
    // surveillance machinery. A monitor IS a continuous claim ("without
    // triggers, 'continuous' has no clock" — types/Monitor.ts); an
    // activity_kind { surveillance } process is a surveillance claim.
    // When the scheme-type register is in scope (smart TODO.roadmap/40
    // batch 2 — composed via uses), the register's own
    // surveillance.required adjudicates; the hard-coded type_1a/1b set
    // is the register-free fallback (the C89 spelling precedent).
    const SCHEME_TYPES_WITHOUT_SURVEILLANCE = new Set(['type_1a', 'type_1b']);
    const registerEntry = (standard.schemeTypes ?? []).find(
      t => t.id === productManifest.schemeType,
    );
    const noSurveillance = registerEntry
      ? !registerEntry.surveillance?.required
      : SCHEME_TYPES_WITHOUT_SURVEILLANCE.has(productManifest.schemeType ?? '');
    if (productManifest.schemeType && noSurveillance) {
      const claims: string[] = [];
      if ((standard.monitors ?? []).length > 0) {
        claims.push(
          `${standard.monitors.length} monitor(s): ${standard.monitors.map(m => m.id).join(', ')}`,
        );
      }
      const surveillanceProcesses = (standard.processes ?? []).filter(p =>
        (p.activityKinds ?? []).includes('surveillance'),
      );
      if (surveillanceProcesses.length > 0) {
        claims.push(
          `surveillance-classified process(es): ${surveillanceProcesses.map(p => p.id).join(', ')}`,
        );
      }
      if (claims.length > 0) {
        warn(
          'C98',
          `package "${productManifest.id}": scheme_type "${productManifest.schemeType}" certifies a type sample with no surveillance, but the program declares ${claims.join(' and ')} — the ${productManifest.schemeType} shape structurally can't say "continuously"; a surveillance-constitutive program self-classifies type_5 (ISO/IEC 17067 Table 1) (program-surveillance-required)`,
        );
      }
    }
  }

  // ── C99: the probe-channel provenance facet (smart TODO.v2/01 TCD-2;
  // analysis/twin-certification-design.md Q2) ──
  // A measured reference variable declares the physical-side channel its
  // reading arrives by: reference_instrument (a traceable reference, cited
  // by equipment-register id) | observer_attestation (a verification
  // officer reads the physical display into the evidence form — admitted
  // with the DECLARED traceability limitation, controller decision 3:
  // "twin ≡ display, not twin ≡ mass" is data, never a comment) |
  // sim_ground_truth (the acceptance environment only). The kernel checks
  // shape and vocabulary, register-free; the ref's RESOLUTION against the
  // equipment/personnel/sim registers is the smart-side linker's R45.
  {
    const PROBE_CHANNELS = new Set([
      'reference_instrument',
      'observer_attestation',
      'sim_ground_truth',
    ]);
    for (const t of standard.conformanceTests ?? []) {
      const variableNames = new Set((t.variables ?? []).map(v => v.name));
      for (const v of t.variables ?? []) {
        const p = v.provenance;
        if (!p) {
          continue;
        }
        if (!PROBE_CHANNELS.has(p.channel)) {
          err(
            'C99',
            `conformance test ${t.id}: variable "${v.name}" declares provenance channel "${p.channel}" — the probe channel is one of reference_instrument | observer_attestation | sim_ground_truth (variable-provenance-channel)`,
          );
        }
        if (p.ref === '') {
          err(
            'C99',
            `conformance test ${t.id}: variable "${v.name}" declares channel "${p.channel}" but cites no ref — the channel's register entry (equipment-register id, personnel/participant id, or sim deployment id) is the provenance's substance (variable-provenance-channel)`,
          );
        }
        if (p.observedAt === '') {
          err(
            'C99',
            `conformance test ${t.id}: variable "${v.name}" declares no observed_at binding — a channel reading without its observation timestamp cannot be paired (variable-provenance-channel)`,
          );
        } else if (!variableNames.has(p.observedAt)) {
          err(
            'C99',
            `conformance test ${t.id}: variable "${v.name}" binds observed_at to "${p.observedAt}", which names no declared variable of the test — the observation timestamp lands in a declared variable (variable-provenance-channel)`,
          );
        }
        if (p.channel === 'observer_attestation' && p.limitation === '') {
          err(
            'C99',
            `conformance test ${t.id}: variable "${v.name}" declares the observer_attestation channel without its traceability limitation — attestation-only evidence proves "twin ≡ display", not "twin ≡ mass"; the limitation is DECLARED data, never a comment (variable-provenance-channel)`,
          );
        }
        if (p.channel !== 'observer_attestation' && p.limitation !== '') {
          warn(
            'C99',
            `conformance test ${t.id}: variable "${v.name}" carries a traceability limitation on the ${p.channel} channel — the limitation declaration rides the observer_attestation channel (variable-provenance-channel)`,
          );
        }
        if (v.source !== '' && v.source !== 'measured') {
          warn(
            'C99',
            `conformance test ${t.id}: variable "${v.name}" is source ${v.source} but declares a physical probe channel — the channel provenance belongs to a measured reference reading (variable-provenance-channel)`,
          );
        }
      }
    }
  }
}
