import Gateway, { ExclusiveGateway } from '../../types/Gateway';
import { removePackage, tokenizePackage } from '../tokenize';
import { Dumper, Parser } from '../types';

export const parseExclusiveGate: Parser = function (id, data) {
  const gateway: ExclusiveGateway = {
    id: id,
    gatewayType: 'exclusive_gateway',
    label: '',
  };
  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'label') {
          gateway.label = removePackage(t[i++]);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: Exclusive gateway. ID ${id}: Expecting value for ${command}`,
        );
      }
    }
  }
  return ctx => {
    ctx.gateways[id] = gateway;
    return ctx;
  };
};

export const dumpGateway: Dumper<Gateway> = function (gate) {
  if (gate.gatewayType === 'exclusive_gateway') {
    return dumpEGate(gate as ExclusiveGateway);
  }
  return '';
};

function dumpEGate(egate: ExclusiveGateway) {
  let out: string = 'exclusive_gateway ' + egate.id + ' {\n';
  if (egate.label !== '') {
    out += '  label "' + egate.label + '"\n';
  }
  out += '}\n';
  return out;
}
