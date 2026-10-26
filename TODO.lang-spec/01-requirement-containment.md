# 01 — Requirement containment: restore MMEL's structural hierarchy

**Status: LANDED (with 01a, the requirements algebra — e3a1b0c).** The
container form parses (requirement blocks nested in the class are its
ordered members), the planes are the flat form's, the checker walks the
class law (C172, requirement-algebra-resolves), the class-law corpus
fixtures pin the positive and the nonmember-violation cases, and the
spec documents the semantics (§"The class law: containment is
conjunction").

## The gap
`requirement_class` in Primmel is a header (title/name/description/subject) —
its children are unrelated flat requirements whose hierarchy lives only in the
clause numbering of their `ref derives-from` citations. The original MMEL
expressed the hierarchy **structurally**: the class contained its requirement
fields, and class fields could be **typed nested classes** —

```mmel
class ScopeData {
  meta: DocMeta { definition "…" modality SHALL }
  scope { definition "Scope of the SMS" modality SHALL }
}
```

Containment is the conjunction: the parent's obligation is exactly its
children's conjunction, by construction. The PROPOSAL-language-ergonomics.md
draft (`decomposition and`) over-invented a keyword for what the original
language expressed with structure.

## The resolution
1. `requirement_class` becomes a container: the requirements declared inside it
   are its members, ordered.
2. The containment form carries the same `ref derives-from`, `modality`,
   `limit` planes as the flat form — one requirement grammar, two scopes.
3. The checker: a class's member set is the class's obligation (the
   conjunction falls out; no law keyword); cycles are structurally impossible.
4. The flat/contained forms are the same construct at two scopes — no new
   primitive (the flattening rule).

## Disposition
spec section: the requirement-class containment semantics; the grammar gains
only the containment nesting; the conformance fixture covers a class with
nested members.
