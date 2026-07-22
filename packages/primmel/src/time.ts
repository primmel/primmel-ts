// ─────────────────────────────────────────────────────────────────────
// Time primitives (TODO.roadmap/06; doctrine §6.6): parse/validate for
// `date`, `datetime`, `duration`, `period`, plus the validity-window and
// edition-pin helpers.
//
// The linter (C35 time-format) checks timer-event recurrence periods
// against isDuration — closing task 02's deferred format check (C15
// checks presence only) — and instance values against the time-typed
// attribute definitions (value_type date | datetime | duration | period).
//
// Pure functions only — no fs, no runtime state.
// ─────────────────────────────────────────────────────────────────────

import type { EditionPin, ValidityWindow } from './types/Time';

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
// ISO 8601 duration: PnW, or PnYnMnD with an optional TnHnMnS part. The
// designators must be in order; each number may carry a decimal fraction.
const DURATION =
  /^P(?:(\d+(?:[.,]\d+)?)Y)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?(?:(\d+(?:[.,]\d+)?)W)?$/;

function daysInMonth(year: number, month: number): number {
  // month is 1-based; Date rolls over, so day 0 of month+1 is the last
  // day of the month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** ISO 8601 calendar date with REAL calendar validation (leap years). */
export function isDate(s: string): boolean {
  const m = DATE.exec(s);
  if (!m) {
    return false;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return (
    month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
  );
}

/** ISO 8601 date-time (calendar + 24h clock, optional zone). */
export function isDateTime(s: string): boolean {
  const m = DATETIME.exec(s);
  if (!m) {
    return false;
  }
  if (!isDate(m.slice(1, 4).join('-'))) {
    return false;
  }
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] === undefined ? 0 : Number(m[6]);
  return hour <= 23 && minute <= 59 && second <= 60; // 60: leap second
}

/**
 * ISO 8601 duration. A bare "P" (or "PT") is NOT a duration — at least
 * one component is required, and the week form never combines with
 * calendar components (ISO 8601-1:2019, 5.5.3).
 */
export function isDuration(s: string): boolean {
  const m = DURATION.exec(s);
  if (!m) {
    return false;
  }
  const components = m.slice(1).filter(x => x !== undefined);
  if (components.length === 0) {
    return false;
  }
  // Week form is exclusive.
  return m[7] === undefined || components.length === 1;
}

/**
 * ISO 8601 interval: `start/end`, `start/duration`, or `duration/end`
 * (start/end are dates or date-times). When both bounds are dates or
 * date-times, end must not be before start.
 */
export function isPeriod(s: string): boolean {
  const parts = s.split('/');
  if (parts.length !== 2) {
    return false;
  }
  const [a, b] = parts;
  const aDate = isDate(a) || isDateTime(a);
  const bDate = isDate(b) || isDateTime(b);
  if (aDate && bDate) {
    // ISO lexicographic order agrees with chronological order here.
    return a <= b;
  }
  if (aDate && isDuration(b)) {
    return true;
  }
  return isDuration(a) && bDate;
}

/** Validate one time-typed value by primitive name; unknown names pass. */
export function isValidTimeValue(
  primitive: 'date' | 'datetime' | 'duration' | 'period',
  value: string,
): boolean {
  switch (primitive) {
    case 'date':
      return isDate(value);
    case 'datetime':
      return isDateTime(value);
    case 'duration':
      return isDuration(value);
    case 'period':
      return isPeriod(value);
  }
}

/**
 * A validity window holds when both bounds are dates/date-times and the
 * end is not before the start ("currently valid" is a computed predicate,
 * never a flag — doctrine §6.6). Returns an error message, or null.
 */
export function checkValidityWindow(w: ValidityWindow): string | null {
  const startOk = isDate(w.start) || isDateTime(w.start);
  const endOk = isDate(w.end) || isDateTime(w.end);
  if (!startOk) {
    return `validity window start "${w.start}" is not an ISO 8601 date/datetime`;
  }
  if (!endOk) {
    return `validity window end "${w.end}" is not an ISO 8601 date/datetime`;
  }
  if (w.end < w.start) {
    return `validity window end ${w.end} is before start ${w.start}`;
  }
  return null;
}

/**
 * Edition pins (INV-8): normalize a definitionVersions map into a sorted
 * pin list (deterministic emission in test reports).
 */
export function editionPins(map: Record<string, string>): EditionPin[] {
  return Object.keys(map)
    .sort()
    .map(definition => ({ definition, version: map[definition] }));
}
