# 15 — Model registers, attribute substitution, mixed-version trees

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
