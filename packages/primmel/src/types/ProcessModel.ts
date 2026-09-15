// ─────────────────────────────────────────────────────────────────────
// The process model (smart TODO.roadmap/40 batch 2; the packages-as-SSOT
// epic) — one file's worth of abstract processes bound into a pipeline:
//
//   process_model evaluation {
//     sequence { application assessment review decision declaration }
//     register lme_register {
//       label "ILAC-IAF-OIML list of Legal Metrology Experts"
//       clause "PD-02, 9"
//       maintainer executive_secretary
//       published "The OIML-CS pages of the OIML website …"
//       entries "Per Legal Metrology Expert: identity, …"
//     }
//     source { doc "urn:oiml:pub:cs:pd-05:2024" clause "4" }
//   }
//
// The sequence is the pipeline's declared step order over process ids;
// the registers are the participant/expert registers the pipeline feeds
// or reads. This is the shared home for the file-level facets of the
// abstract-process model: carriers that are not document modules (the
// oiml-cs evaluation file, the CASCO functional-approach files) use
// `process_model` directly; a document module embeds the same
// sub-grammar (config/documentModule.ts shares these parsers).
//
// Cross-references (sequence → process, register maintainer →
// governance_organ) resolve at check time (C121), per-register gated
// (the C58 doctrine); the codec stays total.
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';

/** One participant/expert register of a process model. */
export interface ProcessModelRegister {
  /** Snake-case register id (lme_register). */
  id: string;
  /** The register's label. */
  label: string;
  /** The clause establishing the register (e.g. "PD-02, 9"). */
  clause: string;
  /** The governance_organ id maintaining the register (C121). */
  maintainer: string;
  /** Where the register is published. */
  published: string;
  /** What one register entry carries. */
  entries: string;
}

export default interface ProcessModel {
  /** Snake-case model id (evaluation). */
  id: string;
  /** The pipeline's declared step order — process ids, in order. */
  sequence: string[];
  /** The registers the pipeline feeds or reads. */
  registers: ProcessModelRegister[];
  /** Clause-URN provenance (doc + clause). */
  source: SourceRef;
}
