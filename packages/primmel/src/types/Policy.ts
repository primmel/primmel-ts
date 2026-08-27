// ─────────────────────────────────────────────────────────────────────
// The policy construct (MN 114 v3.1, clause 19.2; TODO.primmel/10):
// a usage-policy SET as first-class model content, in Primmel's OWN
// policy grammar —
//
//   policy restricted-exchange {
//     name "Restricted exchange"
//     description "Restricted artifact classes exchange under an active agreement only."
//     default_posture true
//     governs { evaluation-report }
//
//     rule read-under-agreement {
//       kind permission
//       action read
//       artifact evaluation-report
//       constraint "ocl{agreement.state = #active}"
//     }
//     rule retain-nothing { kind prohibition action retain }
//     rule log-every-access { kind obligation action log }
//
//     ref derives-from "urn:example:bfs:2026#clause-6.2"
//   }
//
// A policy is fully meaningful with zero external references. ODRL 2.2
// is a CODEC OUTPUT (clause 19.5): the Primmel policy exports to an ODRL
// document for the dataspace wire; the semantics are this construct's,
// never the codec's. The rule kind vocabulary is closed and
// parse-enforced (permission | obligation | prohibition): a misspelt
// kind never parses into a rule that says nothing. The action vocabulary
// is the program's register — the language carries it untyped and the
// codecs map it.
//
// A policy is a DECLARATION (the concern boundary): it states the rules
// as scheme content; the enforcement machinery belongs to the runtime
// platform.
//
// Checker: C107 (policy-shape).
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';

/** The closed rule-kind vocabulary (parse-enforced). */
export const POLICY_RULE_KINDS = [
  'permission',
  'obligation',
  'prohibition',
] as const;

/** One rule of the set. */
export interface PolicyRule {
  id: string;
  /** permission | obligation | prohibition (parse-enforced). */
  kind: string;
  /** The governed action (the program's action register; '' is a C107
   *  finding — a rule without its action says nothing). */
  action: string;
  /** The artifact class the rule constrains ('' = every governed class;
   *  when present it names one class of the policy's governs register,
   *  C107). */
  artifact: string;
  /** The constraints on the rule's applicability, embedded expressions;
   *  the language stores them, the platform evaluates them. */
  constraints: string[];
}

export default interface Policy {
  id: string;
  name: string;
  description: string;
  /** The artifact classes the policy governs: identifiers of artifact
   *  classes declared by the dataspaces of the merged model (C107
   *  resolves each). */
  governs: string[];
  /** true/false when declared, null when absent. A default-posture
   *  policy applies to every artifact class it governs unless the class
   *  overrides it; a non-default policy attaches only by explicit
   *  reference. Two default-posture policies never govern the same
   *  class (C107). */
  defaultPosture: boolean | null;
  rules: PolicyRule[];
  source: SourceRef | null;
  sourceRefs: SourceRef[];
  refs?: import('./Ref').Ref[];
  correspondences?: import('./Correspondence').Correspondence[];
}
