// ─────────────────────────────────────────────────────────────────────
// dual (Primmel v3, TODO.roadmap/06) — the IS↔HAS value duality relation
// (doctrine §3.2/§9.6): ONE quantity, two aspect roles:
//
//   dual e-max-rating {
//     attribute e_max
//     designed  { value 2.2 unit t tolerance 0.5 }
//     exhibited { value 2.1998 unit t uncertainty 0.0002 }
//   }
//
// `designed` is the IS side (the rating the design promises — carries
// tolerance); `exhibited` is the HAS side (the observation an instance
// shows — carries uncertainty). Both roles are optional individually,
// but at least one must be present; when both are stated they must be
// kind-coherent (same quantity kind, compatible unit) — linter C34
// (duality-coherence), enabling as-found verification.
// ─────────────────────────────────────────────────────────────────────

import tokenize, {
  stripWrapping,
  tokenizePackage,
  unwrapBlock,
} from '../tokenize';
import { dumpQuantityBlock, readQuantityBlock } from './quantity';
import type { ConstructDefinition } from './index';
import type { Dual } from '../../types/Quantity';

const parseDual: ConstructDefinition['parse'] = function (id, data) {
  const result: Dual = {
    id,
    attribute: '',
    referenceIds: [],
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'attribute') {
      result.attribute = stripWrapping(t[i++]);
    } else if (cmd === 'designed') {
      result.designed = readQuantityBlock(unwrapBlock(t[i++]));
    } else if (cmd === 'exhibited') {
      result.exhibited = readQuantityBlock(unwrapBlock(t[i++]));
    } else if (cmd === 'reference') {
      result.referenceIds = tokenize(stripWrapping(t[i++]))
        .map(stripWrapping)
        .filter(s => s.length > 0);
    } else {
      unwrapBlock(t[i++]);
    }
  }

  return ctx => {
    ctx.duals[id] = result;
    return ctx;
  };
};

// ── dump ─────────────────────────────────────────────────────────────

const dumpDual = function (dual: Dual): string {
  let out = 'dual ' + dual.id + ' {\n';
  if (dual.attribute) {
    out += '  attribute ' + dual.attribute + '\n';
  }
  if (dual.designed) {
    out += '  designed ' + dumpQuantityBlock(dual.designed) + '\n';
  }
  if (dual.exhibited) {
    out += '  exhibited ' + dumpQuantityBlock(dual.exhibited) + '\n';
  }
  if (dual.referenceIds.length > 0) {
    out += '  reference { ' + dual.referenceIds.join(' ') + ' }\n';
  }
  out += '}\n';
  return out;
};

export const dualConstruct = {
  keyword: 'dual',
  field: 'duals',
  takesID: true,
  parse: parseDual,
  dump: dumpDual,
} as const;
