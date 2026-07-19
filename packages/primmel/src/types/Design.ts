/**
 * Conformance-test design block (data/schemas/cc.yaml $defs/testDesign,
 * TODO.refactor/09): structured test-design metadata — minimum valid
 * measurement counts, the severity × environment-class matrix
 * (R 91-2, 6.1 Tables 1–2), shared test-point set reference, temporal
 * schedule, and specimen governance (R 60-2, 2.3/2.4).
 */

export interface DesignCountOverride {
  condition: string;
  by: string;
  note: string;
}

export interface DesignCount {
  /** Count-context id (e.g. field_automatic). */
  context: string;
  minCount: number;
  clause: string;
  note: string;
  /** Declared permission to accept fewer than min_count; null when absent. */
  override: DesignCountOverride | null;
}

/** One OIML D 11 severity cell (level/code/amplitude + unit/note/variable). */
export interface SeverityCell {
  level: number | null;
  code: string;
  amplitude: number | null;
  unit: string;
  note: string;
  /** Test variable carrying this severity value (the executable surface). */
  variable: string;
}

/** A severity value, optionally split per supply column (AC/DC/vehicle-DC). */
export interface SeverityValue extends SeverityCell {
  columns: {
    ac: SeverityCell | null;
    dc: SeverityCell | null;
    vehicleDc: SeverityCell | null;
  } | null;
}

export interface DesignSeverity {
  /** Source table row label (e.g. "1 dry heat (operating)"). */
  row: string;
  /** Environment class id → severity for that class (null = n/a row). */
  envClassValues: Record<string, SeverityValue | null>;
  /** Row evaluation criterion (I/MPE | D/NSFa | D/NSFd | n/a). */
  criterion: string;
  /** Source table footnote ids applying to this row. */
  footnotes: string[];
}

export interface DesignSchedulePhase {
  id: string;
  condition: string;
  /** ISO-8601 duration/interval for the phase. */
  window: string;
}

export interface DesignSchedule {
  /** ISO-8601 duration (e.g. P7D). */
  duration: string;
  /** ISO-8601 interval between measurements (e.g. PT24H). */
  cadence: string;
  phases: DesignSchedulePhase[];
  constraints: string[];
}

export interface DesignSpecimens {
  count: number | null;
  maxAdditional: number | null;
  /** OCL selector (ocl{...}) when selection is inline. */
  selection: string;
  /** Sample-selection rule id when selection is a { ref } block. */
  selectionRef: string;
  /** same_eut | same_eut_with_additional. */
  continuity: string;
  /** specimen_governance rule ids. */
  rules: string[];
}

export default interface TestDesign {
  counts: DesignCount[];
  severities: DesignSeverity[];
  /** Shared test-point set id (test_point_set construct). */
  testPointsRef: string;
  schedule: DesignSchedule | null;
  specimens: DesignSpecimens | null;
}
