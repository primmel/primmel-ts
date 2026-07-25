// ─────────────────────────────────────────────────────────────────────
// Shared source_discrepancy parser + dumper.
//
// First-class annotation for a self-contradicting source (rc.yaml
// $defs/source_discrepancy, TODO.refactor/11). The same block attaches
// to requirements, requirement limits, limit accepts blocks,
// conformance tests, form fields, field evaluation rules, tables,
// table profiles, and notes:
//
//   source_discrepancy {
//     summary "R 60-3 form criterion contradicts the R 60-1 requirement text"
//     sources { "urn:oiml:pub:r:60-1:2021#clause-5.6.3.1" "urn:oiml:pub:r:60-3:2021#clause-2.1.7" }
//     resolution follows_clause_x
//     rationale "The model follows R 60-1, 5.6.3.1 ..."
//   }
// ─────────────────────────────────────────────────────────────────────

import type SourceDiscrepancy from '../../types/SourceDiscrepancy';
import tokenize from '../tokenize';
import { escapeString, unwrapBlock, stripWrapping } from '../tokenize';

// Exported: the discrepancy_record corpus construct (TODO.roadmap/54)
// shares the resolution vocabulary — one enum for both constructs.
export const VALID_RESOLUTIONS = ['follows_clause_x', 'annotated_only'];

/** Parse the content of a `source_discrepancy { … }` block. */
export function parseSourceDiscrepancy(block: string): SourceDiscrepancy {
  const sd: SourceDiscrepancy = {
    summary: '',
    sources: [],
    resolution: '',
    rationale: '',
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'summary') {
      sd.summary = stripWrapping(t[i++]);
    } else if (cmd === 'sources') {
      sd.sources = tokenize(stripWrapping(t[i++]))
        .map(stripWrapping)
        .filter(s => s.length > 0);
    } else if (cmd === 'resolution') {
      const r = stripWrapping(t[i++]);
      if (!VALID_RESOLUTIONS.includes(r)) {
        throw new Error(
          `Parsing error: source_discrepancy: Unknown resolution ${r} (valid: ${VALID_RESOLUTIONS.join(
            ', ',
          )})`,
        );
      }
      sd.resolution = r;
    } else if (cmd === 'rationale') {
      sd.rationale = stripWrapping(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return sd;
}

/**
 * Dump a source discrepancy as a single-line `source_discrepancy { … }`
 * block prefixed by `indent` (no trailing newline) — callers embed it
 * in their own line layout.
 */
export function dumpSourceDiscrepancy(
  sd: SourceDiscrepancy,
  indent: string,
): string {
  let out = indent + 'source_discrepancy { ';
  out += 'summary "' + escapeString(sd.summary) + '" ';
  out +=
    'sources { ' +
    sd.sources.map(s => '"' + escapeString(s) + '"').join(' ') +
    ' } ';
  out += 'resolution ' + sd.resolution + ' ';
  out += 'rationale "' + escapeString(sd.rationale) + '" ';
  out += '}';
  return out;
}
