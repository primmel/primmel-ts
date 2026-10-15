# 07 — The process vocabularies

**Gap.** Process-like constructs grew per plane: `processes.prl`
(concrete, with actors), `abstract-processes.prl` (pd-03 etc., with
`realized_by` edges), `entities/workflow.prl` + `evaluation/workflow.prl`
(two more), and gateways as a separate construct.

**Fix shape.** ONE `process` primitive with `realized_by` edges (the
abstract/concrete distinction is an EDGE, not a vocabulary). A gateway
is a step whose output is a branch decision — its decision procedure
is a check (03) or an actor judgment, always with a named accountable
actor (05). Workflow files fold into the process plane or die.

**Verify.** oiml-cs/framework/documents/pd-03/abstract-processes.prl
(the realized_by pattern, linker rule R26) vs evaluation/processes.prl.
