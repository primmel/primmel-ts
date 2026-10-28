# 15 — Model registers, attribute substitution, mixed-version trees

**Status: RESOLVED (2026-10-28) — the register is declared across
four landed planes.** (1) The register itself: the workspace locator
plane (TODO.lang-spec/15, C187/C188, `primmel closure`) — `scheme
registry` names the register's endpoint; the bare import's unresolved
state is DECLARED, not ambient. (2) Model paths: the qualified import
`<locator>::<id>` + `${id}` templates IS the register's addressing.
(3) Registrable classes / hierarchies: package composition (uses /
requires / provides / maps_to) + the pairing registries (08).
(4) Attribute substitution: module-slot overlays — `${{ slot }}`
substitution per entry (spec#28, landed). Mixed-version trees: the pin
discipline (C83 version pins, C80 edition-pin-resolves — an instance
pins against its declaring package's register; INV-8) states what
composition may mix, explicitly. Version NUMBERS stay the owner's,
always.**

**LML (model-register).** Registered models with global register,
model paths, hierarchies, registrable classes, ATTRIBUTE SUBSTITUTION,
and MIXED-VERSION model trees.

**Primmel today.** The packages repo + pinned git tags is the de-facto
register (release discipline lives in repo process, not the language).
Package composition (uses/requires) covers hierarchies. No language
notion of registration, substitution, or version-mixed composition.

**Fix shape.** Declare the register: package registration with
versions (see 17), model paths as the register's addressing (14),
registrable classes for the pairing registries (08), and
attribute substitution for the datum plane (04). Mixed-version trees:
the composition checker states whether a composed corpus may mix
package versions — today implicit in the pin discipline.

**House rule preserved.** The language declares the REGISTER; version
NUMBER decisions stay the owner's, always.
