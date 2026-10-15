# 20 — Calculations are declared math bound to declared symbols

**Rule (owner, CRITICAL, 2026-10-12).** Math is NOT IN OCL. A
calculation's formula is proper math in a declared notation —
asciimath / latex / unicodemath / mathml / omml — evaluated by a
Plurimath-conformant engine (the reference: plurimath-ts at
~/src/plurimath/plurimath-ts, subpaths ./asciimath ./latex ./mathml
./omml ./unicodemath). Each calculation binds to DECLARED
symbols/variables/constants: 1..* declared input symbols, exactly 1
declared output symbol. Everything explicit; results are read out,
reused, and linked BY SYMBOL.

**Spec:** sources/language-v3/sections/12-data-quantities-time.adoc
[[calculation-math]] (landed). The `expression "ocl{…}"` form retires
for calculations; checks keep OCL (boolean logic — logic is not math).

**Checker rules.** C165 math-symbols-declared: every identifier in the
formula is a bound symbol (input, output, or declared constant).
C166 math-parses: the formula parses in its declared notation.

**Kernel (P2).** plurimath-ts dependency; parse the math block;
extract the formula's identifiers and verify the binding set;
evaluation of a retrieved calculation runs the declared math with the
input symbols' values, producing the output symbol's value.
Unit/quantity_kind agreement rides the existing C115 signature shape.

**Units and kinds are NAMESPACED** (owner correction): `unit r60:v`,
`quantity_kind si:mass` — `<register>:<id>`; the bare form only inside
the declaring register. C167.

**Rendering hints are declared per notation** (owner correction): a
symbol carries `render latex "L_{v}"`, `render asciimath "L_v"` —
zero or more, notation named and parse-enforced. The bare `latex`
facet is RETIRED (no notation, no form — a primitive smell). The hint
is presentation data; the math engine consumes it when rendering that
notation.

**Corpus (P3).** r60's mpe-calculation.prl and the formulas plane
migrate: ocl expressions → declared-notation math with symbol
bindings; symbols.prl already exists as the registry (its latex
facets → render statements).
