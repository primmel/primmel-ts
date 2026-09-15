// ─────────────────────────────────────────────────────────────────────
// The document module (smart TODO.roadmap/40 batch 2; the packages-as-
// SSOT epic) — one governing document's content module made first-class
// (today the module is a directory convention: data/oiml-cs/documents/
// <doc>/ with its requirements, abstract processes, and annexes):
//
//   document_module pd_03 {
//     document "OIML-CS PD-03"
//     title "Application and approval of OIML Issuing Authorities"
//     edition "5"
//     year 2025
//     namespace /req/cs/pd-03        # the owned requirement scope —
//                                    # C119 PREFERS this declared pin
//                                    # over the requirement_class-id
//                                    # derivation
//     sequence { ia_application ia_assessment ia_rc_review }
//     register lme_register {
//       label "ILAC-IAF-OIML list of Legal Metrology Experts"
//       clause "PD-02, 9"
//       maintainer executive_secretary
//       published "The OIML-CS pages of the OIML website …"
//       entries "Per Legal Metrology Expert: identity, …"
//     }
//     source { doc "urn:oiml:pub:cs:pd-03:2025" clause "" }
//   }
//
// The sequence/register sub-grammar is SHARED with process_model
// (config/processModel.ts supplies the readers/writers) — one grammar,
// two placements: carriers that are not document modules use
// process_model directly.
//
// Cross-references (sequence → process, register maintainer →
// governance_organ) resolve at check time (C123), per-register gated
// (the C58 doctrine); the codec stays total.
// ─────────────────────────────────────────────────────────────────────

import type { ProcessModelRegister } from './ProcessModel';
import type { SourceRef } from './Subject';

export default interface DocumentModule {
  /** Snake-case module id (pd_03). */
  id: string;
  /** The document designation as cited ("OIML-CS PD-03"). */
  document: string;
  /** The document's title. */
  title: string;
  /** The edition designation ("5"); '' = undeclared. */
  edition: string;
  /** The publication year (0 = undeclared). */
  year: number;
  /**
   * The module's OWNED requirement namespace (e.g. /req/cs/pd-03) — the
   * explicit pin C119 prefers over the requirement_class-id derivation
   * (the strict-descendant leg guards it identically); '' = undeclared.
   */
  namespace: string;
  /** The module pipeline's declared step order — process ids, in order. */
  sequence: string[];
  /** The participant/expert registers the module's pipeline feeds. */
  registers: ProcessModelRegister[];
  /** Clause-URN provenance (doc + clause). */
  source: SourceRef;
}
