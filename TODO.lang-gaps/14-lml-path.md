# 14 — Path expressions (LutaML Path)

**Status: DECLINED (2026-10-28) — out of scope, recorded: the two
addresses already have two owners.** INTERNAL addressing is the
expression language's collection navigation (TODO.lang-spec/18 + 24,
landed: navigation members, lambdas — `readNavMembers` in the
expression reader); EXTERNAL addressing is the urn (a citation into a
published document — provenance, never navigation). A standalone
lutaml-path layer would be a third address between two MECE owners,
answering a query the corpus does not ask: no cross-model path appears
in any package source. The kernel and Studio navigate internally over
object graphs — that is code's business, not the language's. Reopen on
first in-source cross-model selection need.**

**LML (lutaml-path).** A path language over models: navigation
segments, predicates, path roots, model queries — the addressing
layer for selections and cross-model references WITHIN a corpus.

**Primmel today.** Urns (`urn:oiml:pub:r:60-2:2021#clause-2.10.1`)
are CITATIONS — provenance addresses into published documents. There
is no declared path/query language over Primmel models themselves;
the kernel and Studio navigate internally (object graphs) but authors
cannot address model content.

**Fix shape.** Adopt LutaML Path as the intra-model addressing layer:
requirement/form/promise selections (the conformance-class selections
in 08's "a class is a selection"), coverage queries, the mapper's
candidate addressing (the Studio's automap scoring reads model content
— today via ad-hoc code). The urn stays the EXTERNAL citation
address; paths are the INTERNAL one. Two addresses, two jobs — MECE.
