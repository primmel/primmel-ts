# 14 — A citation is a document mapping

**Status: RESOLVED (2026-10-28).** The framing entered the spec's
references-and-relations chapter as "The document mapping" (16.4): the
citation plane is the model→document counterpart of the serialization
mapping — one mapping concept, two target spaces (`mapping` blocks bind
a class to its wire form, model→wire; a provenance binding binds a model
element to a document location, model→document), the document anchor is
the document mapping's selector over the locator grammar (edition +
clause + fragment), the edition axis composes with the edition-mapping
artifacts (C170), and C169 restates as "every document mapping's target
resolves in the mapped document" — the checker row and the rule
catalog's prose basis carry the same sentence. Zero behavior change: no
rule, message, or corpus expectation moved.

## The resolution (review-directed)
The citation plane is the model→document counterpart of the serialization
mapping: one mapping concept, two target spaces. The document mapping names
edition + clause + fragment (the locator grammar); C169 restates as "every
document mapping's target resolves in the mapped document"; the edition axis
composes with the edition-mapping artifacts. The SDU parallel: the
Annotation → SpecificResource → Selector chain — our provenance bindings
already are selectors; the mapping framing makes it explicit.
