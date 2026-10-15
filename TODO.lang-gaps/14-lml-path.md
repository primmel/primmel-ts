# 14 — Path expressions (LutaML Path)

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
