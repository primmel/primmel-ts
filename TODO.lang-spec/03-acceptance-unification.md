# 03 — One acceptance surface

## The gap
Four constructs express "the rule that turns an observation into a
pass/fail": `verdict` (derive-once), the limit `accepts { verdict op limit }`
triple, `acceptance_criteria` (the composite block, on requirements and
tests), and `decision_rule` (the CS-framework plane). The writer picks a form
by mood, not by semantics.

## The resolution
The acceptance block is the one surface: its body is either a canonical
verdict reference, a comparison, or the composite criteria — the composite is
the block's own content, not a second construct. `verdict` stays as the
derive-once registry (the requirement's `accepts` references it).
`decision_rule` folds into the acceptance block (a named, reusable one) or
retires to Annex D.

## Disposition
the acceptance grammar unification; the corpus migrates; Annex D carries the
retired forms.
