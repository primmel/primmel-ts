// The process register entry (the document_module's grammar carries it;
// the process_model construct itself is retired — phase 6).

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
