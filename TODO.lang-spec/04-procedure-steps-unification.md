# 04 — One procedure step form (and its labels resolve)

## The gap
Requirements and tests carry BOTH `procedure { 1 "…" outputs { … } }` (numbered
text) and `procedure_steps { labels }` (the named sequence) — the labels
resolve to nothing; C171 closes the expression plane but the sequence-label
plane still names freely (verified: r134's `apply_power_interruption_20ms`).

## The resolution
The named typed step is the one form, writable inline:

```prl
procedure {
  step record_reference_indication outputs { indication_without_disturbance }
  step apply_power_interruption_20ms outputs { indication_with_disturbance }
}
```

The numbered text form retires to Annex D; `procedure_steps` dies (the step
ids are the sequence); C171's sequence leg resolves the labels to the typed
steps.
