# 09 — One reference construct

**Status: RESOLVED (2026-10-27).** `ref` (the typed reference per
docs/primmel/18, with the RefPredicate vocabulary) IS the reference
plane: every construct folds provenance onto it (§18.4) and the
semantic predicates live there. The audit of the other senses:
`reference_materials` is the test plane's own register (the CGM/
reference-material ids a test uses — justified per section, not a
citation); the legacy `referenceIds` channels are the doc-18 fold
targets (kept byte-stable); and the MMEL-vintage `link` (REPO/URL)
construct — zero corpus uses, no checker legs — is DEPRECATED (C154,
the ref plane carries the pointer); the refusal follows the ladder.

## The gap
`reference`, `references`, `links`, beside `ref derives-from` / `source {}` /
the typed `refs` plane — the provenance carriers need one registry entry each
and a statement of what each adds over `ref`.

## The resolution
`ref` (typed per docs/primmel/18) is the provenance primitive;
`references`/`links`/`reference` justify themselves per section or fold into
it. The MMEL `reference { id }` clause-citation maps onto `ref derives-from`
(verified: the acme/bs202000 corpus).
