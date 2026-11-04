// ─────────────────────────────────────────────────────────────────────
// The dpp-smart family (C86-C88 the model-native DPP, C90-C91 the
// architecture invariants E9, C92-C93 the required test orderings E10,
// C147-C148 the executable test programs, C94 the per-test
// evaluation-formula traces E11; TODO.roadmap/35, smart gap-closes,
// twin-demo/03): the digital product passport, the architecture
// invariants, the test orderings, and the machine-executable program
// facets. The region moves verbatim from check.ts, riding the
// quantities family's returned indexes (kindDecl/kindOfUnit — the C33
// machinery); the compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import { parseFreshnessWindow } from '../time';
import type Standard from '../types/Standard';
import {
  PASSPORT_CONTENT_CLASSES,
  PASSPORT_UPI_LEVELS,
} from '../types/Passport';
import { TEST_SEQUENCE_STEP_ROLES } from '../types/TestSequence';

export interface DppSmartContext {
  standard: Standard;
  subjectIds: Set<string>;
  err: (check: string, message: string) => void;
}

export function runDppSmartFamily({
  standard,
  subjectIds,
  err,
}: DppSmartContext): void {
  // ── C86–C88: the model-native DPP (TODO.roadmap/35; doctrine ch. 14
  // §14.6, ch. 15 §15.6/§15.9) ──
  // The passport is the product model's named, access-classed PROJECTION —
  // "it cannot drift from the model because it *is* the model" (§14.6).
  // §15.9's passport rule: "the passport projection contains only aspects
  // that resolve — public classes contain nothing marked restricted".
  // C86: every content entry's class is one of the six declared classes,
  // and a qualified `<class>.<ref>` resolves against the package's
  // declared aspects/promises (sustainability refs pass unjudged — the
  // ESPR delegated-act content models do not exist yet, TODO.roadmap/35
  // "Out"). C87: an entry marked restricted/authority the public class
  // reaches (the same entry, or a covering bare class) is a leak. C88:
  // the UPI scheme declares its pattern and its ESPR level
  // (model | batch | item). Packages without a passport are untouched —
  // the loop is empty.
  {
    const KNOWN_CONTENT = new Set<string>(PASSPORT_CONTENT_CLASSES);
    const KNOWN_LEVELS = new Set<string>(PASSPORT_UPI_LEVELS);
    const entryToken = (e: { contentClass: string; ref: string }): string =>
      e.ref === '' ? e.contentClass : `${e.contentClass}.${e.ref}`;

    // The per-class resolution domains for qualified entries (C86): the
    // package's declared aspects/promises, one vocabulary per class.
    const passportPromiseIds = new Set(
      (standard.subjects ?? []).flatMap(s =>
        (s.is.promises ?? []).map(pr => pr.id).filter(id => id !== ''),
      ),
    );
    const compositionIds = new Set(
      (standard.subjects ?? []).flatMap(s => [
        ...(s.is.structure ?? []),
        ...Object.keys(s.is.designParameters ?? {}),
        ...Object.keys(s.has.characteristics ?? {}),
        ...(s.has.serves ?? []).map(sv => sv.aspect),
      ]),
    );
    const passportArtifactIds = new Set([
      ...(standard.artifactDefinitions ?? []).map(a => a.id),
      ...(standard.subjects ?? []).flatMap(s => s.is.artifacts ?? []),
    ]);
    const passportMonitorIds = new Set(
      (standard.monitors ?? []).map(m => m.id),
    );
    // null = the class has no kernel resolution domain (sustainability —
    // the forward class; its refs pass unjudged).
    const CONTENT_DOMAINS: Record<string, Set<string> | null> = {
      identity: subjectIds,
      composition: compositionIds,
      promises_as_verified: passportPromiseIds,
      live_compliance_status: new Set([
        ...passportMonitorIds,
        ...passportPromiseIds,
      ]),
      artifacts: passportArtifactIds,
      sustainability: null,
    };

    for (const p of standard.passports ?? []) {
      // C86 — passport-content-resolves (§15.9).
      for (const e of p.entries) {
        if (!KNOWN_CONTENT.has(e.contentClass)) {
          err(
            'C86',
            `passport ${p.id}: content entry "${entryToken(e)}" names an unknown content class — one of ${PASSPORT_CONTENT_CLASSES.join(' | ')} (passport-content-resolves)`,
          );
          continue;
        }
        if (e.ref !== '') {
          const domain = CONTENT_DOMAINS[e.contentClass];
          if (domain !== null && !domain.has(e.ref)) {
            err(
              'C86',
              `passport ${p.id}: content entry "${entryToken(e)}" — "${e.ref}" does not resolve against the package's declared aspects/promises (the passport projection contains only aspects that resolve, §15.9) (passport-content-resolves)`,
            );
          }
        }
      }

      // C87 — passport-access-leak (§15.9): an entry marked restricted/
      // authority is reachable from the public class when the public
      // block carries the same entry or a covering bare class. (The
      // reverse narrowing — a bare restricted class with one ref made
      // public — is an authored exception, not a leak.)
      const publicEntries = p.entries.filter(e => e.access === 'public');
      const publicTokens = new Set(publicEntries.map(entryToken));
      const publicBareClasses = new Set(
        publicEntries.filter(e => e.ref === '').map(e => e.contentClass),
      );
      for (const e of p.entries) {
        if (e.access !== 'restricted' && e.access !== 'authority') {
          continue;
        }
        if (
          publicTokens.has(entryToken(e)) ||
          publicBareClasses.has(e.contentClass)
        ) {
          err(
            'C87',
            `passport ${p.id}: entry "${entryToken(e)}" is marked ${e.access} but reachable from the public class — public classes contain nothing marked restricted (§15.9) (passport-access-leak)`,
          );
        }
      }

      // C88 — passport-upi-scheme (§14.6; ESPR): the unique product
      // identifier declares its pattern and its level.
      if (p.upi.pattern === '') {
        err(
          'C88',
          `passport ${p.id}: declares no UPI pattern — a passport is reached through its unique product identifier (upi { pattern … level … }) (passport-upi-scheme)`,
        );
      }
      if (p.upi.level === '') {
        err(
          'C88',
          `passport ${p.id}: the UPI pattern declares no level — the ESPR unique product identifier is model | batch | item level (passport-upi-scheme)`,
        );
      } else if (!KNOWN_LEVELS.has(p.upi.level)) {
        err(
          'C88',
          `passport ${p.id}: UPI level "${p.upi.level}" is not one of ${PASSPORT_UPI_LEVELS.join(' | ')} (passport-upi-scheme)`,
        );
      }
    }
  }

  // ── C90–C91: the architecture invariants (smart gap-close E9,
  // analysis/architecture-gaps-2026-07.md; smart
  // docs/oiml-core/09-invariants.md) ──
  // The `invariant` construct is the first-class replacement for the
  // note-family encoding. C90 invariant-shape: every invariant carries
  // name, statement, and severity (severity is PRESENCE-judged only —
  // the smart side owns the severity vocabulary), and enforcement is a
  // non-empty claim list XOR the literal `aspirational` marker — never
  // empty, never both. C91 invariant-enforcement-grammar: every claim
  // matches kernel:C<n> | linker:<kebab-name> | gate:<kebab-name>, and
  // the aspirational marker never appears inside a claims list. Claim
  // TARGET resolution (does the linker rule exist, does the gate have
  // evidence) is the smart-side linker rule R38's crosswalk — the
  // kernel checks syntax/shape only. Packages without invariants are
  // untouched — the loop is empty.
  {
    const CLAIM_GRAMMAR = [
      /^kernel:C\d+$/,
      /^linker:[a-z0-9-]+$/,
      /^gate:[a-z0-9-]+$/,
    ];
    for (const inv of standard.invariants ?? []) {
      // C90 — invariant-shape.
      if (inv.name === '') {
        err(
          'C90',
          `invariant ${inv.id}: declares no name — an invariant carries a short rule name (invariant-shape)`,
        );
      }
      if (inv.statement === '') {
        err(
          'C90',
          `invariant ${inv.id}: declares no statement — an invariant carries the rule's prose (the default spelling inline; alternates ride text ${inv.id}.statement blocks) (invariant-shape)`,
        );
      }
      if (inv.severity === '') {
        err(
          'C90',
          `invariant ${inv.id}: declares no severity (invariant-shape)`,
        );
      }
      const e = inv.enforcement;
      if (!e.aspirational && e.claims.length === 0) {
        err(
          'C90',
          `invariant ${inv.id}: declares no enforcement — a non-empty claim list (enforcement { kernel:C<n> … }) or the literal marker (enforcement aspirational) (invariant-shape)`,
        );
      }
      if (e.aspirational && e.claims.length > 0) {
        err(
          'C90',
          `invariant ${inv.id}: enforcement mixes the aspirational marker with ${e.claims.length} claim(s) — one or the other, never both (invariant-shape)`,
        );
      }

      // C91 — invariant-enforcement-grammar (syntax only; the smart
      // side's R38 owns target resolution).
      for (const claim of e.claims) {
        if (claim === 'aspirational') {
          err(
            'C91',
            `invariant ${inv.id}: the aspirational marker never appears inside a claims list — spell it bare (enforcement aspirational) (invariant-enforcement-grammar)`,
          );
        } else if (!CLAIM_GRAMMAR.some(re => re.test(claim))) {
          err(
            'C91',
            `invariant ${inv.id}: enforcement claim "${claim}" does not match kernel:C<n> | linker:<kebab-name> | gate:<kebab-name> (invariant-enforcement-grammar)`,
          );
        }
      }
    }
  }

  // ── C92–C93: the required test orderings (smart gap-close E10,
  // analysis/architecture-gaps-2026-07.md; the smart contract
  // data/schemas/test-sequences.yaml) ──
  // The `test_sequence` construct is the first-class replacement for the
  // hand-authored supplemental test-sequences.yaml. C92
  // test-sequence-shape: every sequence carries name, description, and a
  // non-empty steps list; every step's order is a positive integer
  // unique in the sequence; every step carries test XOR phase; role
  // appears only on test steps and only in the baseline | follow_up
  // vocabulary; depends_on is an integer. C93 test-sequence-integrity:
  // every depends_on names the order of an EARLIER step of the same
  // sequence — never itself (self-reference), never a later step
  // (forward reference), never an order no step declares. With
  // single-parent earlier-order edges a cycle is impossible by
  // construction (a cycle needs at least one non-descending edge, which
  // the per-edge checks flag), so the three explicit per-edge checks
  // subsume cycle detection. Test-ref RESOLUTION (does /conf/… name a
  // declared conformance test of the standard) is the smart-side linker
  // rule R39's job — the kernel checks syntax/shape only, exactly like
  // E9's C90/C91 vs R38 split. Packages without test sequences are
  // untouched — the loop is empty.
  {
    for (const seq of standard.testSequences ?? []) {
      // C92 — test-sequence-shape.
      if (seq.name === '') {
        err(
          'C92',
          `test_sequence ${seq.id}: declares no name — a test sequence carries a short name (test-sequence-shape)`,
        );
      }
      if (seq.description === '') {
        err(
          'C92',
          `test_sequence ${seq.id}: declares no description — a test sequence carries the ordering's prose (the default spelling inline; alternates ride text ${seq.id}.description blocks) (test-sequence-shape)`,
        );
      }
      if (seq.steps.length === 0) {
        err(
          'C92',
          `test_sequence ${seq.id}: declares no steps — a test sequence is a non-empty ordered step list (test-sequence-shape)`,
        );
      }
      const orders = new Set<number>();
      for (const step of seq.steps) {
        const at = step.order !== null ? `step ${step.order}` : 'a step';
        if (
          step.order === null ||
          !Number.isInteger(step.order) ||
          step.order < 1
        ) {
          err(
            'C92',
            `test_sequence ${seq.id}: ${at} declares no positive-integer order (got ${step.order === null ? 'none' : step.order}) — the step order is a positive integer (test-sequence-shape)`,
          );
        } else if (orders.has(step.order)) {
          err(
            'C92',
            `test_sequence ${seq.id}: step order ${step.order} is declared twice — the order is unique within the sequence (test-sequence-shape)`,
          );
        } else {
          orders.add(step.order);
        }
        if ((step.test === '') === (step.phase === '')) {
          err(
            'C92',
            `test_sequence ${seq.id}: ${at} carries ${
              step.test === ''
                ? 'neither test nor phase'
                : 'both test and phase'
            } — exactly one per step (a conformance-test reference XOR an environment-program phase) (test-sequence-shape)`,
          );
        }
        if (step.role !== '') {
          if (step.test === '') {
            err(
              'C92',
              `test_sequence ${seq.id}: ${at} declares role "${step.role}" on ${
                step.phase === ''
                  ? 'a step carrying neither test nor phase'
                  : 'a phase step'
              } — the role is meaningful on test steps only (test-sequence-shape)`,
            );
          } else if (
            !(TEST_SEQUENCE_STEP_ROLES as readonly string[]).includes(step.role)
          ) {
            err(
              'C92',
              `test_sequence ${seq.id}: ${at} declares role "${step.role}" — the vocabulary is ${TEST_SEQUENCE_STEP_ROLES.join(' | ')} (test-sequence-shape)`,
            );
          }
        }
        if (step.dependsOn !== null && !Number.isInteger(step.dependsOn)) {
          err(
            'C92',
            `test_sequence ${seq.id}: ${at} declares depends_on ${step.dependsOn} — the dependency is the integer order of an earlier step (test-sequence-shape)`,
          );
        }
      }

      // C93 — test-sequence-integrity (per-edge, explicit: no
      // self-reference, no forward reference, no dangling order).
      for (const step of seq.steps) {
        if (step.dependsOn === null || !Number.isInteger(step.dependsOn)) {
          continue; // absent, or malformed — C92 owns the shape
        }
        const at = step.order !== null ? `step ${step.order}` : 'a step';
        if (step.order !== null && step.dependsOn === step.order) {
          err(
            'C93',
            `test_sequence ${seq.id}: ${at} depends on itself — depends_on names an EARLIER step (test-sequence-integrity)`,
          );
        } else if (!orders.has(step.dependsOn)) {
          err(
            'C93',
            `test_sequence ${seq.id}: ${at} depends_on ${step.dependsOn} names no step of the sequence (test-sequence-integrity)`,
          );
        } else if (step.order !== null && step.dependsOn > step.order) {
          err(
            'C93',
            `test_sequence ${seq.id}: ${at} depends_on ${step.dependsOn} names a LATER step — a forward reference; depends_on names an EARLIER step (test-sequence-integrity)`,
          );
        }
      }
    }
  }

  // ── C147–C148: the executable test programs (smart TODO.twin-demo/03 —
  // the model-drive bindings) ──
  // The conformance test's `preparation { … }` / `stimulus { … }` facets
  // are the machine-executable half of the test declaration: the
  // preparation program (warm-up, preload discipline, zero check) and the
  // ordered measurement program (drive, argument expressions over the
  // subject's declared parameters, hold, the read's freshness bound, the
  // per-point acceptance reference). C147 test-program-shape: every
  // program entry's order is a positive integer unique in the program; a
  // preparation step carries a prose action AND/OR a drive reference; a
  // step's verify block carries read AND tolerance; a stimulus point
  // carries a drive and an acceptance reference. C148
  // test-program-duration: a hold / fresh_within value parses as a
  // duration window (the serve contract's vocabulary — shorthand 30min or
  // ISO 8601 fixed-length PT30M), and a stimulus point declares
  // fresh_within (§14.12's no-stale-semantics doctrine: a measurement
  // point's read carries its freshness bound, like C63's live bindings).
  // Drive/acceptance/tolerance REFERENCE RESOLUTION (the world-vocabulary
  // operation names, the requirement nodes) is the consumer-side
  // conformance leg's job — the kernel checks syntax/shape only (the
  // C92/C93 vs R39 split). Packages without test programs are untouched —
  // the loops are empty.
  {
    for (const ct of standard.conformanceTests ?? []) {
      const prep = ct.preparation;
      if (prep) {
        const orders = new Set<number>();
        for (const step of prep.entries) {
          const at =
            step.order !== null
              ? `preparation step ${step.order}`
              : 'a preparation step';
          if (
            step.order === null ||
            !Number.isInteger(step.order) ||
            step.order < 1
          ) {
            err(
              'C147',
              `conformance_test ${ct.id}: ${at} declares no positive-integer order (got ${step.order === null ? 'none' : step.order}) — the step order is a positive integer (test-program-shape)`,
            );
          } else if (orders.has(step.order)) {
            err(
              'C147',
              `conformance_test ${ct.id}: preparation step order ${step.order} is declared twice — the order is unique within the program (test-program-shape)`,
            );
          } else {
            orders.add(step.order);
          }
          if (step.action === '' && step.drive === '') {
            err(
              'C147',
              `conformance_test ${ct.id}: ${at} declares neither action nor drive — a preparation step carries a prose action AND/OR a drive reference (test-program-shape)`,
            );
          }
          if (
            step.verify &&
            (step.verify.read === '' || step.verify.tolerance === '')
          ) {
            err(
              'C147',
              `conformance_test ${ct.id}: ${at} declares a verify block without ${
                step.verify.read === '' ? 'read' : 'tolerance'
              } — the verification names what to read AND the tolerance reference (test-program-shape)`,
            );
          }
          if (step.hold !== '' && parseFreshnessWindow(step.hold) === null) {
            err(
              'C148',
              `conformance_test ${ct.id}: ${at} hold "${step.hold}" is not a parseable duration (shorthand 500ms/5s/1min/1h/1d or ISO 8601 with fixed-length components, e.g. PT30M) (test-program-duration)`,
            );
          }
        }
      }
      const stim = ct.stimulus;
      if (stim) {
        const orders = new Set<number>();
        for (const point of stim.entries) {
          const at =
            point.order !== null
              ? `stimulus point ${point.order}`
              : 'a stimulus point';
          if (
            point.order === null ||
            !Number.isInteger(point.order) ||
            point.order < 1
          ) {
            err(
              'C147',
              `conformance_test ${ct.id}: ${at} declares no positive-integer order (got ${point.order === null ? 'none' : point.order}) — the point order is a positive integer (test-program-shape)`,
            );
          } else if (orders.has(point.order)) {
            err(
              'C147',
              `conformance_test ${ct.id}: stimulus point order ${point.order} is declared twice — the order is unique within the program (test-program-shape)`,
            );
          } else {
            orders.add(point.order);
          }
          if (point.drive === '') {
            err(
              'C147',
              `conformance_test ${ct.id}: ${at} declares no drive — a stimulus point names the drive operation (test-program-shape)`,
            );
          }
          if (point.acceptance === '') {
            err(
              'C147',
              `conformance_test ${ct.id}: ${at} declares no acceptance — a stimulus point names the MPE/requirement node it is judged against (test-program-shape)`,
            );
          }
          if (point.hold !== '' && parseFreshnessWindow(point.hold) === null) {
            err(
              'C148',
              `conformance_test ${ct.id}: ${at} hold "${point.hold}" is not a parseable duration (shorthand 500ms/5s/1min/1h/1d or ISO 8601 with fixed-length components, e.g. PT30M) (test-program-duration)`,
            );
          }
          if (point.freshWithin === '') {
            err(
              'C148',
              `conformance_test ${ct.id}: ${at} declares no fresh_within — a measurement point's read carries its freshness bound (§14.12: no stale semantics) (test-program-duration)`,
            );
          } else if (parseFreshnessWindow(point.freshWithin) === null) {
            err(
              'C148',
              `conformance_test ${ct.id}: ${at} fresh_within "${point.freshWithin}" is not a parseable freshness window (shorthand 500ms/5s/1min/1h/1d or ISO 8601 with fixed-length components, e.g. PT5S) (test-program-duration)`,
            );
          }
        }
      }
      // The declared procedure's typed-step discipline (TODO.lang-spec/04):
      // the parse refuses the retired spellings (the corpus sweep
      // completed — v0.33.12), so every step here is typed; a duplicate
      // id makes the sequence unresolvable.
      if (ct.procedure.length > 0) {
        const ids = new Set<string>();
        for (const s of ct.procedure) {
          if (!s.id) {
            continue;
          }
          if (ids.has(s.id)) {
            err(
              'C147',
              `conformance_test ${ct.id}: procedure step "${s.id}" is declared twice — the typed ids are unique within the procedure (test-program-shape)`,
            );
          } else {
            ids.add(s.id);
          }
        }
      }
    }
  }

  // ── C94: the per-test evaluation-formula traces (smart gap-close E11,
  // analysis/architecture-gaps-2026-07.md; the smart contract
  // data/schemas/formulas-used.yaml) ──
}
