# 23 — The formatter and the save-back doctrine

**Status: LANDED (2026-10-16, v1).** `src/fmt.ts` + `primmel fmt
[--check] <dir>`: the canonical serialization as a command. The fixpoint
is the safety — a file is rewritten only when its canonical form
re-loads to itself; unstable files are reported, never touched. Include
files and the allowlist are skipped in place. `--check` is the CI gate
(reports, exits 1, never writes). Idempotent by construction.

## The doctrine

The canon is the save-back contract: the kernel owns the serialized
form; an editor's save rides the same dump (`fmt` is the save path's
standalone form). The author's facet order yields to the canonical
order — v1 canonicalizes; order PRESERVATION (audit A10: the dump
keeping the author's sequence) remains open and rides the
provenance-span splice when the Studio save lands.

## Remaining

- The order preservation (the span-splice form, when the Studio save path exists).
- The manifest canonicalization (package.primmel) — riskier: the loader's
  lenient reparse of unknown manifest fields; gated on the strict-parse contract.
