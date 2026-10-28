# 11 — Grammar-backed string formats (string_format)

**Status: RESOLVED (v3.3) — grammar-backed formats are declared
(`StringFormat`, types/LmlAligned.ts); the index row is swept here.**

**LML (RS 3010).** A class declares `string_format :name { artifact
"<ref>" root "<rule>" }` — instances serialize to/from an identifier
STRING parsed by a grammar artifact (e.g. pubid/iso). The declaration
is a thin reference; the artifact owns capture maps and render specs.
Registration yields from_{format}; the models-block string_format is
the default.

**Primmel today.** value-types.prl is a plain value vocabulary; no
grammar-backed format construct anywhere in the corpus.

**Why this matters to OIML SMART specifically.** PubIDs are the
corpus's spine (`urn:oiml:pub:r:60-1:2021#clause-5.3.2` — oiml-pubid
exists as a separate project!). Declared string formats make every
identifier field typed-by-grammar instead of stringly.

**Fix shape.** Adopt the thin-reference construct: `string_format`
on value types / datum types, artifact-resolved at compile time,
`from_{format}` on the compiled model. Flavors differ in grammar —
LML's lesson: never duplicate capture maps into the language.
