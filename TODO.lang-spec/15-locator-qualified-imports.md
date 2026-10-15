# 15 — Explicit resolution: the locator-qualified import

## The resolution (review-directed, three flattening rounds)
The locator is a namespace qualifier on the import id
(`ribose-registry::iso-iec-17000`); the workspace declares the named locator
endpoints; the bare import is the declared unresolved state. No resolution
table, no patterns, no ambient sibling scanning. The closure states:
closed / interface-closed / unresolved — the closure report is the license
boundary. Credentials as references only. The full design:
PROPOSAL-model-separation.md §2a.
