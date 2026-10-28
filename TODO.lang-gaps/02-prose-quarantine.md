# 02 — THE PROSE QUARANTINE (critical)

**Status (2026-10-28): DECLARED, ENFORCEMENT PARTIAL.** Spec §16
declares C158 an error; the kernel enforces the datum-description
proxy. The corpus still carries the bare strings (~1,181 statement,
~2,203 definition, 191 summary, 88 response, 174 criteria); the
global linter leg lands with the prose-surface migration.

**Rule (owner, 2026-10-12).** Primmel is a DATA MODELING LANGUAGE. NO
prose in semantic positions — everything is explicit and useable.
Human language lives ONLY in `label` (short display string — itself
data: what prints) or the `description { }` block (the quarantine;
r144 already writes this style). All other prose spellings
(statement/summary/criteria/response/definition-as-bare-string) die.

**THE DELETION TEST.** Delete every `description` from a package and it
must still parse, check, link, run, and attest — identically. If
anything changes, semantics were smuggled in prose.

**Corpus violations found (worst first):**
1. `specification_reference "R 60-3, 2.1.2.4"` — free-text reference;
   unusable by linker/coverage/reporter → `ref derives-from urn`
2. `source { doc "PD-05 §4.3", clause "" }` — non-urn doc + empty
   clause → urn
3. `pass_fail criteria "…(max(5 ppm, 10 %)) during 2 h…"` — NUMBERS
   trapped in prose → declared datums + check; criteria → description
4. `validate_measurement "every([within_mpe]) = true"` — undeclared
   names → declared check (see 01)
5. `behavior response` (holds the clause-3 definition) and process
   `summary` (holds the 5.1 a–i list) — data in prose slots →
   structured fields + description
6. Spelling sprawl label/name/title/definition/summary/statement/
   criteria/response → ONE label + ONE description, everything else
   typed

**Enforcement.** Linter: no bare string field outside
{label, description block, expression, urn}; every ref role resolves
to a urn; no expression names an undeclared identifier.
