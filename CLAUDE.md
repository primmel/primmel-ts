# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo identity

`primmel-ts` is a Yarn-Berry monorepo holding TypeScript tools for the **Primmel** modelling language (the second generation of MMEL). It currently contains a single publishable workspace, `@primmel/primmel`, located at `packages/primmel/`.

The parser supports **all MMEL 0.1 constructs plus five Primmel extensions**: `form`, `subform`, `symbol`, `calculation`, `state_machine`. Unknown keywords are silently skipped for forward compatibility, so the same parser can read both MMEL-era and Primmel-era models.

Migration context (see `MIGRATION.md`): the package was renamed from `@riboseinc/mmel` to `@primmel/primmel` and the repo from `metanorma/mmel-ts` to `primmel/primmel-ts`. Import paths inside the package are relative — only the published name changed.

## Commands

```sh
yarn compile          # tsc — type-check & emit to build/
yarn lint             # gts lint (Google TS style; curly required, single quotes)
yarn lint-fix         # gts fix
npx tsx scripts/validate-r60.mts   # parser smoke test against the R 60 model
```

There is no formal test runner. `scripts/validate-r60.mts` is the only executable validation — it loads a multi-file model from `models/r60/` (not committed at repo root; the script resolves the path relative to the repo root) and asserts element counts. `yarn pretest` runs `compile`; `yarn posttest` runs `lint`.

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

### Three registries in `ser-des/config/index.ts`

Adding a new keyword to the language is a registration exercise, not a pipeline edit:

1. `PARSER_CONFIG[keyword]` — `{ takesID?: true, parse: Parser }`. `takesID: true` means the parser consumes two tokens (id, payload) instead of one (payload).
2. `RESOLVER_CONFIG[field]` — `{ resolve: Resolver }`. Optional; only constructs with cross-references need a resolver.
3. `DUMPER_CONFIG[field]` — `Dumper<T>` for each field on `Standard`.

Each construct's `parse`/`resolve`/`dump` live together in `ser-des/config/<construct>.ts` (e.g. `process.ts`, `form.ts`, `stateMachine.ts`). Some keywords are aliased to one parser — e.g. `start`/`start_event` both map to `parseStartEvent` for spec backward-compatibility.

### Lenient resolver

`resolveFromContext` (`ser-des/resolve.ts:5`) wraps missing-reference lookup in a try/catch at the call sites in `resolve()`. Forward references and partial models load without throwing. Preserve this when adding new resolvers — wrap field lookups, don't let one broken reference abort the whole document.

### `Standard` shape

`types/Standard.ts` is the root AST. It is a flat struct of arrays per construct type. When adding a new construct: add the typed array to `Standard`, the `Record<string, ...>` map to `ParseContext` (`ser-des/types.ts`), the parser/resolver/dumper triple, and the three config entries.

## Style & tooling notes

- **GTS** (Google TypeScript Style) via `gts lint`. Prettier config in `.prettierrc.js`: single quotes, bracket spacing. The `.eslintrc.json` overrides GTS to make `curly: error` and turn off quote enforcement (Prettier handles quotes).
- TypeScript target/types come from `gts/tsconfig-google.json`; the root `tsconfig.json` only sets `rootDir: .` and `outDir: build`.
- Yarn Berry with `nodeLinker: node-modules` (`.yarnrc.yml`), pinned `yarnPath: .yarn/releases/yarn-berry.cjs`. Do not commit `.yarn/` except under `.yarn/{patches,releases,plugins,sdks,versions}` (see `.gitignore`).
- The package's published `files` whitelist in `packages/primmel/package.json` is `**/*.{js,js.map,d.ts}` — i.e. compiled output only. Source `.ts` files are not shipped. `prepare` runs `yarn compile` before publish.
