# Running the conformance suite against a third-party implementation

**Version 3.0.0 · 2026-09-01.** How to execute the Primmel conformance
suite (`conformance/` in this repository) against any implementation of
the language: an OIML SMART Recommendation toolchain, an independent
parser, or a work in progress. The suite never links against the
implementation; it talks to one executable, the **adapter**, whose
contract is defined below.

## The short version

```bash
npx tsx conformance/runner/run.mts --adapter '<your adapter command>'
```

The runner spawns the adapter once per corpus case, compares each
result against the case's expectation, prints a clause-by-clause
report, and exits 0 only when every case passes. The adapter command is
split on whitespace; put flags your adapter needs inside the quotes.

## The adapter contract

The adapter is any executable honouring four subcommands. Each
invocation prints exactly one JSON object on stdout and exits 0. A
non-zero exit, or stdout that is not one JSON object, is reported as a
harness error for that case, never as a conformance failure.

### `parse [--strict] <file.prl>`

Parses one document.

```json
{ "ok": true,  "issues": [{ "code": "duplicate-id", "message": "..." }] }
{ "ok": false, "error": "the parse error message" }
```

- `issues` is the parse-time diagnostics channel: conditions the
  document exhibits without being unparseable. The corpus currently
  requires one code, `duplicate-id`, reported when a document
  redeclares an identifier. Cases that assert `issues` fail against an
  adapter that omits the channel.
- `--strict` selects the strict mode: unknown top-level keywords are
  rejected instead of skipped.

### `roundtrip <file.prl>`

Parses, serializes, parses the serialization, and serializes again.

```json
{ "ok": true, "stable": true, "output": "the first serialization" }
{ "ok": false, "error": "..." }
```

- `stable` is true exactly when the two serializations are
  byte-identical (the fixed point).
- `output` carries the first serialization. Two cases compare it
  against the input file: a canonical document must serialize to
  itself, a non-canonical document must not.

### `check <package-dir> [--with <id>=<dir>]...`

Loads a package directory (its `package.primmel` manifest plus content)
and applies the check machinery.

```json
{ "ok": true, "issues": [{ "rule": "C2", "severity": "error", "message": "..." }] }
{ "ok": false, "error": "the load failure message" }
```

- `rule` is the rule identifier from the language's rule catalog
  (C1, C2, ...; printed by `primmel check --rules` in the reference
  toolchain). `severity` is `error` or `warning`.
- Each `--with` entry maps a package id to a directory: the locator
  with which `uses` composition resolves. Entries arrive sorted by id.
- A package that cannot load at all (for example a manifest without an
  id) is reported as `{ "ok": false, "error": "..." }`; that is a
  verdict, not a malfunction.

### `exports <probe.json>`

Probes the implementation's browser-facing runtime surface (the module a
browser consumer imports). The probe file is a JSON object whose `probe`
array names exported bindings; the adapter partitions the names against
its surface.

```json
{ "ok": true, "present": ["PASSPORT_UPI_LEVELS"], "absent": ["PASSPORT_SECRET_CLASSES"] }
{ "ok": false, "error": "..." }
```

- `present` holds exactly the probed names the surface carries;
  `absent` exactly the ones it does not. A surface that rubber-stamps
  every probe name as present fails the negative case.
- The reference toolchain's browser surface is the entry module of its
  ES browser bundle (`vite.browser.config.ts`): the probe reads that
  module's namespace. An implementation without a browser distribution
  probes its nearest equivalent runtime entry and says so in its claim.

## Expectations, exactly

The runner reads `corpus/cases.json`. Per case kind:

- **parse**: `expect.parse: "ok"` requires `ok: true`; when
  `expect.issues` is present, the sorted issue codes must equal it
  exactly. `expect.parse: "error"` requires `ok: false` and an `error`
  containing `expect.errorMatch` verbatim.
- **roundtrip**: `expect.roundtrip: "ok"` requires `ok: true` and
  `stable: true`; `outputEqualsInput: true` additionally requires
  `output` to equal the input file byte-for-byte,
  `outputDiffersFromInput: true` requires it to differ.
  `expect.roundtrip: "error"` behaves like a parse rejection.
- **check**: `expect.clean: true` requires `ok: true` and zero
  error-severity issues. `expect.rules: [...]` requires the set of
  error-severity rule identifiers to equal the listed set exactly
  (warnings are not counted). `expect.error: "<fragment>"` requires
  `ok: false` with a matching message.
- **exports**: `expect.exports: { "present": [...], "absent": [...] }`
  requires `ok: true` and the reported partitions to equal the listed
  sets exactly.

## Reading the report

The text report prints one line per clause:

```
CONFORMS PKG-04 Layered composition  (positive 1/1, negative 3/3)
FAILS    ERR-02 Enumerated facet values  (positive 1/1, negative 0/1)
```

`--report <file.json>` writes the machine-readable form: per-case
results, per-clause tallies, and the summary block with the suite name
and version. A clause is conformant when every case tagged with it
passes. The claim rules (what you may say publicly, per area or for
the whole suite) are in `conformance/README.md`.

## A worked example

The smallest honest adapter, in POSIX shell over the reference
toolchain's CLI, handles only `check`:

```sh
#!/bin/sh
# my-adapter: check-only, every other command reports malfunction.
if [ "$1" = "check" ]; then
  shift
  out=$(primmel check "$1" 2>&1)   # map the text output to the JSON shape
  ...                              # (left to the implementer)
fi
exit 1
```

Cases needing the unimplemented commands report harness errors, so the
clause tally distinguishes "my implementation rejected this wrongly"
(fail) from "my adapter cannot express this yet" (error). Both keep the
suite exit code at 1; neither is hidden.

## Notes

- The corpus paths the runner passes are absolute; an adapter may not
  assume a working directory.
- The runner is sequential and deterministic; case order is the order
  in `corpus/cases.json`.
- The reference adapter (`runner/reference-adapter.mts`) is the
  executable form of this contract; when its behaviour and this
  document are found to differ, file an issue against the suite, not
  against the toolchain.
