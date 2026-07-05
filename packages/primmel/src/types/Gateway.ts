export type GatewayKind = 'exclusive_gateway' | 'parallel_gateway';

export default interface Gateway {
  id: string;
  gatewayType: GatewayKind;
  label?: string;
}

export interface ExclusiveGateway extends Gateway {
  gatewayType: 'exclusive_gateway';
  label: string;
}

export interface ParallelGateway extends Gateway {
  gatewayType: 'parallel_gateway';
}
