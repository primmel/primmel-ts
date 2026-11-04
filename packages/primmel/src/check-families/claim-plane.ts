// ─────────────────────────────────────────────────────────────────────
// The claim-plane family (C42-C44 promises, C45-C47 artifacts,
// C48-C50 characteristics; TODO.roadmap/08-10): the manufacturer's
// claims and their carriers — the first-class promises on
// characteristics/behavior (target resolution, verifiability, the
// no-bare-restatement rule), the artifact register (TODO.roadmap/09
// gap audit G2), and the characteristic register. The region moves
// verbatim from check.ts; the compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import { isDuration } from '../time';
import type ConformanceTest from '../types/ConformanceTest';
import type { FormField } from '../types/Form';
import type { Requirement } from '../types/Requirement';
import type Standard from '../types/Standard';

export interface ClaimPlaneContext {
  standard: Standard;
  attrIds: Set<string>;
  behaviorIds: Set<string>;
  symbolIds: Set<string>;
  reqIds: Set<string>;
  testIds: Set<string>;
  dimIds: Map<string, Set<string> | null>;
  err: (check: string, message: string) => void;
  warn: (check: string, message: string) => void;
}

export function runClaimPlaneFamily({
  standard,
  attrIds,
  behaviorIds,
  symbolIds,
  reqIds,
  testIds,
  dimIds,
  err,
  warn,
}: ClaimPlaneContext): void {
  // ── C42–C44: promises (TODO.roadmap/08) ──
  // A promise is a manufacturer claim on a characteristic or a behavior —
  // possibly envelope-shaped, possibly conditional — that evaluation
  // verifies and the certificate prints as promises-as-verified (doctrine
  // ch. 02 §2.3, ch. 15 §15.2). It is NOT a declared attribute value: a
  // claim stated as one bare parameter value stays an `origin: declared`
  // attribute (C44 enforces the distinctness).
  //
  // Verification linkage (C43): a promise may declare `verified_by`
  // requirement/test ids (their resolution is C2, above). When it does
  // not, the linter DERIVES candidates — requirements/tests binding the
  // same target: a requirement binds a characteristic target when its
  // limit.uses or a binds_to leaf names the characteristic or its symbol,
  // and binds a behavior target via a `…behaviors.<id>` binds_to path; a
  // test binds a target when it targets a binding requirement, names the
  // target in an acceptance criterion/variable/observable, or (behaviors)
  // is listed in the behavior's own verified_by. No verification declared
  // or derived is a warning at authoring.
  const requirementBindsPromiseTarget = (
    r: Requirement,
    names: Set<string>,
  ): boolean => {
    for (const u of r.limit?.uses ?? []) {
      const leaf = u.split('.').pop() ?? u;
      if (names.has(u) || names.has(leaf)) {
        return true;
      }
    }
    for (const p of r.bindsTo ?? []) {
      const leaf = String(p).split('.').pop() ?? '';
      if (names.has(leaf)) {
        return true;
      }
    }
    return false;
  };
  const testBindsPromiseTarget = (
    t: ConformanceTest,
    names: Set<string>,
    boundReqs: Set<string>,
  ): boolean => {
    for (const target of t.targets ?? []) {
      if (boundReqs.has(target)) {
        return true;
      }
    }
    for (const ac of t.acceptanceCriteria ?? []) {
      if (names.has(ac.item)) {
        return true;
      }
    }
    for (const v of t.variables ?? []) {
      if (names.has(v.name)) {
        return true;
      }
    }
    for (const o of t.observables ?? []) {
      if (names.has(o.name)) {
        return true;
      }
    }
    return false;
  };
  for (const s of standard.subjects ?? []) {
    // Characteristics of THIS subject (extends chains already merged):
    // name → symbol, both spellings legal in promise targets/derivations.
    const characteristicSymbols = new Map<string, string>();
    for (const [k, c] of Object.entries(s.has.characteristics ?? {})) {
      characteristicSymbols.set(k, c.symbol ?? '');
    }
    // Bare-value targets (C44): declared attribute values — attribute
    // definitions, the subject's design parameters, its has.attributes.
    const bareValueTargets = new Set<string>([
      ...attrIds,
      ...Object.keys(s.is.designParameters ?? {}),
      ...Object.keys(s.has.attributes ?? {}),
    ]);
    for (const p of s.is.promises ?? []) {
      const label =
        p.id ||
        (p.statement.length > 40
          ? p.statement.slice(0, 37) + '…'
          : p.statement);
      // C2 — declared verified_by ids must resolve to a requirement or a
      // conformance test (same discipline as behavior verified_by).
      for (const v of p.verifiedBy ?? []) {
        if (!reqIds.has(v) && !testIds.has(v)) {
          err(
            'C2',
            `subject ${s.id}: promise "${label}" verified_by "${v}" is not a declared requirement or conformance test`,
          );
        }
      }
      if (!p.target) {
        // Statement-only shorthand: no target to derive verification
        // against — unless verified_by is declared, the promise is
        // unverifiable (C43, warning at authoring).
        if ((p.verifiedBy ?? []).length === 0) {
          warn(
            'C43',
            `subject ${s.id}: promise "${label}" has no target and no verified_by — it is unverifiable; give it a characteristic/behavior target or declare the verifying requirement/test (promise-verifiable)`,
          );
        }
        continue;
      }
      const isCharacteristic = characteristicSymbols.has(p.target);
      const isBehavior = behaviorIds.has(p.target);
      if (!isCharacteristic && !isBehavior) {
        if (bareValueTargets.has(p.target)) {
          // C44 (narrowed) — the crime is RESTATING a bare value as a
          // claim, not TARGETING an attribute: fire only when the promise
          // merely restates the declared attribute value — a bare
          // quantity level with no conditions and no verification
          // linkage. A genuine claim ABOUT an attribute (conditioned,
          // envelope/range, symbolic level, or verified) is legal; a
          // characteristic/behavior name wins the collision (above).
          const restatesBareValue =
            p.level?.kind === 'quantity' &&
            p.conditions === '' &&
            (p.verifiedBy ?? []).length === 0;
          if (restatesBareValue) {
            err(
              'C44',
              `subject ${s.id}: promise "${label}" only restates the declared attribute value "${p.target}" — a promise claims a characteristic or behavior (optionally conditioned); bare values stay origin: declared attributes (promise-not-bare-value)`,
            );
          }
        } else if (dimIds.has(p.target) || symbolIds.has(p.target)) {
          // A claim ABOUT a classification dimension or a symbol-named
          // quantity is a legal target (the register doctrine — smart's
          // linker R15 resolves a promise target to a declared attribute,
          // dimension, characteristic (symbol id), or behavior). Like the
          // attribute path, no C43 derivation runs: dimensions/symbols
          // carry no requirement-binding channel here.
        } else {
          // C42 — the target resolves to nothing the subject can claim.
          err(
            'C42',
            `subject ${s.id}: promise "${label}" target "${p.target}" is not a declared characteristic, behavior, attribute, dimension, or symbol (promise-target-resolves)`,
          );
        }
        continue;
      }
      if ((p.verifiedBy ?? []).length > 0) {
        continue; // verification declared — C43 silent
      }
      // C43 — derive the verifying requirements/tests from the target.
      const names = new Set<string>([p.target]);
      if (isCharacteristic) {
        const sym = characteristicSymbols.get(p.target);
        if (sym) {
          names.add(sym);
        }
      }
      const boundReqs = new Set<string>();
      for (const r of standard.requirements ?? []) {
        if (requirementBindsPromiseTarget(r, names)) {
          boundReqs.add(r.id);
        }
      }
      const boundTests = new Set<string>();
      for (const t of standard.conformanceTests ?? []) {
        if (testBindsPromiseTarget(t, names, boundReqs)) {
          boundTests.add(t.id);
        }
      }
      if (isBehavior) {
        const b = (standard.behaviors ?? []).find(x => x.id === p.target);
        for (const tid of b?.verifiedBy ?? []) {
          boundTests.add(tid);
        }
      }
      if (boundReqs.size === 0 && boundTests.size === 0) {
        warn(
          'C43',
          `subject ${s.id}: promise "${label}" declares no verified_by and no requirement/test binds its target "${p.target}" — declare the verifying requirement or test (promise-verifiable)`,
        );
      }
    }
  }

  // C42–C44 generalized to the promise_set register (smart
  // TODO.roadmap/40 batch 3; the packages-as-SSOT epic): the rec promise
  // registers carry the SAME sub-grammar as is.promises, so the same
  // discipline fires. The set id binds the owning subject: when that
  // subject composes, its characteristics resolve exactly as above; when
  // it does not, the characteristic leg is gated off (per-register
  // gating, the C58 doctrine) and attribute/behavior resolution stands.
  for (const ps of standard.promiseSets ?? []) {
    const owner = (standard.subjects ?? []).find(s => s.id === ps.id);
    const characteristicSymbols = new Map<string, string>();
    for (const [k, c] of Object.entries(owner?.has.characteristics ?? {})) {
      characteristicSymbols.set(k, c.symbol ?? '');
    }
    const bareValueTargets = new Set<string>([
      ...attrIds,
      ...Object.keys(owner?.is.designParameters ?? {}),
      ...Object.keys(owner?.has.attributes ?? {}),
    ]);
    for (const p of ps.promises ?? []) {
      const label =
        p.id ||
        (p.statement.length > 40
          ? p.statement.slice(0, 37) + '…'
          : p.statement);
      const where = `promise_set ${ps.id}: promise "${label}"`;
      // C2 — declared verified_by ids must resolve (same discipline as
      // the subject promises).
      for (const v of p.verifiedBy ?? []) {
        if (!reqIds.has(v) && !testIds.has(v)) {
          err(
            'C2',
            `${where} verified_by "${v}" is not a declared requirement or conformance test`,
          );
        }
      }
      if (!p.target) {
        if ((p.verifiedBy ?? []).length === 0) {
          warn(
            'C43',
            `${where} has no target and no verified_by — it is unverifiable; give it a characteristic/behavior target or declare the verifying requirement/test (promise-verifiable)`,
          );
        }
        continue;
      }
      const isCharacteristic = characteristicSymbols.has(p.target);
      const isBehavior = behaviorIds.has(p.target);
      if (!isCharacteristic && !isBehavior) {
        if (bareValueTargets.has(p.target)) {
          // C44 (narrowed) — same restatement leg as subject promises.
          const restatesBareValue =
            p.level?.kind === 'quantity' &&
            p.conditions === '' &&
            (p.verifiedBy ?? []).length === 0;
          if (restatesBareValue) {
            err(
              'C44',
              `${where} only restates the declared attribute value "${p.target}" — a promise claims a characteristic or behavior (optionally conditioned); bare values stay origin: declared attributes (promise-not-bare-value)`,
            );
          }
        } else if (dimIds.has(p.target) || symbolIds.has(p.target)) {
          // Dimension/symbol targets — the same widening as the subject
          // leg above (smart R15's resolution set).
        } else if (owner) {
          // C42 — gated on the owning subject composing: without it the
          // characteristic register is out of scope and the target's
          // characteristic-ness is unknowable.
          err(
            'C42',
            `${where} target "${p.target}" is not a declared characteristic, behavior, attribute, dimension, or symbol (promise-target-resolves)`,
          );
        }
        continue;
      }
      if ((p.verifiedBy ?? []).length > 0) {
        continue; // verification declared — C43 silent
      }
      // C43 — derive the verifying requirements/tests from the target.
      const names = new Set<string>([p.target]);
      if (isCharacteristic) {
        const sym = characteristicSymbols.get(p.target);
        if (sym) {
          names.add(sym);
        }
      }
      const boundReqs = new Set<string>();
      for (const r of standard.requirements ?? []) {
        if (requirementBindsPromiseTarget(r, names)) {
          boundReqs.add(r.id);
        }
      }
      const boundTests = new Set<string>();
      for (const t of standard.conformanceTests ?? []) {
        if (testBindsPromiseTarget(t, names, boundReqs)) {
          boundTests.add(t.id);
        }
      }
      if (isBehavior) {
        const b = (standard.behaviors ?? []).find(x => x.id === p.target);
        for (const tid of b?.verifiedBy ?? []) {
          boundTests.add(tid);
        }
      }
      if (boundReqs.size === 0 && boundTests.size === 0) {
        warn(
          'C43',
          `${where} declares no verified_by and no requirement/test binds its target "${p.target}" — declare the verifying requirement or test (promise-verifiable)`,
        );
      }
    }
  }

  // ── C45–C47: artifacts (TODO.roadmap/09 — gap audit G2) ──
  // An artifact is a required OUTPUT OF THE SUBJECT (the instrument) — not
  // a record of the test. artifact_definition (IS: content contract +
  // produced-when) is referenced from the subject's is.artifacts slot;
  // artifact_instance (HAS/evidence: one produced output checked against
  // the contract) from has.artifact_instances.
  const artifactDefs = new Map(
    (standard.artifactDefinitions ?? []).map(d => [d.id, d]),
  );
  const artifactInstIds = new Set(
    (standard.artifactInstances ?? []).map(a => a.id),
  );

  // C45 — artifact-def-contract: the content contract is well-formed.
  for (const d of standard.artifactDefinitions ?? []) {
    const c = d.contentContract;
    // A derived contract (contract_from, C153) is the referenced
    // promise set's projection — its fields are the set's.
    if (!d.contractFrom && c.fields.length === 0) {
      err(
        'C45',
        `artifact definition ${d.id}: content contract declares no fields — a definition must contract SOME content (artifact-def-contract)`,
      );
    }
    const seenFields = new Set<string>();
    for (const f of c.fields) {
      if (seenFields.has(f.name)) {
        err(
          'C45',
          `artifact definition ${d.id}: duplicate contract field "${f.name}" (artifact-def-contract)`,
        );
      }
      seenFields.add(f.name);
      if (!f.type) {
        err(
          'C45',
          `artifact definition ${d.id}: contract field "${f.name}" has no type — fields are named AND typed (artifact-def-contract)`,
        );
      }
    }
    for (const m of c.media) {
      if (!seenFields.has(m.field)) {
        err(
          'C45',
          `artifact definition ${d.id}: media entry refines "${m.field}", which is not a declared contract field (artifact-def-contract)`,
        );
      }
    }
    const pw = d.producedWhen;
    const KNOWN_PRODUCED_WHEN = new Set([
      'per_measurement',
      'per_interval',
      'on_event',
    ]);
    if (!KNOWN_PRODUCED_WHEN.has(pw.kind)) {
      err(
        'C45',
        `artifact definition ${d.id}: produced_when "${pw.kind}" is not one of per_measurement | per_interval | on_event (artifact-def-contract)`,
      );
    } else if (pw.kind === 'per_interval' && !isDuration(pw.interval ?? '')) {
      err(
        'C45',
        `artifact definition ${d.id}: produced_when per_interval "${pw.interval ?? ''}" is not an ISO-8601 duration (artifact-def-contract)`,
      );
    } else if (pw.kind === 'on_event' && !pw.event) {
      err(
        'C45',
        `artifact definition ${d.id}: produced_when on_event names no event (artifact-def-contract)`,
      );
    }
  }

  // C46 — artifact-instance-resolves: subject slots resolve; an instance's
  // `of` resolves; its content satisfies the contract; produced-when is
  // satisfiable by the linking run/report.
  for (const t of standard.conformanceTests ?? []) {
    for (const a of t.producesArtifacts ?? []) {
      if (!artifactDefs.has(a)) {
        err(
          'C46',
          `conformance test ${t.id}: produces_artifacts "${a}" is not a declared artifact_definition (artifact-instance-resolves)`,
        );
      }
    }
  }
  for (const s of standard.subjects ?? []) {
    for (const a of s.is.artifacts ?? []) {
      if (!artifactDefs.has(a)) {
        err(
          'C46',
          `subject ${s.id}: is.artifacts entry "${a}" is not a declared artifact_definition (artifact-instance-resolves)`,
        );
      }
    }
    for (const a of s.has.artifactInstances ?? []) {
      if (!artifactInstIds.has(a)) {
        err(
          'C46',
          `subject ${s.id}: has.artifact_instances entry "${a}" is not a declared artifact_instance (artifact-instance-resolves)`,
        );
      }
    }
  }
  for (const a of standard.artifactInstances ?? []) {
    const def = artifactDefs.get(a.of);
    if (!def) {
      err(
        'C46',
        `artifact instance ${a.id}: of "${a.of}" is not a declared artifact_definition (artifact-instance-resolves)`,
      );
      continue; // no contract to check the content against
    }
    if (!a.by) {
      err(
        'C46',
        `artifact instance ${a.id}: no producer (by) — an artifact instance is unattributable without its producing subject (artifact-instance-resolves)`,
      );
    }
    const contractFields = new Map(
      def.contentContract.fields.map(f => [f.name, f]),
    );
    for (const key of Object.keys(a.content)) {
      if (!contractFields.has(key)) {
        err(
          'C46',
          `artifact instance ${a.id}: content field "${key}" is not in the contract of ${def.id} (artifact-instance-resolves)`,
        );
      }
    }
    for (const [name, f] of contractFields) {
      if (!f.optional && !(name in a.content)) {
        err(
          'C46',
          `artifact instance ${a.id}: required contract field "${name}" of ${def.id} is not populated (artifact-instance-resolves)`,
        );
      }
    }
    // produced-when leg: per_measurement means the instance exists BY a
    // measurement — an instance linking no run/report cannot demonstrate
    // the produced-when rule is satisfied.
    if (def.producedWhen.kind === 'per_measurement' && a.links.length === 0) {
      err(
        'C46',
        `artifact instance ${a.id}: ${def.id} is produced per_measurement but the instance links no run/report — link the producing measurement run or report (artifact-instance-resolves)`,
      );
    }
  }

  // C47 — artifact-evidence-separation (the MECE firewall): an artifact is
  // an output OF the instrument; an EvidenceRecord is a record OF the test.
  // No artifact contract field name may double as a test-run record slot
  // (conformance-test variable/observable, form field) — a collision means
  // the instrument's output is being duplicated into an evidence-record
  // shape (or test-run evidence is being passed off as the artifact).
  const evidenceSlots = new Map<string, string>(); // name → where declared
  for (const t of standard.conformanceTests ?? []) {
    for (const v of t.variables ?? []) {
      if (v.name && !evidenceSlots.has(v.name)) {
        evidenceSlots.set(v.name, `a variable of conformance test ${t.id}`);
      }
    }
    for (const o of t.observables ?? []) {
      if (o.name && !evidenceSlots.has(o.name)) {
        evidenceSlots.set(o.name, `an observable of conformance test ${t.id}`);
      }
    }
  }
  const collectFormFieldNames = (
    fields: ReadonlyArray<FormField>,
    formId: string,
  ): void => {
    for (const f of fields) {
      if (f.name && !evidenceSlots.has(f.name)) {
        evidenceSlots.set(f.name, `a field of form ${formId}`);
      }
      collectFormFieldNames(f.fields ?? [], formId);
    }
  };
  for (const form of standard.forms ?? []) {
    collectFormFieldNames(form.fields ?? [], form.id);
  }
  for (const d of standard.artifactDefinitions ?? []) {
    for (const f of d.contentContract.fields) {
      const where = evidenceSlots.get(f.name);
      if (where) {
        err(
          'C47',
          `artifact definition ${d.id}: contract field "${f.name}" is also ${where} — an artifact is an output OF the instrument, not a record OF the test; keep artifact content out of evidence-record shapes (and vice versa) (artifact-evidence-separation)`,
        );
      }
    }
  }

  // ── C48–C50: characteristics (TODO.roadmap/10) ──────────────────────
  // Characteristics are the quantitative interface of the subject
  // (doctrine ch. 02 §2.7): DEFINED in the primary model (the subject's
  // has.characteristics), referenced everywhere else — promises claim
  // them, requirements constrain them, tests compute them, verdicts
  // judge them.

  // C48 — characteristic-one-home: once a standard declares subject
  // characteristics (the primary-model register), a `verdict` construct
  // carrying its own `derive` defines a verdict-quantity derivation
  // OUTSIDE the primary model — the one-home violation the OIML SMART
  // linker's verdict-no-shadow / verdict-restatement rules guard,
  // re-pointed at the new home. Packages without subject characteristics
  // (the v2 instrument trees, whose verdict registry is the
  // specification-side transport of model/characteristics.yaml) stay
  // silent: the rule fires only where a primary-model characteristic
  // register exists.
  const anySubjectCharacteristics = (standard.subjects ?? []).some(
    s => Object.keys(s.has.characteristics ?? {}).length > 0,
  );
  if (anySubjectCharacteristics) {
    for (const v of standard.verdicts ?? []) {
      if (v.derive) {
        err(
          'C48',
          `verdict ${v.id}: carries a derivation outside the primary model — a verdict quantity derives ONCE in the subject's has.characteristics and is referenced everywhere else (characteristic-one-home)`,
        );
      }
    }
  }

  // C49 — characteristic-behavior-link: a characteristic's behavior ref
  // resolves to a declared behavior (closing the
  // behavior→I/O→characteristic chain).
  for (const s of standard.subjects ?? []) {
    for (const [k, c] of Object.entries(s.has.characteristics ?? {})) {
      if (c.behavior && !behaviorIds.has(c.behavior)) {
        err(
          'C49',
          `subject ${s.id}: characteristic "${k}" behavior "${c.behavior}" is not a declared behavior (characteristic-behavior-link)`,
        );
      }
    }
  }

  // C50 — characteristic-derivation-inputs: the identifiers an ocl{…}
  // derivation reads resolve to the subject's quantitative vocabulary —
  // self.<p> reads against the subject's parameters (design parameters,
  // has.attributes, attribute definitions); bare names against the
  // behavior-I/O vocabulary (the standard's symbols — the observables
  // measured of the behavior — plus attribute definitions and the
  // subject's parameters). Prose derivations are not machine-checkable
  // and are skipped.
  const OCL_KEYWORDS = new Set([
    'self',
    'and',
    'or',
    'xor',
    'not',
    'implies',
    'true',
    'false',
    'null',
    'if',
    'then',
    'else',
    'endif',
    'let',
    'in',
    'invalid',
  ]);
  const derivationReads = (
    derivation: string,
  ): { selfReads: string[]; bareReads: string[] } => {
    const body = derivation
      .trim()
      .replace(/^ocl\{/, '')
      .replace(/\}$/, '');
    const selfReads: string[] = [];
    const bareReads: string[] = [];
    for (const m of body.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
      const id = m[0];
      if (OCL_KEYWORDS.has(id)) {
        continue;
      }
      const idx = m.index ?? 0;
      const rest = body.slice(idx + id.length);
      if (rest.trimStart().startsWith('(')) {
        continue;
      } // function call
      const before = body.slice(0, idx);
      if (before.endsWith('self.')) {
        selfReads.push(id);
      } else if (before.endsWith('.')) {
        continue; // navigation segment into a resolved root
      } else {
        bareReads.push(id);
      }
    }
    return { selfReads, bareReads };
  };
  for (const s of standard.subjects ?? []) {
    const subjectParams = new Set<string>([
      ...Object.keys(s.is.designParameters ?? {}),
      ...Object.keys(s.has.attributes ?? {}),
      ...attrIds,
    ]);
    const ioVocabulary = new Set<string>([
      ...symbolIds,
      ...attrIds,
      ...Object.keys(s.is.designParameters ?? {}),
      ...Object.keys(s.has.attributes ?? {}),
    ]);
    for (const [k, c] of Object.entries(s.has.characteristics ?? {})) {
      if (!/^ocl\{[\s\S]*\}$/.test(c.derivation.trim())) {
        continue;
      }
      const { selfReads, bareReads } = derivationReads(c.derivation);
      for (const id of selfReads) {
        if (!subjectParams.has(id)) {
          err(
            'C50',
            `subject ${s.id}: characteristic "${k}" derivation reads self.${id}, which is not a declared subject parameter (design parameter, has.attribute, or attribute definition) — in \`${c.derivation}\` (characteristic-derivation-inputs)`,
          );
        }
      }
      for (const id of bareReads) {
        if (!ioVocabulary.has(id)) {
          err(
            'C50',
            `subject ${s.id}: characteristic "${k}" derivation reads "${id}", which is not a declared symbol, attribute, or subject parameter (behavior I/O) — in \`${c.derivation}\` (characteristic-derivation-inputs)`,
          );
        }
      }
    }
  }
}
