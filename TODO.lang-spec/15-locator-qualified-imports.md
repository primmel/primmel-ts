# 15 — Explicit resolution: the locator-qualified import

**Status: RESOLVED (2026-10-28) — the workspace locator plane landed
(C187/C188, `@primmel/primmel` 1.21.41).**

## The resolution (review-directed, three flattening rounds)
The locator is a namespace qualifier on the import id
(`ribose-registry::iso-iec-17000`); the workspace declares the named locator
endpoints; the bare import is the declared unresolved state. No resolution
table, no patterns, no ambient sibling scanning. The closure states:
closed / interface-closed / unresolved — the closure report is the license
boundary. Credentials as references only. The full design:
PROPOSAL-model-separation.md §2a.

## What landed
- **The locators file** — `.primmel/locators.prl`, the WORKSPACE's own
  data, never package content: `locator <name> { scheme local|registry|git;
  path|registry|repo|ref|auth … }` (`src/ser-des/locators.ts`). The
  keyword deliberately has no package CONSTRUCTS entry — the R1 parity
  gate counts it through the exported `LOCATOR_KEYWORD`.
- **The qualified import** — `uses { <locator>::<id> }`; `useLocators`
  on the manifest records the plain-spelling form.
- **C187 workspace-locator-declared** — a qualified import names an
  endpoint the workspace declares, and the declarations are well-formed;
  the unresolved dependency (declared endpoint, no locator reaches it)
  is a WARNING carrying the closure state — data, never a crash.
- **C188 locator-credential-reference** — a locator `auth` carries a
  credential REFERENCE (`env:VAR`, `vault:path`); an inline secret is an
  error.
- **The closure report** (`closureReport(dir)`, wired to
  `primmel check`) — closed / interface-closed (`product_reference`
  through a locator) / unresolved (§2a: the bare import's declared
  state), per dependency, with the workspace file attested.
- **checker2** — C187/C188 are outOfSurface (the register grows the
  map): a single-package checker never sees the workspace file.
- **The spec** — the workspace chapter (06-language-overview, "The
  workspace and the locators"), the Annex A row, the Annex B rows
  (spec#80).
