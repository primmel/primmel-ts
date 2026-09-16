export type GatewayKind = 'exclusive_gateway' | 'parallel_gateway';

/**
 * One outgoing edge of an exclusive gateway (smart TODO.roadmap/40
 * batch 5; the packages-as-SSOT epic — the workflow routing cascade):
 * `edge <target-process-id> { condition "…" label "…" }`.
 *
 * Routing semantics: first match in declaration order wins (the
 * process-flow-edge doctrine); the edge whose condition is the bare
 * token `default` is the catch-all and RECOMMENDED last (C142 checks
 * the discipline). The condition is an opaque quoted expression (OCL-ish
 * classification predicates like "[accuracy_class] in ['C', 'D']") —
 * never resolved kernel-side (the R26 field-resolution precedent).
 */
export interface GatewayEdge {
  /** The target process id (resolves at check time, C142). */
  target: string;
  /** The routing condition ('default' = the catch-all edge). */
  condition: string;
  /** The printed edge label ('' = unlabeled). */
  label: string;
}

export default interface Gateway {
  id: string;
  gatewayType: GatewayKind;
  label?: string;
}

export interface ExclusiveGateway extends Gateway {
  gatewayType: 'exclusive_gateway';
  label: string;
  /** The outgoing routing cascade (declaration order = match order). */
  edges: GatewayEdge[];
}

export interface ParallelGateway extends Gateway {
  gatewayType: 'parallel_gateway';
}
