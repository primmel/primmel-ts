# 09 — LML serialization mappings are not declared in the package surface

**LML (RS 3010 §Serialization).** `mapping <format> <class>` blocks:
xml (`element`, `namespace`, `map_element`, `map_attribute`,
`map_content`, `mixed_content`) and key-value (`map`, `map_key
to_instance`, `map_value to_instance/as_attribute`), per format,
sibling-of-class by name or in-body.

**Primmel today.** The kernel HAS a mapping layer (MapProfile,
mappingsFromProfile, mapping-coverage) — but packages never DECLARE a
wire form: no package file carries a mapping block; (de)serialization
is kernel-internal. LML's contract — the wire shape is part of the
model, declared, per format — is absent at the author surface.

**Why it matters beyond parity.** The house rule: serialization goes
through the framework's declared mappings, NEVER hand-rolled to_h/from_h.
Without a declared mapping surface, every wire concern (renames,
render_nil, content bindings) has no home and tempts hand-rolling.

**Fix shape.** Adopt LML's mapping-block surface verbatim (it is the
substrate — Primmel > LML means ADDING the loop constructs, not
renaming the substrate): per-class, per-format blocks in the package;
the kernel's profile machinery compiles them. `map_key to_instance`
covers the keyed-collection wire forms.

**Verify.** packages/primmel/src/mapping-coverage.ts + ser-des/index.ts
(profile API surface to compile from); grep packages for any mapping
declaration (expected: none).
