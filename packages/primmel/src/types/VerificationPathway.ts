// ─────────────────────────────────────────────────────────────────────
// The verification pathway (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — the metrological-control pathways beyond
// type evaluation (OIML V 1:2022, 2.09 verification; 2.12 initial /
// 2.13 subsequent / 2.14 mandatory periodic; the in-service inspection
// kind is the Recommendation's own): the per-kind test set REUSING the
// conformance machinery, the assessment scope, the limits mode, the
// marking/securing applied after a pass, and the validity window with
// its re-verification triggers bound to lifecycle state-machine
// actions:
//
//   verification_pathway initial-verification {
//     kind initial                      # initial|subsequent|periodic|in-service (parse-enforced)
//     label "Initial verification"
//     description "…"
//     visual_inspection "…"             # optional
//     tests { /conf/field/stationary-field-test … }   # → conformance_test (C138)
//     assessment {
//       covers { /req/metrological/mpe-stationary … } # → requirement (C138)
//       description "…"
//     }
//     limits {
//       mode same-as-type-evaluation    # same-as-type-evaluation|override (parse-enforced)
//       description "…"
//       source { doc "urn:oiml:pub:r:91-1:2025" clause "8.2.3" }
//     }
//     marking {
//       mark verification-mark { mark "verification mark" location "…" clause "8.2.4" }
//       securing { "sealing of adjustment means (7.13 a)" "…" }
//     }
//     validity {
//       window { years 1 }              # the scheme_lifecycle window sub-grammar (≥1 of years/months — C138)
//       trigger validity-elapsed { kind timer action validity_elapsed description "…" }
//       trigger tyre-change {
//         kind signal                   # timer|signal (parse-enforced)
//         event tyre-change             # required iff kind signal (C138)
//         action invalidating_signal_received   # → a lifecycle state_machine transition action (C138, gated)
//         applicability { mode_of_use: [moving] }
//         source { doc "urn:oiml:pub:r:91-1:2025" clause "6.15.3 Note 2" }
//       }
//     }
//     source { doc "urn:oiml:pub:r:91-1:2025" clause "8.2" }
//   }
//
// The YAML `reference:` facet is DROPPED (derivable from `source` — the
// Batch-2 decision on abstract processes).
//
// C138 verification-pathway-references: tests → conformance_test,
// covers → requirement (per-register gated), the trigger action → a
// transition action of an in-scope lifecycle state_machine (the R22
// mirror), event required iff kind signal, the window carries ≥1 of
// years/months.
// ─────────────────────────────────────────────────────────────────────

import type { ApplicabilityEntry } from './Form';
import type { SourceRef } from './Subject';

/** The validity window (the scheme_lifecycle window sub-grammar). */
export interface VerificationWindow {
  years: number;
  months: number;
}

/** One re-verification trigger. */
export interface VerificationTrigger {
  id: string;
  /** timer | signal (parse-enforced; '' when unstated). */
  kind: string;
  /** The out-of-cycle signal event — required iff kind signal (C138). */
  event: string;
  /** The lifecycle state-machine transition action (C138, gated). */
  action: string;
  /** The dimension applicability ([] = unconditional). */
  applicability: ApplicabilityEntry[];
  description: string;
  source: SourceRef | null;
}

/** One verification mark. */
export interface VerificationMark {
  id: string;
  mark: string;
  location: string;
  clause: string;
}

export default interface VerificationPathway {
  /** e.g. `initial-verification`. */
  id: string;
  /** initial | subsequent | periodic | in-service (parse-enforced). */
  kind: string;
  label: string;
  description: string;
  /** The pre-test visual inspection prose ('' when unstated). */
  visualInspection: string;
  /** The per-kind test set — conformance_test ids. */
  tests: string[];
  /** The conformity-assessment scope (null when unstated). */
  assessment: { covers: string[]; description: string } | null;
  /** The limits mode block (null when unstated). */
  limits: {
    mode: string;
    description: string;
    source: SourceRef | null;
  } | null;
  /** The marking block (null when unstated). */
  marking: { marks: VerificationMark[]; securing: string[] } | null;
  /** The validity block (null when unstated). */
  validity: {
    window: VerificationWindow | null;
    triggers: VerificationTrigger[];
  } | null;
  source: SourceRef | null;
}
