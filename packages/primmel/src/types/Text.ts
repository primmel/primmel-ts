// ─────────────────────────────────────────────────────────────────────
// `text` — per-spelling values of a prose field (ISO 24229, doctrine
// ch. 10; TODO.roadmap/25). One logical string, per-spelling values —
// a content set:
//
//   text /req/metrological/measuring-range-max.statement {
//     spell eng-Latn "The value of the largest load … shall not be
//                      greater than E_max."
//     spell fra-Latn "La valeur de la plus grande charge …"
//   }
//
//   text manufacturer-name {
//     spell zho-Hans "…"
//     spell zho-Latn via BGN-PCGN:zho-Hans:Latn:1979 "…"  # derived, cited
//   }
//
// The DEFAULT spelling's value stays authored inline on the addressed
// element (`name "…"` — the shorthand); `text` blocks carry the
// ALTERNATES (translations, converted forms), so a localization adds
// files without ever touching the normative source spelling. The
// package manifest declares the default (`default_spelling eng-Latn`)
// and, optionally, the spelling set the linter counts coverage against
// (`spellings { eng-Latn fra-Latn }`).
//
// The id is the addressed element's id plus the field:
// `<element-id>.<field>` (e.g. `/req/metrological/measuring-range-max`
// `.statement`). Prose NESTED inside the element addresses by path
// (smart gap-close E13): `<element-id>.<path…>.<field>` — intermediate
// segments name nested structures, list items key by their declared
// name/order/slot, e.g.
// `r60-3/load-test.fields.runs.fields.indication.label`. Code syntax
// (script mandatory, `via` four-segment) and the address grammar are
// linter rule C89; register resolution is the consumer's discipline
// (primmel-ts stays register-free — src/spelling.ts validates shape).
// ─────────────────────────────────────────────────────────────────────

/** One per-spelling value of a content set. */
export interface SpellingEntry {
  /** ISO 24229 spelling system code (language-script[-country][-ext]). */
  spelling: string;
  /** Conversion system code when the value was DERIVED by the named
   *  system rather than authored (titular:source:target:identifying). */
  via?: string;
  /** The string in this spelling. */
  value: string;
}

interface TextContent {
  /** The addressed prose field: `<element-id>.<field>`, or
   *  `<element-id>.<path…>.<field>` for a nested prose field (E13). */
  id: string;
  /** Alternate spellings (the default spelling's value lives inline on
   *  the addressed element; an entry repeating the package's default
   *  spelling is a duplicate, flagged by C89). */
  entries: SpellingEntry[];
}

export default TextContent;
