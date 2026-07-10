import Gateway, { ExclusiveGateway } from '../../types/Gateway';
import { escapeString } from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
import { Dumper, Parser } from '../types';

export const parseExclusiveGate: Parser = function (id, data) {
  const gateway: ExclusiveGateway = {
    id: id,
    gatewayType: 'exclusive_gateway',
    label: '',
  };

  forEachEntry(
    data,
    (command, value) => {
      if (command === 'label') {
        gateway.label = unwrapped(value);
      } else {
        return false;
      }
      return true;
    },
    { construct: 'Exclusive gateway', id },
  );

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
    out += '  label "' + escapeString(egate.label) + '"\n';
  }
  out += '}\n';
  return out;
}
