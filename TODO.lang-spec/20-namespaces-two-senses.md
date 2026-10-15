# 20 — Namespace: the two senses, made MECE

## The question
"Do we support namespaces? Isn't a package a namespace?"

## The answer
**Yes — the package is the namespace.** Verified in the enforcement:
- **C28 uses-no-redefine**: a composed package may reference upstream ids but
  never REDEFINE them — the ids are owned by the package that declares them.
- **C119 namespace-pin-violation**: a requirement scope a composed package
  declares is OWNED by that package — a downstream package references its
  provisions but never declares a requirement class or requirement at or
  under the owned namespace.
- The scoped references name through it: `oiml-r134:symbol:e_vehicle`,
  `oiml-r60-lml:process:load_weight.scale.indication` — the first hops land
  in the package's namespace, the dots descend within it.
- The args bindings, the coverage addresses, the retrieval units, the diff
  paths: every id-path begins at the package namespace.

**The `namespace` construct is the OTHER sense**: the serialization plane's
uri+prefix binding (§15 — the machine-format vocabularies the projections
emit: the RDF/Turtle prefixes, the XML namespaces). It maps the model's ids
onto WIRE names; it scopes nothing in the model.

## The MECE fix
The two senses are different planes and the spec states it:
1. **§8 (model structure)** gains the normative sentence: *the package is the
   namespace of every id it declares; the composition rules (C28, C119)
   enforce the ownership; the name grammar (§13) names through it.*
2. **§15 (serialization)** states: *the `namespace` construct binds the
   wire-plane uri+prefix for the projections — it scopes the wire names, not
   the model ids.*
3. **Registry triage (optional)**: if the collision keeps confusing authors,
   `namespace` renames to `wire_namespace` in a v3.x revision (Annex D
   carries the old keyword). Default: keep the keyword, keep the two
   sentences.
