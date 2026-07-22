// ─────────────────────────────────────────────────────────────────────
// `map_profile` construct — the in-model serialization of the mapping
// primitive (TODO.roadmap/04; concept doc §5.5). The standalone `.prm`
// JSON form lives in ser-des/prm.ts.
//
// v2 form (kept, byte-compatible):
//
//   map_profile StdS {
//     description "Mappings into Standard S"
//     mapping {
//       OpA -> StdS#Process5
//       OpB -> Process3
//     }
//   }
//
// Spaces around the arrow are optional: the v2 compact form
// `OpA->StdS#Process5` parses identically (dumping always re-emits the
// spaced form).
//
// v3 additions — an optional per-pair block with the fulfilment metadata
// and an authored coverage assertion (checked against the calculus, C23):
//
//   mapping {
//     OpA -> StdS#Process5 {
//       description "Batch logging fulfils the record requirement."
//       justification "The roaster writes the batch record on completion."
//       coverage full
//     }
//   }
//
// and a profile-level `coverage` block asserting the computed coverage of
// reference components (regression tripwires — also C23-checked):
//
//   coverage {
//     StdS#Process1 partial
//     Process2 minimal
//   }
//
// The profile's namespace is the TARGET (reference) namespace; bare
// target ids are scoped by it. Sources are always local component ids.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { forEachEntry, unwrapped } from '../parse-block';
import tokenize, {
  escapeString,
  stripWrapping,
  unwrapBlock,
} from '../tokenize';
import { dumpBareSafe } from './field-parser';
import type MapProfile from '../../types/MapProfile';
import type { CoverageLevel, MappingPair } from '../../types/MapProfile';

const COVERAGE_LEVELS = new Set<CoverageLevel>([
  'full',
  'minimal',
  'partial',
  'none',
]);

/** Read one pair's metadata block: description / justification / coverage. */
function parsePairBlock(id: string, block: string): MappingPair {
  const pair: MappingPair = {
    target: '',
    description: '',
    justification: '',
    coverage: '',
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'description') {
      pair.description = stripWrapping(t[i++]);
    } else if (cmd === 'justification') {
      pair.justification = stripWrapping(t[i++]);
    } else if (cmd === 'coverage') {
      const level = stripWrapping(t[i++]) as CoverageLevel;
      if (!COVERAGE_LEVELS.has(level)) {
        throw new Error(
          `Parsing error: map_profile. ID ${id}: Unknown coverage level "${level}" (valid: full, minimal, partial, none)`,
        );
      }
      pair.coverage = level;
    } else {
      // forward-compat: skip `kw value`, `kw { block }`, `kw value { block }`
      if (t[i].startsWith('{')) {
        i++;
      } else {
        i++;
        if (i < t.length && t[i].startsWith('{')) {
          i++;
        }
      }
    }
  }
  return pair;
}

/**
 * Split compact `A->B` tokens into `A`, `->`, `B`. v2 tolerated the
 * arrow with spaces optional (`OpA->StdS#Process5`); the tokenizer keeps
 * whitespace-free text as one token, so the stream is expanded before
 * parsing. Quoted strings and brace blocks are never split. Genuinely
 * malformed lines (missing arrow, double arrow) still fail the strict
 * `Expecting "->"` check below.
 */
function expandCompactArrows(tokens: string[]): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    if (
      t.startsWith('"') ||
      t.startsWith('{') ||
      (!t.includes('->') && !t.includes('→'))
    ) {
      out.push(t);
      continue;
    }
    out.push(...t.split(/(->|→)/).filter(p => p !== ''));
  }
  return out;
}

/** Read a `mapping { … }` block: `A -> B` lines with optional pair blocks. */
function parseMappingBlock(
  id: string,
  block: string,
): Record<string, MappingPair[]> {
  const mappings: Record<string, MappingPair[]> = {};
  const t = expandCompactArrows(tokenize(block));
  let i = 0;
  while (i < t.length) {
    const source = stripWrapping(t[i++]);
    if (!source) {
      break;
    }
    const arrow = t[i++];
    if (arrow !== '->' && arrow !== '→') {
      throw new Error(
        `Parsing error: map_profile. ID ${id}: Expecting "->" after mapping source "${source}" (got "${arrow ?? ''}")`,
      );
    }
    const target = stripWrapping(t[i++]);
    let pair: MappingPair = {
      target,
      description: '',
      justification: '',
      coverage: '',
    };
    if (i < t.length && t[i].startsWith('{')) {
      pair = { ...parsePairBlock(id, unwrapBlock(t[i++])), target };
    }
    (mappings[source] ??= []).push(pair);
  }
  return mappings;
}

/** Read a profile-level `coverage { … }` block: `<refId> <level>` pairs. */
function parseCoverageBlock(
  id: string,
  block: string,
): Record<string, CoverageLevel> {
  const coverage: Record<string, CoverageLevel> = {};
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const ref = stripWrapping(t[i++]);
    if (!ref) {
      break;
    }
    const level = stripWrapping(t[i++]) as CoverageLevel;
    if (!COVERAGE_LEVELS.has(level)) {
      throw new Error(
        `Parsing error: map_profile. ID ${id}: Unknown coverage level "${level}" for "${ref}" (valid: full, minimal, partial, none)`,
      );
    }
    coverage[ref] = level;
  }
  return coverage;
}

export const parseMapProfile: Parser = function (namespace, data) {
  const result: MapProfile = {
    namespace,
    description: '',
    mappings: {},
    coverage: {},
  };

  forEachEntry(
    data,
    (command, value) => {
      if (command === 'description') {
        result.description = unwrapped(value);
      } else if (command === 'mapping') {
        // mapping block: source → target pairs (v3: optional metadata block)
        const parsed = parseMappingBlock(namespace, unwrapBlock(value()));
        for (const [source, pairs] of Object.entries(parsed)) {
          (result.mappings[source] ??= []).push(...pairs);
        }
      } else if (command === 'coverage') {
        // profile-level coverage assertions (C23 checks them against the
        // computed calculus)
        Object.assign(
          result.coverage,
          parseCoverageBlock(namespace, unwrapBlock(value())),
        );
      } else {
        return false;
      }
      return true;
    },
    { construct: 'map_profile', id: namespace },
  );

  return ctx => {
    ctx.mapProfiles[namespace] = result;
    return ctx;
  };
};

export const dumpMapProfile: Dumper<MapProfile> = function (mp) {
  let out = 'map_profile ' + mp.namespace + ' {\n';
  if (mp.description) {
    out += '  description "' + escapeString(mp.description) + '"\n';
  }
  const keys = Object.keys(mp.mappings);
  if (keys.length > 0) {
    out += '  mapping {\n';
    for (const k of keys) {
      for (const pair of mp.mappings[k]) {
        const head =
          '    ' + dumpBareSafe(k) + ' -> ' + dumpBareSafe(pair.target);
        const meta: string[] = [];
        if (pair.description) {
          meta.push('description "' + escapeString(pair.description) + '"');
        }
        if (pair.justification) {
          meta.push('justification "' + escapeString(pair.justification) + '"');
        }
        if (pair.coverage) {
          meta.push('coverage ' + pair.coverage);
        }
        out +=
          meta.length > 0
            ? head + ' { ' + meta.join(' ') + ' }\n'
            : head + '\n';
      }
    }
    out += '  }\n';
  }
  const coverageKeys = Object.keys(mp.coverage ?? {});
  if (coverageKeys.length > 0) {
    out += '  coverage {\n';
    for (const ref of coverageKeys) {
      out += '    ' + dumpBareSafe(ref) + ' ' + mp.coverage[ref] + '\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};
