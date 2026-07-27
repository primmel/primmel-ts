# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo identity

`primmel-ts` is a Yarn-Berry monorepo holding TypeScript tools for the **Primmel** modelling language (the second generation of MMEL). It currently contains a single publishable workspace, `@primmel/primmel`, located at `packages/primmel/`.

The parser supports **all MMEL 0.1 constructs plus the Primmel extensions**: forms/subforms, symbols/calculations, state machines, terms, verdicts, reference materials, test point sets, the v2 requirement/subject-chain constructs (requirements, instruments, attribute definitions, capabilities, behaviors, condition sets, conformance tests/classes), the v3 subject anatomy (`subject` is/has/does) and instantiation (`instance`), the quantities/time/duality constructs (`quantity_register`, `dual`, ISO 8601 time primitives, `map<K, V>` type expressions — TODO.roadmap/06), and the v2 `package` manifest with `uses` composition (see below). Unknown keywords are silently skipped for forward compatibility, so the same parser can read both MMEL-era and Primmel-era models.

Migration context (see `MIGRATION.md`): the package was renamed from `@riboseinc/mmel` to `@primmel/primmel` and the repo from `metanorma/mmel-ts` to `primmel/primmel-ts`. Import paths inside the package are relative — only the published name changed.

## Commands

```sh
yarn compile          # tsc — type-check & emit to build/
yarn lint             # gts lint (Google TS style; curly required, single quotes)
yarn lint-fix         # gts fix
npm test              # node:test + tsx — 982 specs in packages/primmel/test/
npx tsx scripts/validate-r60.mts   # parser smoke test against the R 60 model
```

The test suite uses Node's built-in test runner (`node --test --import tsx`) with specs in `packages/primmel/test/*.test.ts`. Coverage spans all ser-des stages: tokenizer, parser, resolver (unit + integration), round-trip, duplicate detection, includes, strict mode, validate. `yarn pretest` runs `compile`; `yarn posttest` runs `lint`.

To exercise the parser ad-hoc against a `.mmel` file: `npx tsx -e "import { loadFile } from './packages/primmel/src/ser-des/index.ts'; console.log(loadFile('./path/to/model.mmel'))"`.

## Pipeline architecture

The ser/des pipeline lives in `packages/primmel/src/ser-des/` and runs in four stages:

```
.mmel source
   │
   │ (optional) includes.ts — preprocessIncludes() inlines `include "..."` directives
   │             recursively, relative-path, cycle-detected
   ▼
tokenize.ts   — whitespace-delimited tokens, BUT "..." (strings) and {...}
                (brace blocks, with string-aware brace counting) are single tokens.
                Also exports tokenizePackage / removePackage / tokenizeAttributes
                for parsing inside a `{...}` block.
   ▼
parse.ts      — walks tokens as (keyword, [id], payload) triples. Each keyword
                looks up a Parser in PARSER_CONFIG, which returns a ctx => ctx
                updater that mutates a ParseContext (a bag of Record<id, item>).
   ▼
resolve.ts    — walks the ParseContext, swapping the `_relations` ID strings
                for full referenced objects. LENIENT by default: missing
                references are caught and the partially-resolved item is kept.
   ▼
Standard      — the typed AST (types/Standard.ts). dump() reverses this.
```

### The `Resolvable<T, Relations>` pattern

Every type that can be cross-referenced has two forms (see `types/Resolvable.ts`):

- **Parsed form** (`Resolvable<T, ...>`): same shape as `T`, plus a `_relations` object holding string IDs in place of the resolved references.
- **Resolved form** (`T`): full objects, no `_relations`.

Parsers produce `Resolvable*`; resolvers strip `_relations` and return `T`. When adding a new construct, you mirror this: define both shapes in `types/`, then implement the parse/resolve/dump triple in `ser-des/config/<construct>.ts`.

### One registry: `defineConstruct` in `ser-des/config/index.ts`

Adding a new keyword to the language is a registration exercise, not a pipeline edit. `defineConstruct(...)` collapses the old three-registry boilerplate (PARSER_CONFIG + RESOLVER_CONFIG + DUMPER_CONFIG) into one `CONSTRUCTS` entry; the three registries are derived from it:

1. `keyword` (+ optional `aliases`) — the token that triggers the parser.
2. `field` — the `ParseContext`/`Standard` collection the construct populates.
3. `parse` (+ `takesID: true` when the keyword consumes an id token), optional `resolve` for constructs with cross-references, and `dump`.

Each construct's `parse`/`resolve`/`dump` live together in `ser-des/config/<construct>.ts` (e.g. `process.ts`, `form.ts`, `stateMachine.ts`). Some keywords are aliased to one parser — e.g. `start`/`start_event` both map to `parseStartEvent` for spec backward-compatibility. Special cases that don't fit the keyword/field shape (`root`, `metadata`, `package`) stay inline in `SPECIAL_PARSERS`.

### Lenient resolver

`resolveFromContext` (`ser-des/resolve.ts:5`) wraps missing-reference lookup in a try/catch at the call sites in `resolve()`. Forward references and partial models load without throwing. Preserve this when adding new resolvers — wrap field lookups, don't let one broken reference abort the whole document.

### `Standard` shape

`types/Standard.ts` is the root AST. It is a flat struct of arrays per construct type. When adding a new construct:

1. Add the typed array to `Standard`.
2. Add the `Record<string, ...>` map to `ParseContext` (`ser-des/types.ts`).
3. Add the matching entry to the hard-coded ctx initializer in `ser-des/parse.ts` (easy to miss — without it every parse throws).
4. Implement the parse/resolve/dump triple in `ser-des/config/<construct>.ts`, mirroring the `Resolvable<T, Relations>` pattern for cross-referenced types.
5. Append ONE `defineConstruct(...)` entry to `CONSTRUCTS` in `ser-des/config/index.ts` (duplicate-ID detection comes free from its `field`).
6. Add the field to `MERGE_FIELDS` in `ser-des/package.ts` — without it the `uses` composition silently drops the construct when merging packages.

### Package composition (`uses`, TODO.roadmap/05)

A Recommendation package is one directory with a `package.primmel` manifest. Beyond `id`/`title`/`version`/`editions`/`baseUrn`/`description`/`source`, the manifest declares the composition metadata (`types/Package.ts`):

- `kind core|module|rec|product_reference` — the package tier (anything else is a parse error; absent means an ordinary rec package); `product_reference` (TODO.roadmap/36, doctrine ch. 15) is a manufacturer's product model mapped aspect-by-aspect to the Recommendation, declaring `manufacturer`/`product`/`maps_to { … }` on the manifest;
- `uses { … }` — imported packages (structural inclusion; multi-package replacement for the deprecated single `extends`, which the loader treats as a one-entry `uses` with a deprecation warning);
- `provides { … }` — capability tokens this package contributes downstream;
- `requires { … }` — capability or package ids the package expects in the composition;
- `waives { … }` — consumer-side waivers (`<packageId>:<providesEntry>`, or a bare entry) for provides it deliberately does not consume.

`loadPackage(dir, { resolvePackage })` (`ser-des/package.ts`) composes the whole dependency closure when a locator is given: `composePackage` resolves the uses graph through the locator, orders it topologically (DFS post-order, deterministic; diamond dependencies merge exactly once), and merges every package's parsed context with no-redefine semantics — a downstream package may REFERENCE upstream ids but never REDEFINE them. Failures are hard `CompositionError`s (`uses-resolves`, `uses-no-redefine`, `uses-cycle`, `requires-satisfied`); unconsumed provides and the `extends` deprecation come back as warnings. New id-keyed `ParseContext` collections MUST be registered in `MERGE_FIELDS` there (checklist above). Without a locator the single directory loads as before. One edge kind is exempt from the merge: a `uses` target whose manifest declares `kind product_reference` is an ABSTRACT IMPORT (TODO.roadmap/36) — located, id-checked and version-pin-checked (C83, `uses { acme-lc500@2021 }`), but never content-merged and never traversed; the consumer maps to the product's promised aspects (C24 exempts the edge) instead of including them.

The linter (`src/check.ts`) surfaces the same rules as **C27 uses-resolves** (also the `extends` deprecation warning), **C28 uses-no-redefine**, **C29 uses-cycle**, **C30 provides-consumed-or-waived** (warning), **C31 requires-satisfied** when `checkPackage(dir, { resolvePackage })` gets a locator. Without a locator, C27–C31 cannot compose — instead a manifest-only stopgap runs: `checkManifestResolution(dir)` parses the manifest plus the manifests of the SIBLING package directories and verifies, without composing content, that every uses/extends entry resolves (C27), the graph is acyclic (C29), and every requires entry names a closure package id or one of its provides entries (C31), all marked "(manifest-only …)".

CLI (`packages/primmel/scripts/check.mts`): `primmel check [--strict] [--audit] [--coverage] [--rules] [--with <pkg-id>=<dir>]… <package-dir>`. Each repeatable `--with` maps a package id to a directory, building the locator that makes C27–C31 reachable from the CLI; without it the manifest-only stopgap runs instead. `--rules` prints the machine-readable rule catalog (`src/check-rules.ts`, 94 rules C1–C94 across 15 families — the single source the docs reference). Levels (TODO.roadmap/17): the default level runs the normal-level rules at their catalog severities; `--audit` adds the audit-level rules (C25 mapping-description + the coverage audits C51 coverage-test-evidence / C52 coverage-form-judgment / C71 text-coverage-sentence-uncovered) and enforces the per-package coverage budgets (C55, C72); `--strict` promotes every warning to an error EXCEPT KNOWN (allowlisted) issues and budget-covered C51/C52/C71 warnings. The coverage family also holds the normal-level anchoring legs C53 coverage-uses-bound and C54 coverage-lookup-table-exists (both errors), and C5 is the refined requirement↔test closure (deliberate exclusions — non-test verification methods, process `validate_provision` — are recorded, not gaps). The text-coverage metric (TODO.roadmap/26, `src/text-coverage.ts`) reads the payloads a package ships under `sources-prd/`: `<part>.sentences.json` (the sentence decomposition of one source document — every prose sentence with its `<fragment>/s<N>` address and the modality classifier's verdict; only normative sentences gate) and `coverage.json` (sentence-pinned allowances + duplicate adjudications). C71 warns per uncovered normative sentence (audit); C72 is the budget error (the allowlist's `text_coverage_budget N ["reason"]`, the C55 pattern — exceeded errors, slack warns); C73 fails malformed/stale declarations at every level. `--coverage` prints the per-document report (ratios with and without allowances, allowed exclusions, duplicate-pair adjudication status — pairs are REPORTED, never auto-failed; acceptance is 0 unresolved). The package allowlist (`src/check-allowlist.ts`) lives in the package root as `.primmel-allowlist.prl` (skipped by the package loader): KNOWN entries (rule id + glob on the message + reason + audit_ref) suppress matching issues even under `--strict`; STALE entries — an active-rule entry matching nothing — are errors (C57); malformed entries are errors (C56); `coverage_budget N ["reason"]` caps the package's audit-level coverage warnings (exceeded: C55 error; slack: C55 warning — the allowlist only shrinks; the optional quoted reason is the budget's burn-down justification — recommended, not required). An unreadable or missing package directory (the positional argument or a `--with` target) is a clean `cannot read package at <dir>: <reason>` diagnostic with exit 2, never a stack trace.

### Model diff + edition lifecycle (TODO.roadmap/28, doctrine ch. 13)

`primmel diff [--json] [--exit-code] [--compare-texts] [--with <pkg-id>=<dir>]… <a> <b>` (same `scripts/check.mts` entry — the first positional dispatches `check`/`diff`) runs the structural MODEL diff between two package states: id-keyed (never file position), tier-annotated (foundations/primary/secondary/tertiary/cross-cutting — `TIER_BY_FIELD` in `src/model-diff.ts`), classified added/removed/changed (anchor/statement/binding/limit/applicability/structure/provenance aspects)/moved (ONLY anchor-field changes — bindsTo/parent/targets; binding-surface content like a calculation signature or a requirement's subjects/channel reports `changed — binding`, never moved). The mapping diff reports pair adds/removes, description/justification changes, and the COMPUTED coverage delta (the ch. 5 calculus run on both versions). The clause-drift table compares edition-normalized provenance edges of shared elements (doc URNs compare on their edition-stripped basis, so the expected re-citation is invisible; a clause move lights up) — the R 60:2017→2021 renumbering detector. `src/model-diff.ts` is pure (Standards in, diff out); `src/package-diff.ts` loads dirs (+ .prm files, + sources-prd sentence payloads for the same-text/differed rewording classification). Duplicate kind:id keys surface as report `warnings` (last declaration wins — the duplicate-id linter owns the error). `--exit-code` makes a non-empty diff exit 1 (the change-audit CI gate).

Edition lifecycle fields live on the package manifest, never in subject models: `supersedes`/`replaces` (URN or list), `validity { from … to … }`, `status current|preview|superseded|withdrawn` (`types/Package.ts`; unknown tokens are parse errors, like `kind`). The linter enforces them as **C77 edition-status** (a current/preview edition is the register's newest entry), **C78 edition-validity-window** (well-formed ISO 8601, `to` not before `from`), **C79 edition-supersedes-resolves** (URN shape, never self, register coherence for same-document targets, the supersedes graph over sibling manifests acyclic), and **C80 edition-pin-resolves** (INV-8: every instance's `definition_versions` pin resolves against the package's edition register — editions ∪ {version}), and **C85 baseurn-wellformed** (the manifest base URN is a well-formed IRI — scheme present, no whitespace or IRI delimiters; the free-string field grounds every downstream IRI, and the RDF projection guards the same shape at export).

### Interop projections (TODO.roadmap/27)

`primmel export reqif <package-dir> [--out <file>]` (same `scripts/check.mts` entry — the first positional dispatches `check`/`diff`/`export`) projects a package's requirements into ReqIF XML for RM-tool ecosystems (`src/export/reqif.ts`; default stdout, `--out` writes a file). ReqIF 1.0.1 (the 20110401 namespace), DIN DKE SPEC 99200 profile where compatible: document/heading/provision spec-objects (package / requirement classes / requirements + conformance tests), modality shall→requirement / should→recommendation / may→permission, clause provenance in `obj.clause-number` + `bib.di.document-identifier`, and cross-reference spec-relations from dependencies (`depends-on`), conformance-test targets (`verifies`), and bindings naming exported ids (`binds`) — unexported refs drop into `stats.droppedReferences`, never dangle. ONE-WAY lossy projection, never the kernel's truth: the exporter's header note (shipped in every document) and the module header state what survives vs what is lost (bindings, OCL, quantities, processes) and the never-merge re-import doctrine.

`primmel export rdf <package-dir> [--out <file>] [--format turtle|jsonld]` (same `export` arm) projects a package into an RDF graph in the IEC-ISO Core Ontology vocabulary for linked-data consumers (the smartSDU share's core-ontology.ttl v2.0.0 — `src/export/rdf-vocabulary.ts` pins every IRI with citations; `src/export/rdf.ts` carries the mapping + the survive/lost doctrine, also shipped as the leading Turtle comment): the package as `smart:PublicationDocument`, requirement classes as the `smart:Clause` tree (nested by `/req/...` id path), requirements as Provision subclasses BY MODALITY (shall→`smart:Requirement`, should→`smart:Recommendation`, may→`smart:Permission` — the vocabulary's own form; the token also rides as `primmel:obligation` data), conformance tests as `primmel:ConformanceTest` (the vocabulary has no verification-provision class — documented `urn:primmel:vocab:` extension, declared `rdfs:subClassOf smart:Provision` in the graph), terms as `smart:TermEntry` + skosxl labels with definitions/form/part-of-speech types, guidance as `smart:ProvisionSupplement` notes, provenance as `dcterms:source` `<doc#clause-X>` IRIs, and cross-references (`dcterms:requires` / `primmel:verifies` / `dcterms:references`). Turtle is canonical (default); `--format jsonld` renders the same graph. The projection's SHACL shapes (`src/export/rdf-shapes.ts`) and SPARQL competency questions (`src/export/rdf-competency-questions.ts`) ship with the package and are executed against the projected graph in the tests (the triple store, Turtle parser, SHACL Core subset, and SPARQL subset are purpose-built in `test/helpers/rdf*.ts` — zero dependencies, the 27b no-new-dependency doctrine). Same one-way doctrine as ReqIF.

### Quantities, time, and the IS↔HAS duality (TODO.roadmap/06)

The `quantity_register` construct is a package's typed unit/quantity-kind registry (units carry symbol + kind + SI conversion; kinds carry the dimension vector); the `dual` construct is the IS↔HAS value duality — one quantity in two roles, `designed` (tolerance) vs `exhibited` (uncertainty). Time primitives live in `src/time.ts` (ISO 8601 date/datetime/duration/period validation, validity windows, INV-8 edition pins); `map<K, V>` type expressions in `src/type-expr.ts`. The linter checks them as **C32 inv1-no-bare-quantity** (a value stated for a declared physical quantity — attribute unit, quantity_kind, or QuantityValue value_type — carries a unit; an empty-string unit token counts as bare; numeric condition-set entries carry units, free text stays legal), **C33 quantity-coherence** (register integrity + kind-vs-unit coherence across instances, condition sets, symbols, verdicts), **C34 duality-coherence** (each stated role of a dual bound to a physical quantity carries a unit or explicit kind; both roles stated ⇒ same kind), **C35 time-format**, and **C36 map-type**.

### Operational state machines (TODO.roadmap/07)

The subject's HAS state is a `state_machine` typed `kind operational` (default `lifecycle` — the workflow-entity family; the dumper omits the line for it so pre-v3 output stays byte-identical). A subject binds its operational machine via `has.state <machineRef>`; a process binds the machine it drives via `state <machineRef>` and its steps declare `fires <transition-action>` (the machine takes the transition when the step completes); preconditions gate on `self.state = #state`. The executable semantics live in `src/operational-state.ts`: `evaluateStateGate` classifies a process's state-gate preconditions against the current node as `ok | invalid` — a violated state gate voids the RUN (invalid, NEVER fail — the warm-up pattern), and `foldTrajectory` folds a fired step sequence into the run's `StateTrajectory` (`{state, at, firedBy}` entries; runtime storage is task 29's). The families are strictly disjoint: the linter enforces **C37 state-fires-resolve** (fires names a declared transition action of the bound machine), **C38 state-family-separation** (no lifecycle cascade into an operational machine, no operational cascade into a lifecycle machine, no subject has.state bound to a lifecycle machine), **C39 state-machine-states-referenced** (`#state` literals in `self.state` gates resolve against the bound machine), **C40 anatomy-state-resolves** (has.state names a declared machine), and **C41 precondition-on-violation-known** (a precondition's `on_violation` parses as a free string; the only known outcome is `invalid`, others warn — a state gate declared `on_violation fail` always warns: a violated run-validity precondition voids the run, never fails the instrument).

### Promises (TODO.roadmap/08)

`is.promises` entries are first-class manufacturer claims on characteristics/behavior: `<id> { target <characteristic|behavior> level <{QuantityValue}|range {…}|symbolic <id>> conditions <ocl{…}> statement "…" verified_by { … } source { … } }`, with a quoted-string shorthand parsing as a statement-only promise (the legacy string-list dump stays byte-identical for shorthand-only blocks). The linter enforces **C42 promise-target-resolves** (the target is a declared characteristic of the owning subject or a declared behavior), **C43 promise-verifiable** (no `verified_by` declared and no verifying requirement/test derivable — requirements/tests binding the same target — warns at authoring; declared `verified_by` ids resolve under C2), and **C44 promise-not-bare-value** (a promise that merely RESTATES a declared attribute value — attribute target + bare quantity level, no conditions, no verification linkage — is an error; bare parameter values stay `origin: declared` attributes, but a genuine claim ABOUT an attribute/dimension — conditioned, envelope/range, symbolic level, or verified — is legal).


## Style & tooling notes

- **GTS** (Google TypeScript Style) via `gts lint`. Prettier config in `.prettierrc.js`: single quotes, bracket spacing. The `.eslintrc.json` overrides GTS to make `curly: error` and turn off quote enforcement (Prettier handles quotes).
- TypeScript target/types come from `gts/tsconfig-google.json`; the root `tsconfig.json` only sets `rootDir: .` and `outDir: build`.
- Yarn Berry with `nodeLinker: node-modules` (`.yarnrc.yml`), pinned `yarnPath: .yarn/releases/yarn-berry.cjs`. Do not commit `.yarn/` except under `.yarn/{patches,releases,plugins,sdks,versions}` (see `.gitignore`).
- The package's published `files` whitelist in `packages/primmel/package.json` is `**/*.{js,js.map,d.ts}` — i.e. compiled output only. Source `.ts` files are not shipped. `prepare` runs `yarn compile` before publish.
