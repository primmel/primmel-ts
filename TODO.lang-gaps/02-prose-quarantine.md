# 02 — THE PROSE QUARANTINE (critical)

**Status (2026-10-29): ENFORCED (parse-level; 1.21.45–1.21.47).**
Phase 1 (1.21.45/46): the five bare prose carriers (statement,
definition, summary, response, criteria) dual-parse and canonicalize
to the block form on dump; the corpus rebaked (3,821 + 221 inline
occurrences, ~560 files; library v0.33.20). Phase 2 (1.21.47): the
bare quoted spelling REFUSES at parse via the shared `proseBlock`
reader naming this file — stronger than the spec §16 C158 linter
level, same rule. The promise's quoted-string shorthand stays
byte-pinned. **Open content debt (not language debt):** register
items 3 and 5 — the numbers trapped in pass_fail criteria prose
(→ declared datums + checks) and the data held in behavior-response /
process-summary prose (→ structured fields) migrate package by
package under the fidelity gates; item 6's label/name/title sprawl
likewise. The LANGUAGE surface is closed: no bare prose string parses.

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
