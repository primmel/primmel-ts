# 16 — The conformance corpus carries the new rules

## The gap
C169/C170/C171 landed with unit tests but no conformance-corpus fixtures —
the language's test-of-record (cases.json + clauses.json) does not exercise
them, and the second implementation (checker2) has no parity target for them.

## The resolution
The corpus gains the C169/C170/C171 fixtures (positive + negative per rule,
the same LML-0x pattern), the conformance runner runs them, and checker2
inherits the parity obligation.
