// ─────────────────────────────────────────────────────────────────────
// The application declaration (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — the rec's applicant-facing documentation
// register (what the applicant submits with the application; the
// wizard's applicant-facing surfaces, smart TODO.application/02),
// first-class what payload/application.yaml carries today (the
// verbatim-payload codec exclusion this construct retires):
//
//   application_declaration application {   # singleton per rec
//     declaration_form r60-3/sec-4.5        # → form (C132); optional —
//                                           # only r60 declares one
//     document measurement-principle {
//       name "Description of the general principle of measurement"
//       description "… (R 60-2, 2.5 a)."
//       obligation shall                    # shall | should | may —
//                                           # parse-enforced
//       source { doc "urn:oiml:pub:r:60-2:2021" clause "2.5" }
//     }
//   }
//
// NOT the Batch-1 declaration family — declaration_kind/status/gate are
// the CS participant-declaration machinery (B 18:2025 §5.5–5.6); this
// construct is the APPLICATION's documentation checklist. The keyword
// keeps the `application_` prefix to stay out of that namespace.
//
// Localized name/description: the default spelling rides inline; the
// alternates ride l10n `text` blocks (the term/form precedent) and the
// projection re-joins.
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';

/** One documentation item the applicant submits. */
export interface ApplicationDocument {
  /** Kebab-case item id (measurement-principle). */
  id: string;
  /** The item's name (default spelling inline). */
  name: string;
  /** What the item must contain (default spelling inline). */
  description: string;
  /** shall | should | may (parse-enforced; '' = undeclared). */
  obligation: string;
  /** Clause-URN provenance (optional). */
  source: SourceRef | null;
}

export default interface ApplicationDeclaration {
  /** Conventionally `application` (singleton per rec). */
  id: string;
  /** The form the applicant signs (→ form; C132; '' = undeclared). */
  declarationForm: string;
  /** The documentation checklist, in declared order. */
  documents: ApplicationDocument[];
}
