/**
 * Artifact constructs (Primmel v3, TODO.roadmap/09 — gap audit G2).
 *
 * An artifact is a required OUTPUT OF THE SUBJECT (the instrument), not a
 * record of the test — the MECE firewall against EvidenceRecord (doctrine
 * ch. 02 §2.3/§2.4: artifact definitions are an IS aspect, artifact
 * instances a HAS aspect):
 *
 *   artifact_definition  (IS) — what the instrument must produce: a
 *     content contract (named, typed fields + structure + media) and a
 *     produced-when rule (per measurement | per interval | on event).
 *     Referenced by id from the subject's `is.artifacts { … }` slot; the
 *     definition is a top-level construct (like condition_set, which
 *     `is.designed_conditions` references by id) so requirements can bind
 *     to it and instances can name it in `of`.
 *
 *   artifact_instance  (HAS/evidence) — one produced output, checked
 *     against the contract: `of` names the definition, `by` the producing
 *     subject instance (sample/twin), `content` carries the contract
 *     fields as QuantityValue-shaped entries, and `links` names the
 *     run/report ids the instance is evidence for. Referenced by id from
 *     the subject's `has.artifact_instances { … }` slot.
 *
 * The driver is R 91's evidence file (R 91-1, 6.6/7.2.2/7.3): an
 * electronic artifact the instrument must produce per enforcement
 * measurement, with defined content (speed, ego speed, direction,
 * timestamps, site/alignment, image evidence).
 *
 * Maps 1:1 to the OIML SMART domain model layer (data/<rec>/model/
 * artifacts.yaml); instances ride the standard's sample-data flows
 * (test_report.artifact_instances).
 */

import type { InstanceValue } from './Instance';
import type { SourceRef } from './Subject';

/** One named, typed field of an artifact's content contract. */
export interface ArtifactField {
  name: string;
  /**
   * Declared type of the field — a quantity kind (speed, time, …), a data
   * type (string, datetime, …), or one of the structural kinds
   * 'media' (refined by a media entry) / 'structure' (a nested block).
   */
  type: string;
  /** Optional fields may be absent from a conforming instance. */
  optional: boolean;
  /** Free-text description of the field (e.g. its source clause item). */
  description: string;
}

/** A media refinement of one contract field (formats + role). */
export interface ArtifactMedia {
  /** The contract field this entry refines (must be a declared field). */
  field: string;
  /** Allowed media kinds/formats (e.g. jpeg, png, mp4). */
  kinds: string[];
  /** What the media shows (e.g. "vehicle identification"). */
  role: string;
}

/** The content contract of an artifact definition (fields/structure/media). */
export interface ArtifactContentContract {
  /** Named, typed contract fields (C45: every field has a type). */
  fields: ArtifactField[];
  /** Container/structure description (free text; '' = unstructured). */
  structure: string;
  /** Media refinements of media-typed fields. */
  media: ArtifactMedia[];
}

/**
 * When the instrument must produce the artifact. Exactly one kind:
 *   per_measurement — one instance per (enforcement) measurement run;
 *   per_interval    — one instance per recurring interval (ISO-8601
 *                     duration, e.g. a daily diagnostic log);
 *   on_event        — one instance per occurrence of a named event
 *                     (e.g. fault-detected).
 */
export interface ProducedWhen {
  /** 'per_measurement' | 'per_interval' | 'on_event'. */
  kind: string;
  /** kind=per_interval: the ISO-8601 recurrence duration. */
  interval?: string;
  /** kind=on_event: the triggering event name. */
  event?: string;
}

/** artifact_definition <id> — a required output artifact of the subject (IS). */
export interface ArtifactDefinition {
  id: string;
  name: string;
  /** Free-text description of the artifact. */
  description: string;
  contentContract: ArtifactContentContract;
  producedWhen: ProducedWhen;
  /** Retention requirement (free text, e.g. "approx. three months (secure)"). */
  retention: string;
  source: SourceRef | null;
  /** All provenance bindings (docs/primmel/18 §18.4 — the derives-from
   *  fold target; `source` stays the first entry). */
  sourceRefs?: SourceRef[];
  referenceIds: string[];
  /** The unified typed references (docs/primmel/18) — semantic
   *  predicates stay here; citation kinds fold onto source/referenceIds. */
  refs?: import('./Ref').Ref[];
}

/**
 * artifact_instance <id> — one produced artifact, recorded as evidence (HAS).
 * Runs and reports reference the instance as evidence (via `links`).
 */
export interface ArtifactInstance {
  id: string;
  /** The artifact_definition id this instance conforms to. */
  of: string;
  /** ISO-8601 production timestamp. */
  producedAt: string;
  /** The producing subject instance (sample id / twin ref). */
  by: string;
  /**
   * The contract fields, populated: name → value (QuantityValue shape —
   * value + optional unit/kind/uncertainty/tolerance; INV-1 applies).
   */
  content: Record<string, InstanceValue>;
  /** Run/report ids this instance is linked as evidence to. */
  links: string[];
  referenceIds: string[];
}
