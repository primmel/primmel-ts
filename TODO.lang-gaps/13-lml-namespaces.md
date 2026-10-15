# 13 — Namespaces: single string vs uri + prefix

**LML (lang §Namespacing).** `namespace X { uri "…" prefix "…" }`
declared in the models scope; mappings reference by name; one
namespace applies implicitly, several without explicit reference =
compile error; prefix-less = default xmlns.

**Primmel today.** `metadata { namespace "N" }` — one opaque string
(see the BS6004 fixtures). The kernel's 111 namespace hits are the
metadata block + internals.

**Fix shape.** Namespace becomes a DECLARATION (uri + prefix + name)
in the package scope; metadata's namespace string becomes a reference
to it. Wire mappings (09) bind namespaces by name, exactly LML.
