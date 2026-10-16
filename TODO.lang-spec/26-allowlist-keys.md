# 26 — The structured allowlist keys

**Status: LANDED (2026-10-17).** The allowlist entries carry the
optional structured key:

```prl
allowlist_entry {
  rule C179
  id "u_creep_reference"
  match "*is not a declared verdict*"
  reason "…"
  audit_ref "…"
}
```

`id` is a glob matched against the issue's leading element identity
(`uncertainty_budget u_creep_reference: …` → `u_creef_reference`) — the
entry pins its ELEMENT, not its prose. Without the key, the message
glob alone decides (the legacy form, unchanged). The C56 validation
requires the key non-empty when present; the C57 staleness counts the
keyed entries exactly like the prose ones — the entry dies when its
element's diagnostic is fixed, whatever the wording drifts to.

**The mode-stability half of W9** (the standalone-vs-composed harvest
difference) remains open: the design-intent check with the kernel owner
(the critique's C14/C3 — a decision, not work).
