# 07 — The gate fields become one gated primitive

## The gap
`guards`, `preconditions`, `windows`, `dischargesGate`, `declaration_gate`,
`machine_steps` — the process says "may only run when/while/before X" six
ways.

## The resolution
One gating primitive on the process with kinds: entry-condition (precondition),
window, discharge (the gate a step discharges), machine-service
(machine_steps), declaration (declaration_gate). Each existing field migrates
to a kind; the process loses five fields and gains one.
