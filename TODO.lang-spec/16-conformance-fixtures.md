# 16 — The conformance corpus carries the new rules

**Status: RESOLVED (2026-10-28).** The corpus carries CHK-169 and CHK-170
(positive + negative per rule, the checks/ pattern): bindings landing
exactly, as a cited child, and by enclosure stay clean; a clause-qualified
air landing errors C169; the two-edition package carrying
edition-mapping.json stays clean; the artifact-less two-edition package
errors C170. C171's fixtures landed earlier (chk-171-*). The runner runs
them — 275 cases, 89 clauses — and checker2 judges the same cases through
its own rules: the parity obligation is inherited mechanically by the
register-drift-checked leg.


## The gap
C169/C170/C171 landed with unit tests but no conformance-corpus fixtures —
the language's test-of-record (cases.json + clauses.json) does not exercise
them, and the second implementation (checker2) has no parity target for them.

## The resolution
The corpus gains the C169/C170/C171 fixtures (positive + negative per rule,
the same LML-0x pattern), the conformance runner runs them, and checker2
inherits the parity obligation.
