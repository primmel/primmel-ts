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

/**
 * Per-kind metadata: real-traffic field test (TODO.roadmap/19, gap audit
 * G4; R 91-2, 4). N measurements live in counts; the error statistics
 * live in acceptance.statistics — this block carries what those do not:
 * site selection (4.2), traffic conditions (4.3), the reference meter
 * (4.5) with its uncertainty-budget profile key.
 */
export interface DesignField {
  /** Site selection rule (R 91-2, 4.2). */
  siteSelection: string;
  /** Traffic-condition rule (R 91-2, 4.3). */
  trafficConditions: string;
  referenceMeter: {
    description: string;
    /** Key into the standard's uncertainty_budgets profile (tables.yaml). */
    uncertaintyBudget: string;
  } | null;
}

/**
 * Per-kind metadata: traffic-simulator laboratory test (TODO.roadmap/19;
 * R 91-2, 5.2 — the simulator characteristics are test-relevant).
 */
export interface DesignSimulation {
  /** Simulator kind: complete | partial (R 91-2, 5.2 Figures 1-2). */
  simulatorKind: string;
  /** The simulated signal (electrical pulse sequence, light pulses,
      electromagnetic radiation pattern, …). */
  signal: string;
  /** Key into the standard's uncertainty_budgets profile (tables.yaml). */
  uncertaintyBudget: string;
  /** Simulator validation rule (R 91-2, 5.2: road series comparison). */
  validation: string;
}

/** One OIML D 31 examination item (R 91-2, 8.3 tables). */
export interface DesignSoftwareItem {
  /** Item number in the R 91-2, 8.3 tables (1-30). */
  item: number;
  name: string;
  /** OIML D 31 clause (e.g. "6.2.1"). */
  d31: string;
  /** mandatory | optional (R 91-2, 8.3: 8.3.1-8.3.3 mandatory, 8.3.4/8.3.5 optional). */
  obligation: string;
  /** Evaluation methods (AD | VFTM | VFTSw, D 31, 7.3.2). */
  methods: string[];
  /** R 91-2 source clause of the item's table (e.g. "8.3.1"). */
  clause: string;
}

/**
 * Per-kind metadata: D 31 software examination (TODO.roadmap/19; R 91-2,
 * 8). The examination LEVEL (8.2: level A = D 31 normal examination
 * level) plus the per-item obligation/method matrix.
 */
export interface DesignSoftware {
  /** D 31 examination level (e.g. "A"). */
  level: string;
  items: DesignSoftwareItem[];
}

export default interface TestDesign {
  counts: DesignCount[];
  severities: DesignSeverity[];
  /** Shared test-point set id (test_point_set construct). */
  testPointsRef: string;
  schedule: DesignSchedule | null;
  specimens: DesignSpecimens | null;
  /** kind: field — real-traffic field-test metadata (TODO.roadmap/19). */
  field: DesignField | null;
  /** kind: simulation — simulator characteristics (TODO.roadmap/19). */
  simulation: DesignSimulation | null;
  /** kind: software-examination — D 31 level + item matrix (TODO.roadmap/19). */
  software: DesignSoftware | null;
}
