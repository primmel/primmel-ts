# 08 — Record templates; registries are pairings

**Gap.** Structured records have three shapes: `form`/`subform`/
`header` (execution plane), `class X#data` (r144 value classes), and
registry/dataclass storage. Subform/header are form fragments —
composition, not a kind.

**Fix shape.** ONE record-template primitive with composition (a
template embeds templates). Registries are demoted to PAIRINGS (a
class + a store — the C157 pairing), never a data shape of their own.
Tabular constants stay `table`.

**Verify.** execution/forms/shared/headers.prl (the fragment pattern),
r144 entities/test-execution.prl (class X#data), the registry pairing
check (C157).
