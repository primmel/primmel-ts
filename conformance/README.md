# The Primmel conformance test suite

**Version 2.2.0 · 2026-09-01.** The public, versioned corpus and runner
with which any implementation of the Primmel modelling language proves
its conformance, clause by clause. The suite pairs with the Primmel
Language Specification (MN 114, draft for comment, the 2026-08-28
revision specifying Primmel v3.1): when the specification publishes its
conformance clauses, this suite's clause identifiers re-key to them (see
`clauses.json`, the `spec` block); the v3.1 clauses (DAT-01 to DAT-04)
already anchor to MN 114 clause 19. Version 2.2.0 over 2.1.0: new cases
inside existing clauses (SER-01/SER-02 pin the attribute definition's
vocabulary facets — the note, the braced enum_values, and the cites
references the dump never emitted); every earlier case is unchanged and
still passes.

## What it is

- **The clause map** (`clauses.json`): 27 conformance clauses across
  six areas: the document syntax (the header, identifiers, and the
  five entity kinds: requirement, conformance test, form, calculation,
  table), the serialization rules (the re-serialization fixed point and
  the canonical emission form), the constraint and check machinery
  (seven rules of the catalog, one per machinery kind: C1, C2, C4, C10,
  C11, C96, C109), the packaging layer (the manifest, the edition
  register C77, definition pins C80, layered composition C27/C28/C29,
  abstract import pins C83), the named error cases, and the v3.1
  dataspace extension set (the dataspace construct, the policy
  construct, trust references, and the correspondence annotations:
  C104, C105, C106, C107, C108). Every
  clause carries at least one positive and one negative case; the runner
  enforces this invariant on every run.
- **The corpus** (`corpus/`): 90 Primmel documents and packages, valid
  and invalid per the clauses, each entry in `corpus/cases.json`
  naming the clause it proves, its polarity, and its expectation.
- **The runner** (`runner/run.mts`): executes an implementation against
  the corpus and reports conformance per clause. The implementation
  under test is plugged in as an adapter command; the contract is
  documented in
  [`docs/running-a-third-party-implementation.md`](docs/running-a-third-party-implementation.md).
- **The reference adapter** (`runner/reference-adapter.mts`): the
  primmel-ts implementation of that contract, exercised in this
  repository's CI (`yarn test:conformance`).

## Running it against the reference toolchain

```bash
yarn test:conformance
```

or, equivalently:

```bash
npx tsx conformance/runner/run.mts \
  --adapter 'npx tsx conformance/runner/reference-adapter.mts' \
  --report conformance-report.json
```

The runner prints one line per clause (`CONFORMS` / `FAILS` with the
positive and negative tallies), then the failing case details when any.
Exit codes: 0 when every case passes, 1 when any case fails or the
adapter malfunctions, 2 on a usage error or a structurally broken
suite. `--case <id>` (repeatable) runs a subset during development.

## Conformance claims

An implementation conforms to this suite at a clause when every case
tagged with that clause passes. A suite-level claim requires all 27
clauses. Partial claims are per area (syntax, serialization, checks,
packaging, errors) and must name the suite version: "conformant with
the Primmel conformance suite v1.0.1, serialization area" is a
well-formed claim; "conformant with Primmel" without the suite version
is not.

## Versioning

The suite is versioned independently of the toolchain releases. The
corpus, the clause map, and the runner change together in one commit;
a version bump follows the change policy:

- **patch**: wording repairs that change no expectation;
- **minor**: new cases inside existing clauses, or the clause-anchor
  re-keying when the Language Specification publishes;
- **major**: new clauses, changed expectations, or a changed adapter
  contract.

The suite targets the language as implemented by the reference
toolchain named in `suite.json` (`language.referenceBaseline`). Where
the specification and the reference toolchain are found to differ, the
specification governs and the suite is corrected under a major bump.
