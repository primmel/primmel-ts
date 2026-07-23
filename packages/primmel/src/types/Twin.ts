/**
 * Twin interface constructs (Primmel v3, TODO.roadmap/32 — doctrine
 * ch. 14 §14.4, concept doc §10.2–10.3): the live twin's integration
 * language.
 *
 * A live twin is a subject instance whose anatomy is SERVED (ch. 14 §14.3):
 * "no new anatomy needed, only plumbing to serve it". Three small
 * primitives, two of which live on the subject anatomy itself:
 *
 *   endpoint  (IS-level) — the subject's declared API surface, part of the
 *     type definition "like a marking or a software identification"
 *     (§14.3). Declared inline in the subject's `is { … }` block (§14.11
 *     grammar sketch), NOT as a top-level construct: an endpoint is
 *     meaningless detached from the subject whose interface it is. Each
 *     endpoint declares:
 *       operations — { name, kind: query | subscribe | invoke, serves/does
 *         refs, payload schema }: query pulls a current value, subscribe
 *         pushes on change, invoke triggers a process. Every operation
 *         carries a payload schema — a QuantityValue per INV-1, ALWAYS
 *         with unit (`1` for dimensionless/state payloads) and timestamp
 *         (§14.4; §14.12: "every endpoint operation has an access scope
 *         and a payload schema (QuantityValue with timestamp)").
 *       access scopes — who may call what: public | registered |
 *         authority. Every operation is covered by exactly one scope
 *         (linter C62).
 *       profile — the connector profile binding the protocol (below).
 *
 *   serve  (HAS-level) — the binding from an aspect to an operation:
 *     `serve <aspect> via <operation> { fresh_within <duration> }`,
 *     declared in the subject's `has { … }` block. Freshness is part of
 *     the binding (§14.4): "the engine must know how old a value may be
 *     before it stops meaning anything" — a live binding without
 *     `fresh_within` is an error (§14.12; linter C63). The aspect path
 *     uses the task-03 scope vocabulary ([level.]{parameters|
 *     classification|test_context}.<key>, plus the reserved `state` /
 *     `environmental_context` aspects and bare attribute/characteristic
 *     names); the operation resolves against the owning subject's
 *     endpoints (linter C60, with unit coherence between the served
 *     aspect and the operation's payload).
 *
 *   connector_profile  (foundations) — the protocol binding registry:
 *     the model is protocol-neutral; profiles bind protocols (§14.4).
 *     The four standard profiles (rest_json, mqtt, opc_ua, file_drop —
 *     BUILTIN_CONNECTOR_PROFILES) are known to the kernel without
 *     declaration; packages extend the registry by declaring
 *     `connector_profile` constructs (OCP — new profiles are added by
 *     declaration, never by kernel edits). An endpoint's `profile`
 *     resolves against declared profiles ∪ the built-ins (linter C64).
 *
 * Freshness semantics (§14.5 step 3): served values are timestamped; a
 * stale value degrades the verdict to `indeterminate` — never fail (a
 * network outage is not a metrological event), never a silent pass
 * (silence is not evidence). The runtime half lives in the smart app's
 * verdict service (browser/src/services/verdict.service.ts); the window
 * parser is parseFreshnessWindow in src/time.ts.
 *
 * Maps 1:1 to the OIML SMART domain model layer (data/<rec>/model/
 * twin.yaml): the YAML side carries `endpoints:` / `serves:` registries;
 * the codecs emit/parse the subject blocks (construct-symmetric,
 * TODO.refactor/16).
 */

/** Operation kinds (§14.4): pull a current value | push on change |
 *  trigger a process. */
export const ENDPOINT_OPERATION_KINDS = [
  'query',
  'subscribe',
  'invoke',
] as const;
export type EndpointOperationKind = (typeof ENDPOINT_OPERATION_KINDS)[number];

/** Access scopes (§14.4): who may call what. */
export const ENDPOINT_ACCESS_SCOPES = [
  'public',
  'registered',
  'authority',
] as const;
export type EndpointAccessScope = (typeof ENDPOINT_ACCESS_SCOPES)[number];

/**
 * The payload schema of an operation (§14.4): a QuantityValue per INV-1,
 * always with unit and timestamp. `unit` carries the package register's
 * dimensionless unit id (e.g. R 60's `dimensionless` entry) for
 * non-quantity payloads (state reports, diagnostic reports).
 */
export interface EndpointPayload {
  /** Quantity kind of the served value (mass, state, diagnostic_report, …). */
  quantityKind: string;
  /** Unit id from the package's quantity register; the register's
   *  dimensionless id (e.g. `dimensionless`) when the payload is
   *  non-quantity. */
  unit: string;
  /** Served values carry timestamps (§14.5) — must be true (C61): a value
   *  without a time is not evidence. */
  timestamp: boolean;
}

/** operation <name> { … } — one operation of an endpoint. */
export interface EndpointOperation {
  name: string;
  /** query | subscribe | invoke (ENDPOINT_OPERATION_KINDS; C60/C62 flag others). */
  kind: string;
  /**
   * The aspects this operation serves (query/subscribe face) — logical
   * aspect names in the owning subject's vocabulary (attribute ids,
   * characteristic names, the reserved `state` / `environmental_context`
   * aspects); comma- or space-separated in the surface syntax.
   */
  serves: string[];
  /** The processes this operation invokes (invoke face) — behavior ids. */
  does: string[];
  /** The payload schema; null when undeclared (C61). */
  payload: EndpointPayload | null;
}

/**
 * endpoint <id> — the subject's declared API surface (IS-level). Nested in
 * the subject's `is { … }` block; the owning subject is implicit.
 */
export interface Endpoint {
  id: string;
  operations: EndpointOperation[];
  /** Access scope → operation names. Every operation is covered by
   *  exactly one scope (C62); scopes are public | registered | authority. */
  access: Partial<Record<EndpointAccessScope, string[]>>;
  /** Connector profile id — a declared connector_profile or one of the
   *  built-ins (C64). */
  profile: string;
}

/**
 * serve <aspect> via <operation> { fresh_within <duration> } — the
 * HAS-level binding from an aspect to an endpoint operation (§14.4).
 * `freshWithin` is the freshness window: ISO-8601 duration or the
 * shorthand form (`5s`, `500ms`, `1min`, `1h`, `1d`); empty = C63 (a live
 * binding without fresh_within is an error — §14.12).
 */
export interface ServeBinding {
  /** The served aspect path (task-03 scope vocabulary:
   *  [level.]{parameters|classification|test_context}.<key>, the reserved
   *  `state` / `environmental_context` aspects, or a bare
   *  attribute/characteristic/dimension name). */
  aspect: string;
  /** The serving operation name (resolves against the owning subject's
   *  endpoints — C60). */
  via: string;
  /** The freshness window (e.g. `5s`, `PT1M`); empty when undeclared (C63). */
  freshWithin: string;
}

/** connector_profile <id> — a protocol binding declared per endpoint family. */
export interface ConnectorProfile {
  id: string;
  /** The bound protocol (free text, e.g. "REST/JSON", "MQTT", "OPC-UA"). */
  protocol: string;
  /** What the profile carries / how the operation kinds map. */
  description: string;
  referenceIds: string[];
}

/**
 * The four standard connector profiles (§14.4) — known to the kernel
 * without declaration; the linter (C64) resolves endpoint profiles
 * against declared connector_profile constructs ∪ this set. The registry
 * is OCP-extensible: packages add profiles by declaring them.
 */
export const BUILTIN_CONNECTOR_PROFILES: Readonly<
  Record<string, { protocol: string; description: string }>
> = {
  rest_json: {
    protocol: 'REST/JSON',
    description:
      'HTTP resource endpoints — query → GET, subscribe → server-push stream, invoke → POST; JSON payloads.',
  },
  mqtt: {
    protocol: 'MQTT',
    description:
      'Pub/sub telemetry — subscribe → topic subscription, query → retained topic read, invoke → command topic.',
  },
  opc_ua: {
    protocol: 'OPC-UA',
    description:
      'Industrial interoperability — query → read, subscribe → monitored items, invoke → method call.',
  },
  file_drop: {
    protocol: 'file drop',
    description:
      'Batch/plugin sources (§14.7) — values arrive as dropped files/records; query reads the latest drop.',
  },
};
