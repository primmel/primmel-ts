// ─────────────────────────────────────────────────────────────────────
// `exclusive_gateway` construct — the workflow routing cascade (smart
// TODO.roadmap/40 batch 5; the packages-as-SSOT epic; closes the kernel
// half of smart's TODO.refactor/16).
//
//   exclusive_gateway test_runs_gateway {
//     label "Determine Required Test Runs"
//     edge conduct_mdlo_tests {
//       condition "[accuracy_class] in ['C', 'D']"
//       label "3 load applications"
//     }
//     edge conduct_mdlo_tests_5runs {
//       condition "[accuracy_class] in ['A', 'B']"
//       label "5 load applications"
//     }
//     edge skip { condition default label "Not applicable" }
//   }
//
// `edge <target-process-id> { … }` is a repeatable, ordered two-token
// facet: the first satisfied condition in declaration order wins, and
// the edge carrying the bare token `default` is the catch-all
// (recommended last — C142 checks the discipline). The condition stays
// an opaque string, never resolved kernel-side (the R26 precedent).
// ─────────────────────────────────────────────────────────────────────

import Gateway, { ExclusiveGateway, GatewayEdge } from '../../types/Gateway';
import tokenize, {
  escapeString,
  stripWrapping,
  unwrapBlock,
} from '../tokenize';
import { dumpBareSafe } from './field-parser';
import { forEachEntry, unwrapped } from '../parse-block';
import { Dumper, Parser } from '../types';

export const parseExclusiveGate: Parser = function (id, data) {
  const gateway: ExclusiveGateway = {
    id: id,
    gatewayType: 'exclusive_gateway',
    label: '',
    edges: [],
  };

  forEachEntry(
    data,
    (command, value) => {
      if (command === 'label') {
        gateway.label = unwrapped(value);
      } else if (command === 'edge') {
        // edge <target-process-id> { condition "…"|default label "…" }
        const edge: GatewayEdge = {
          target: stripWrapping(value()),
          condition: '',
          label: '',
        };
        const et = tokenize(unwrapBlock(value()));
        for (let j = 0; j + 1 < et.length; j += 2) {
          if (et[j] === 'condition') {
            edge.condition = stripWrapping(et[j + 1]);
          } else if (et[j] === 'label') {
            edge.label = stripWrapping(et[j + 1]);
          }
        }
        gateway.edges.push(edge);
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
  for (const e of egate.edges ?? []) {
    out += '  edge ' + dumpBareSafe(e.target) + ' {';
    if (e.condition === 'default') {
      out += ' condition default';
    } else if (e.condition !== '') {
      out += ' condition "' + escapeString(e.condition) + '"';
    }
    if (e.label !== '') {
      out += ' label "' + escapeString(e.label) + '"';
    }
    out += ' }\n';
  }
  out += '}\n';
  return out;
}
