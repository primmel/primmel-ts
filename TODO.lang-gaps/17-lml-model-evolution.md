# 17 — Source-declared versions and change levels

**LML (model-evolution).** `models X version "x.y.z"` IN SOURCE
(recorded as the schema's version surface); change levels (patch =
no consumer action; minor = additive; major = breaking, consumer
migration); CO-RELEASE discipline — model version, conformance
corpus, grammar artifact move together, one release.

**Primmel today.** model-diff exists (kernel — the AST diff);
conformance fixtures exist (248 checks); the grammar artifact is
versioned (grammar Primmel version "0.1.0"); the packages repo
releases by git tags. But: no version DECLARATION in package source;
no change-level rules tying diff classes to release semantics.

**Fix shape.** `package { … version "x.y.z" }` in source (declared;
numbers chosen by the owner — never by tooling); the change-level
vocabulary becomes lintable rules over model-diff output (renames/
removals → major; additions → minor; docs/fixes → patch); the
co-release gate: package version + conformance corpus + grammar
artifact must agree before a release lands. This formalizes what the
packages repo already does by hand (tags + freeze discipline).
