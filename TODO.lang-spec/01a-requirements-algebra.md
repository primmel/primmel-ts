# The requirements algebra — the design (supersedes the `decomposition` draft)

## The doctrine

**Containment is conjunction.** A requirement container (`requirement_class`)
holds its children; without a declared law, the container's obligation is the
conjunction of the children's — MMEL's structural form, restored.

**The container's `limit.expression` is the law.** A container may declare a
limit whose expression names its contained children by id — and that single
move gives the language every connective the standards actually use, because
they are the OCL booleans the expression plane already carries (and C171
already validates):

| The standard's word | The law expression | Example |
|---|---|---|
| and (all must hold) | containment, no law needed — or `ocl{a and b}` | the default |
| or (one or more paths) | `ocl{sealing or signalling}` | R 134-1 3.6: seal **or** signal |
| either … or (exactly one) | `ocl{a xor b}` | exclusive alternatives |
| neither … nor | `ocl{not (a or b)}` | the negated disjunction |
| unless / except | `ocl{a implies b}` | the conditional refinement |
| at least one | `ocl{a or b or c}` | the committee's menu |
| when / if | `ocl{c implies a}` | the applicability-gated child |

```prl
requirement_class /req/electronic/software-protection {
  limit {
    expression "ocl{sealing or signalling}"
  }
  requirement sealing {
    statement "Alteration of the legally relevant software is not possible
               without breaking a seal."
    ...
  }
  requirement signalling {
    statement "Any change in the software is signalled automatically."
    ...
  }
}
```

## The checker rules (the algebra is only as good as its checking)

- **C172 requirement-algebra-resolves**: a container limit's identifiers name
  contained children only (C171's scope extended to the containment); every
  contained child appears in the law expression, or the container carries no
  law (conjunction) — an unreferenced child under a declared law warns (either
  it is always-required `and`-material that the law forgot, or it is orphaned).
- **Bindingness monotonicity**: a contained child's `modality` cannot be weaker
  than the container's (a `may` child under a `shall` container is a
  mis-modelled alternative).
- **Cycles are structurally impossible** (containment cannot recurse into
  itself).

## The work items

1. **The grammar** (`primmel.parg`): the `requirement_class` containment
   nesting (the requirements declared inside the class block) + the class's
   `limit` field; the two front ends; the compiled artifact.
2. **The kernel**: the parse (the nested requirements collect onto the class),
   the dump (the canonical re-emission, round-trip stable), C171's scope
   extension, C172, the conformance fixtures (the LML-0x pattern: positive +
   negative per connective).
3. **The spec**: the containment semantics + the algebra table above, in
   §10 (requirements and conformance); §16 gains C172; Annex A's
   `requirement_class` entry updates.
4. **The migration** (the models): 
   - r134: the 2.2 limits-of-error regime CONTAINS 2.2.1.1/2.2.1.2 (the law is
     the conjunction — no declared limit); the 3.6 software protection becomes
     the container with `ocl{sealing or signalling}`.
   - r60-lml: the 2.6 software requirement's disjunction (the D 31 seal-or-
     signal) becomes a container with the law.
   - the conformance corpus's requirement fixtures gain the containment forms.
5. **checker2 parity**: the second implementation inherits the containment +
   C172 as its parity target.
