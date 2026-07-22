/**
 * Time primitives (Primmel v3, TODO.roadmap/06; doctrine §6.6).
 *
 * Three primitive value types — `date`, `datetime`, `duration` — plus the
 * structures built on them: `period` (an interval with start and end),
 * validity windows (the period for which a record holds: certificates,
 * calibrations), and edition pins (INV-8: every definition executed in a
 * run is version-pinned).
 *
 * The validators live in src/time.ts; this module carries the types.
 */

/** ISO 8601 calendar date (YYYY-MM-DD). */
export type IsoDate = string;
/** ISO 8601 date-time (YYYY-MM-DDTHH:MM[:SS][Z|±HH:MM]). */
export type IsoDateTime = string;
/** ISO 8601 duration (PnYnMnD[TnHnMnS] or PnW). */
export type IsoDuration = string;
/**
 * ISO 8601 interval — `start/end`, `start/duration`, or `duration/end`,
 * where start/end are dates or date-times.
 */
export type IsoPeriod = string;

/**
 * A validity window: the period for which a record holds. "Currently
 * valid" is a computed predicate (start ≤ now ≤ end), never a status
 * flag. Invariant: end is not before start (checkValidityWindow).
 */
export interface ValidityWindow {
  start: IsoDate | IsoDateTime;
  end: IsoDate | IsoDateTime;
}

/**
 * An edition pin (INV-8): one definition pinned to the version that was
 * executed, so a later edition re-judges history explicitly instead of
 * silently. Instance.definitionVersions is a map of these.
 */
export interface EditionPin {
  /** The definition being pinned (subject/attribute-registry id). */
  definition: string;
  /** The pinned edition (e.g. "2021", "1.0.0"). */
  version: string;
}
