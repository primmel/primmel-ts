// ─────────────────────────────────────────────────────────────────────
// The dataspace construct (MN 114 v3.1, clause 19.1; TODO.primmel/10):
// the dataspace DEFINITION as a model object —
//
//   dataspace bfs-exchange {
//     name "Bean freshness exchange"
//     participant_class certification-body { label "..." description "..." }
//     artifact_class evaluation-report {
//       label "Evaluation report"
//       element /art/evaluation-report      // the content's model definition
//       policy restricted-exchange          // the per-class policy override
//     }
//     policies { public-access restricted-exchange }
//     default_policy restricted-exchange
//     trust_anchor scheme-registry {
//       trust_ref bfs-scheme-op key bfs-2026-root
//       role registry
//     }
//     compatible_with { allied-scheme-exchange }
//     ref derives-from "urn:example:bfs:2026#clause-5.1"
//   }
//
// The semantics are Primmel's own, self-contained: the participant
// classes, the artifact classes, the policy sets by reference, the trust
// anchors, and the clause-cited governance. The dataspace-protocol /
// IDS alignment is the consumer's EXPRESSION layer (a projection codec),
// never an input dependency (clause 19.5). The construct is a
// declaration: the exchange and enforcement machinery belongs to the
// runtime platform, never to the language.
//
// Checker: C104 (references resolve), C105 (trust-anchor shape), C106
// (governance provenance).
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';
import type { TrustRef } from './TrustRef';

/** One participant class: a kind of organization the dataspace admits,
 *  declared here in the dataspace, not referenced. */
export interface DataspaceParticipantClass {
  id: string;
  label: string;
  description: string;
}

/** One artifact class: a kind of model-defined content the dataspace
 *  exchanges. */
export interface DataspaceArtifactClass {
  id: string;
  label: string;
  description: string;
  /** The model element defining the class's content: an artifact
   *  definition, a form, or a data class id ('' when undeclared; C104
   *  resolves it when present). */
  element: string;
  /** The per-class policy override ('' when the class inherits the
   *  dataspace's default_policy; C104 resolves it when present). */
  policy: string;
}

/** One trust anchor: the trust-plane identity the dataspace's exchanges
 *  root in (the trust_ref resolution contract: types/TrustRef.ts). */
export interface DataspaceTrustAnchor {
  id: string;
  /** The anchor's trust reference; null when undeclared (C105 flags it —
   *  an anchor without its reference anchors nothing). */
  trustRef: TrustRef | null;
  /** The anchor's function (the program's register: registry, issuer,
   *  notary, ...), '' when undeclared. */
  role: string;
  description: string;
}

export default interface Dataspace {
  id: string;
  name: string;
  description: string;
  participantClasses: DataspaceParticipantClass[];
  artifactClasses: DataspaceArtifactClass[];
  /** The dataspace's policy register: the policy sets it carries, by
   *  identifier (C104 resolves each). */
  policies: string[];
  /** The standing policy every artifact class inherits (a class's own
   *  `policy` facet overrides it); '' when undeclared. */
  defaultPolicy: string;
  trustAnchors: DataspaceTrustAnchor[];
  /** The declared compatibility register: identifiers of other
   *  dataspaces. Compatibility is always explicit, never inferred. */
  compatibleWith: string[];
  /** The governance citations (the scheme documents' clauses); the
   *  canonical `ref derives-from` form folds here. C106 warns when a
   *  dataspace carries none. */
  source: SourceRef | null;
  sourceRefs: SourceRef[];
  refs?: import('./Ref').Ref[];
  correspondences?: import('./Correspondence').Correspondence[];
}
