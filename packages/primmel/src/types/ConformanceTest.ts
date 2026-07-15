import type Reference from './Reference';

export interface ConformanceTestStep {
  order: number;
  action: string;
}

export default interface ConformanceTest {
  id: string;
  name: string;
  type: string;
  reference: string;
  targets: string[];
  procedure: ConformanceTestStep[];
  measurements: string[];
}

export type { Reference };
