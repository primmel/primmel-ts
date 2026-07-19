/**
 * Series declarations (OIML SMART TODO.refactor/05 — L6).
 *
 * A series is an ordered array of ROW OBJECTS: declared axis fields plus
 * one measured CELL quantity. The OCL series ops (reading_at / window /
 * drift_over / pairwise_max_difference / group_by / change_since) select
 * over these identifiers, so symbols, test variables, and form datalist
 * fields that hold series must declare the shape explicitly.
 *
 * Maps 1:1 to `series_declaration` in data/schemas/form.yaml (axes + cell).
 */

/** One typed axis of a series row. */
export interface SeriesAxis {
  /** Row field id carrying the axis values (e.g. elapsed_min). */
  id: string;
  /** Measurement unit of the axis values (numeric/time axes, e.g. min). */
  unit: string;
  /** Value type for reference/enum axes (e.g. reference_material). */
  type: string;
  /** Axis role — at most one axis may carry role 'time'. */
  role: string;
}

/** Typed series shape: axes + the measured cell quantity. */
export interface SeriesDecl {
  axes: SeriesAxis[];
  /** Row field id of the measured cell quantity (e.g. change_v). */
  cellSymbol: string;
  /** Measurement unit of the cell values. */
  cellUnit: string;
}
