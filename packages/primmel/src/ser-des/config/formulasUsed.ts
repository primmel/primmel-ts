// ─────────────────────────────────────────────────────────────────────
// `formulas_used` construct (smart gap-close E11,
// analysis/architecture-gaps-2026-07.md; the smart contract
// data/schemas/formulas-used.yaml + data/r60/specification/
// formulas-used.yaml): the per-test evaluation-formula trace of a
// Recommendation — the first-class replacement for the hand-authored
// supplemental YAML the R 60 MDLO trace rides today:
//
//   formulas_used /conf/metrological-tests/measurement-error-repeatability-mdlo {
//     name "MDLO evaluation formulas"
//     description "The evaluation-level quantities of R 60-3, 2.1 the MDLO test derives from the indication output: the conversion factor f (2.1.2.4), the load cell error E_L (2.1.2), …"
//     formulas { conversion_factor_f e_l e_r c_m }
//     source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1" }
//   }
//
// Surface-syntax notes (the invariant/test_sequence conventions,
// ser-des/config/invariant.ts + testSequence.ts):
//   - the block symbol IS the conformance-test reference — a bare
//     reference-shaped id, the `text /req/….statement` construct's
//     idiom (the ref alphabet `/`, letters, `-` is bare-token-safe; a
//     quoted spelling is legal but lands on a DIFFERENT id — the tokens
//     differ — so authors pick one spelling);
//   - name/description are prose facets: the package-default spelling's
//     value inline; alternates ride the ISO 24229
//     `text <test-ref>.description` blocks (TODO.roadmap/25 —
//     formulasUsed registered in C89's element-id collections);
//   - formulas is a list facet — a `{ … }` block (`,` and `;` are
//     optional noise, the invariant applies_to idiom) or a single bare
//     entry; repeated formulas facets accumulate;
//   - `source { doc "…" clause "…" }` repeats, collecting into
//     sourceRefs (the requirement family's idiom, TODO.roadmap/24);
//   - the parser stays TOTAL: missing facets land as ''/[] and the
//     linter (C94) judges the shape — unknown keywords stay ignored
//     (forward compatibility for newer facets);
//   - formula-id RESOLUTION (does e_l exist in the calculations ∪
//     formulas registries) is the smart-side linker rule R41's job —
//     the kernel checks syntax/shape only, exactly like E9's C90/C91 vs
//     R38 and E10's C92/C93 vs R39 split.
//
// Round-trip: the dump emits the canonical form — scalars first (name,
// description), then the formulas block, then the source blocks. name,
// description, doc, and clause are quoted ALWAYS — free strings may
// carry the tokenizer's comment character # (the E9 source-quoting
// hazard), so a bare emission would not re-parse; the formula ids are
// identifier tokens (dumpBareSafe). A malformed model (every facet
// missing) dumps a form the re-parse reproduces exactly — the fixpoint
// is proven in test/formulas-used.test.ts.
// ─────────────────────────────────────────────────────────────────────

import { escapeString, stripWrapping, unwrapBlock } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, readEntryTokens, readSource } from './field-parser';
import {
  parseRefFromReaders,
  foldRefIntoLegacy,
  dumpSourceRefAsRef,
} from './ref';
import {
  dumpCorrespondences,
  parseCorrespondsFromReaders,
} from './correspondence';
import type { ConstructDefinition } from './index';
import type { FormulasUsed } from '../../types/FormulasUsed';

const parseFormulasUsed: ConstructDefinition['parse'] = function (id, data) {
  const trace: FormulasUsed = {
    id,
    name: '',
    description: '',
    formulas: [],
    sourceRefs: [],
  };

  forEachEntry(
    data,
    (command, value, peek) => {
      if (command === 'name') {
        trace.name = stripWrapping(value());
      } else if (command === 'description') {
        trace.description = stripWrapping(value());
      } else if (command === 'formulas') {
        // The value thunk consumes a token per call — read it ONCE.
        // Repeated formulas facets accumulate so the linter sees the
        // full declaration instead of the parser silently picking one.
        trace.formulas.push(...readEntryTokens(value()));
      } else if (command === 'ref') {
        // The unified typed reference (docs/primmel/18).
        const r = parseRefFromReaders(value, peek, stripWrapping, unwrapBlock);
        if (!foldRefIntoLegacy(trace, r)) {
          (trace.refs ??= []).push(r);
        }
      } else if (command === 'corresponds') {
        // The per-node correspondence annotation (MN 114 clause 19.4).
        (trace.correspondences ??= []).push(
          parseCorrespondsFromReaders(value, peek, stripWrapping),
        );
      } else if (command === 'source') {
        // Repeated source blocks collect into sourceRefs (the
        // requirement family's idiom).
        trace.sourceRefs.push(readSource(unwrapBlock(value())));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'formulas_used', id },
  );

  return ctx => {
    ctx.formulasUsed[id] = trace;
    return ctx;
  };
};

// ── dump (canonical form) ────────────────────────────────────────────

const dumpFormulasUsed = function (fu: FormulasUsed): string {
  let out = 'formulas_used ' + fu.id + ' {\n';
  if (fu.name !== '') {
    out += '  name "' + escapeString(fu.name) + '"\n';
  }
  if (fu.description !== '') {
    out += '  description "' + escapeString(fu.description) + '"\n';
  }
  if (fu.formulas.length > 0) {
    out += '  formulas { ' + fu.formulas.map(dumpBareSafe).join(' ') + ' }\n';
  }
  for (const r of fu.refs ?? []) {
    out +=
      '  ref ' +
      r.predicate +
      ' "' +
      escapeString(r.target) +
      '"' +
      (r.note ? ' { note "' + escapeString(r.note) + '" }' : '') +
      '\n';
  }
  for (const src of fu.sourceRefs) {
    // doc/clause are quoted ALWAYS: free strings may carry the
    // tokenizer's comment character # (the E9 source-quoting hazard),
    // so a bare emission would not re-parse.
    out += dumpSourceRefAsRef(src, '  ', escapeString);
  }
  out += dumpCorrespondences(
    fu.correspondences,
    '  ',
    escapeString,
    dumpBareSafe,
  );
  out += '}\n';
  return out;
};

export const formulasUsedConstruct = {
  keyword: 'formulas_used',
  field: 'formulasUsed',
  takesID: true,
  parse: parseFormulasUsed,
  dump: dumpFormulasUsed,
} as const;
