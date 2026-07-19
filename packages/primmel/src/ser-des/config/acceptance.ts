// ─────────────────────────────────────────────────────────────────────
// Shared acceptance decision parser + dumper.
//
// Maps $defs/acceptanceDecision of data/schemas/{rc,cc,verdicts}.yaml
// (TODO.refactor/10): how a limit comparison decides conformity.
// Attachable to requirement limits, conformance tests, and verdicts:
//
//   acceptance {
//     rule guarded
//     guard_band { kind NSFa value 0.5 }
//     uncertainty { max_ratio_to_mpe 0.333 }
//     criterion D/NSFa
//     statistics { method error_distribution on_basis_of errors permits count_override }
//   }
// ─────────────────────────────────────────────────────────────────────

import type AcceptanceDecision from '../../types/Acceptance';
import tokenize from '../tokenize';
import { unwrapBlock, stripWrapping } from '../tokenize';

const VALID_RULES = ['shared_risk', 'guarded'];
const VALID_GUARD_KINDS = ['NSFa', 'NSFd', 'absolute', 'ratio'];
const VALID_CRITERIA = ['I/MPE', 'D/NSFa', 'D/NSFd', 'n/a'];

/** Parse the content of an `acceptance { … }` block. */
export function parseAcceptance(block: string): AcceptanceDecision {
  const a: AcceptanceDecision = {
    rule: '',
    guardBand: null,
    uncertainty: null,
    criterion: '',
    statistics: null,
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'rule') {
      const r = stripWrapping(t[i++]);
      if (!VALID_RULES.includes(r)) {
        throw new Error(
          `Parsing error: acceptance: Unknown rule ${r} (valid: ${VALID_RULES.join(
            ', ',
          )})`,
        );
      }
      a.rule = r;
    } else if (cmd === 'guard_band') {
      const gt = tokenize(unwrapBlock(t[i++]));
      const band = { kind: '', value: 0 };
      let j = 0;
      while (j < gt.length) {
        const gc = gt[j++];
        if (j >= gt.length) {
          break;
        }
        if (gc === 'kind') {
          band.kind = stripWrapping(gt[j++]);
        } else if (gc === 'value') {
          band.value = Number(stripWrapping(gt[j++]));
        } else {
          unwrapBlock(gt[j++]);
        }
      }
      if (!VALID_GUARD_KINDS.includes(band.kind)) {
        throw new Error(
          `Parsing error: acceptance: Unknown guard_band kind ${band.kind} (valid: ${VALID_GUARD_KINDS.join(
            ', ',
          )})`,
        );
      }
      a.guardBand = band;
    } else if (cmd === 'uncertainty') {
      const ut = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < ut.length) {
        const uc = ut[j++];
        if (j >= ut.length) {
          break;
        }
        if (uc === 'max_ratio_to_mpe') {
          a.uncertainty = { maxRatioToMpe: Number(stripWrapping(ut[j++])) };
        } else {
          unwrapBlock(ut[j++]);
        }
      }
    } else if (cmd === 'criterion') {
      const c = stripWrapping(t[i++]);
      if (!VALID_CRITERIA.includes(c)) {
        throw new Error(
          `Parsing error: acceptance: Unknown criterion ${c} (valid: ${VALID_CRITERIA.join(
            ', ',
          )})`,
        );
      }
      a.criterion = c;
    } else if (cmd === 'statistics') {
      const st = tokenize(unwrapBlock(t[i++]));
      const stats = { method: '', onBasisOf: '', permits: '' };
      let j = 0;
      while (j < st.length) {
        const sc = st[j++];
        if (j >= st.length) {
          break;
        }
        if (sc === 'method') {
          stats.method = stripWrapping(st[j++]);
        } else if (sc === 'on_basis_of') {
          stats.onBasisOf = stripWrapping(st[j++]);
        } else if (sc === 'permits') {
          stats.permits = stripWrapping(st[j++]);
        } else {
          unwrapBlock(st[j++]);
        }
      }
      a.statistics = stats;
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return a;
}

/**
 * Dump an acceptance decision as a single-line `acceptance { … }` block
 * prefixed by `indent` (no trailing newline) — callers embed it in
 * their own line layout.
 */
export function dumpAcceptance(
  a: AcceptanceDecision,
  indent: string,
): string {
  let out = indent + 'acceptance { ';
  if (a.rule) {
    out += 'rule ' + a.rule + ' ';
  }
  if (a.guardBand) {
    out +=
      'guard_band { kind ' +
      a.guardBand.kind +
      ' value ' +
      a.guardBand.value +
      ' } ';
  }
  if (a.uncertainty) {
    out +=
      'uncertainty { max_ratio_to_mpe ' + a.uncertainty.maxRatioToMpe + ' } ';
  }
  if (a.criterion) {
    out += 'criterion ' + a.criterion + ' ';
  }
  if (a.statistics) {
    out +=
      'statistics { method ' +
      a.statistics.method +
      ' on_basis_of ' +
      a.statistics.onBasisOf +
      ' permits ' +
      a.statistics.permits +
      ' } ';
  }
  out += '}';
  return out;
}
