# 07 — The gate fields become one gated primitive

**Status: RESOLVED (2026-10-28) — the process carries one `gates { … }`
facet, kind-discriminated; the five fields (`guards`, `preconditions`,
`windows`, `discharges_gate`, `machine_steps`) are retired parse errors
whose content grammars moved VERBATIM into their gate entries; the
declaration_gate CONSTRUCT stays (the declaration kind's gate-side home
at the framework register, the referent of the discharge entries).**

The design: the entry keyword IS the kind —
`entry_condition <id>? { check … description … on_violation … }`,
`window <id> { … }`, `discharge <gate-id>`,
`machine_service { <id>+ }`. The anonymous entry_condition (no id) is
where the legacy `guard "…"` facet folded: the workflow gate criteria
were ordered opaque prose (never resolved — the R26 precedent), and an
anonymous entry keeps exactly that shape. The conformance_test
precondition family is a DIFFERENT, run-plane facet and stays. The
corpus migrated in the same wave (52 guards over the four evaluation
workflow.prl files → anonymous entries, the oiml-cs windows and
discharges, the nine machine_steps lists — 65 sites, the census grep's
head-truncated 28 corrected by the migration script's explicit
enumeration); the
one top-level `declaration_gate` (oiml-cs/framework/declarations.prl)
was audited and STAYS — it is the framework register's declaration kind,
not a process facet. The checker legs keep their rule ids (C121's
discharge/window legs, C39's state gates, C41's outcome vocabulary); the
messages name the entries they now walk.

## The gap
`guards`, `preconditions`, `windows`, `dischargesGate`, `declaration_gate`,
`machine_steps` — the process says "may only run when/while/before X" six
ways.

## The resolution
One gating primitive on the process with kinds: entry-condition (precondition),
window, discharge (the gate a step discharges), machine-service
(machine_steps), declaration (declaration_gate). Each existing field migrates
to a kind; the process loses five fields and gains one.
